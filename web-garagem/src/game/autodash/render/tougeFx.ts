// AutoDash — render/tougeFx.ts. Efeitos do duelo de touge (world/touge.ts) com
// cara de luta de chefe. Só desenho: nada aqui muda regra, dificuldade nem o
// estado do duelo (o duelo só pede efeitos pela fila `tg.fx`).
//
// O que tem aqui:
// - drift: rastro de fumaça denso saindo das rodas traseiras (a de fora solta
//   mais), borracha e faíscas quando passa do ângulo, marcas de pneu na tela;
// - o rival: marcas de pneu dele na pista (você passa por cima), fumaça nas
//   curvas e faísca quando você encosta nele (a luz de freio piscando nas
//   entradas é do world/touge.ts, com o freioT que render/objects.ts já desenha);
// - impacto (ENTRADA/CURVA PERFEITA, TROCA, PASSOU): clarão, soco de zoom
//   (render/camera.ts) e linhas de velocidade radiais por ~0,3 s, e o texto
//   estilizado que entra grande e assenta; erro: vinheta vermelha (o tremor é o
//   trauma da câmera, posto pelo duelo);
// - câmera lenta: tinta fria e acinzentada, vinheta e linhas quase paradas;
// - barras de espírito: pedaço que cai em branco, pisca abaixo de 25% e a aura
//   do rival que ACORDOU;
// - a apresentação do rival: faixa que corre pela tela e o nome que bate.
//
// PC fraco: nada de shadowBlur nem gradiente por quadro. Fumaça e vinhetas são
// sprites cacheados (como render/textures.ts); faíscas, linhas e marcas saem em
// poucos traços por quadro; os pools têm teto.
import { type AutoDashEngine, W, H, PLAYER_Z } from "../engine"
import { SEG_LEN, CAM_HEIGHT, ROAD_WIDTH } from "../data"
import { lenteAtual } from "./fov"
import { socoCamera } from "./camera"
import { rodasTraseiras, rodaDeFora } from "../fx/particles"
import { TOUGE, anguloDrift, zonaDa, type Touge, type EfeitoTouge } from "../world/touge"
import { wrapDz } from "../traffic/spawner"
import { segAt } from "../world/track"
import { KINDS } from "../traffic/types"
import { rr } from "./primitives"

const FONTE = "'Space Grotesk', 'Segoe UI', sans-serif"
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const easeOut = (p: number) => 1 - (1 - p) * (1 - p)
const easeOutBack = (p: number) => { const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2) }
/** Sorteio fixo por índice (as linhas de um impacto não tremem de um quadro para o outro). */
const sorteio = (i: number, seed: number) => { const s = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453; return s - Math.floor(s) }

// ---------- sprites cacheados ----------
const sprites = new Map<string, HTMLCanvasElement>()

/** Bolota de fumaça (gradiente feito uma vez só por cor). */
function fumacaTex(rgb: string): HTMLCanvasElement {
  const k = "f" + rgb
  const hit = sprites.get(k)
  if (hit) return hit
  const cv = document.createElement("canvas")
  cv.width = 64; cv.height = 64
  const c = cv.getContext("2d")!
  const g = c.createRadialGradient(32, 32, 2, 32, 32, 32)
  g.addColorStop(0, `rgba(${rgb},0.85)`)
  g.addColorStop(0.5, `rgba(${rgb},0.45)`)
  g.addColorStop(1, `rgba(${rgb},0)`)
  c.fillStyle = g
  c.fillRect(0, 0, 64, 64)
  sprites.set(k, cv)
  return cv
}

/** Vinheta colorida em 1/4 da resolução (esticada na tela, o gradiente não serrilha). */
function vinhetaTex(rgb: string): HTMLCanvasElement {
  const k = "v" + rgb
  const hit = sprites.get(k)
  if (hit) return hit
  const cv = document.createElement("canvas")
  const w = W / 4, h = H / 4
  cv.width = w; cv.height = h
  const c = cv.getContext("2d")!
  const g = c.createRadialGradient(w / 2, h / 2, h * 0.32, w / 2, h / 2, w * 0.62)
  g.addColorStop(0, `rgba(${rgb},0)`)
  g.addColorStop(0.6, `rgba(${rgb},0.35)`)
  g.addColorStop(1, `rgba(${rgb},0.9)`)
  c.fillStyle = g
  c.fillRect(0, 0, w, h)
  sprites.set(k, cv)
  return cv
}

// ---------- projeção na pista (a mesma conta de render/road.ts, para poucos pontos) ----------
const MAX_SEGS = 140
const PX = new Float64Array(MAX_SEGS), PDX = new Float64Array(MAX_SEGS)
const PY1 = new Float64Array(MAX_SEGS), PY2 = new Float64Array(MAX_SEGS)
const PVIS = new Uint8Array(MAX_SEGS)
const proj = { n: 0, base: 0, baseOff: 0, avanco: 0, depth: 1, camX: 0, camY: 0, trackLen: 1 }
interface Tela { x: number; y: number; k: number; s: number; dz: number }
const pt: Tela = { x: 0, y: 0, k: 0, s: 0, dz: 0 }

/** Monta a tabela da projeção deste quadro: curva acumulada, altura e o que o morro esconde. */
function montarProjecao(eng: AutoDashEngine) {
  const N = eng.segments.length
  const baseIdx = Math.floor(eng.position / SEG_LEN) % N
  const basePct = (eng.position % SEG_LEN) / SEG_LEN
  const playerZ = eng.position + PLAYER_Z
  const pSeg = segAt(eng, playerZ)
  const pPct = (playerZ % SEG_LEN) / SEG_LEN
  const lente = lenteAtual(eng)
  proj.camY = pSeg.y1 + (pSeg.y2 - pSeg.y1) * pPct + CAM_HEIGHT + eng.elevJogador
  proj.camX = eng.playerX * ROAD_WIDTH
  proj.base = baseIdx * SEG_LEN
  proj.baseOff = basePct * SEG_LEN
  proj.avanco = lente.avanco
  proj.depth = lente.depth
  proj.trackLen = eng.trackLen
  proj.n = Math.min(MAX_SEGS, N)
  let x = 0, dx = -(eng.segments[baseIdx].curve * basePct), maxY = H + 10, comecou = false
  for (let i = 0; i < proj.n; i++) {
    const seg = eng.segments[(baseIdx + i) % N]
    PX[i] = x; PDX[i] = dx; PY1[i] = seg.y1; PY2[i] = seg.y2
    x += dx; dx += seg.curve
    const dz2 = (i + 1) * SEG_LEN - proj.baseOff - proj.avanco
    if (dz2 <= 0) { PVIS[i] = 0; continue }
    const sy2 = H / 2 - (seg.y2 - proj.camY) * (proj.depth / dz2) * (H / 2)
    if (sy2 >= maxY) PVIS[i] = comecou ? 0 : 1 // atrás do morro some; antes do asfalto é o campo próximo
    else { PVIS[i] = 1; maxY = sy2; comecou = true }
  }
}

/** Ponto do mundo (z, deslocamento lateral em u) na tela; false se atrás da câmera, longe ou escondido. */
function projetar(z: number, lat: number, alt = 0): boolean {
  let zr = (z - proj.base) % proj.trackLen
  if (zr < 0) zr += proj.trackLen
  const i = Math.floor(zr / SEG_LEN)
  if (i >= proj.n || !PVIS[i]) return false
  const pct = zr / SEG_LEN - i
  const dz = zr - proj.baseOff - proj.avanco
  if (dz < 60) return false
  const s = (proj.depth / dz) * (H / 2)
  pt.k = s * (W / H)
  pt.s = s
  pt.dz = dz
  pt.x = W / 2 + (PX[i] + PDX[i] * pct + lat - proj.camX) * pt.k
  pt.y = H / 2 - (PY1[i] + (PY2[i] - PY1[i]) * pct + alt - proj.camY) * s
  return true
}

// ---------- estado (do duelo da vez) ----------
interface Fum { x: number; y: number; vx: number; vy: number; r: number; cresce: number; vida: number; max: number; escura: boolean }
interface Fagulha { x: number; y: number; vx: number; vy: number; vida: number; borracha: boolean }
interface Marca { x: number; y: number; idade: number; corte: boolean }
interface MarcaPista { z: number; lat: number; idade: number; run: number }
interface Baforada { z: number; lat: number; alt: number; r: number; vl: number; vida: number; max: number }
interface Cartao { e: EfeitoTouge; t0: number; dur: number }
interface Pedaco { x: number; y: number; w: number; vy: number; vida: number }
interface BarraFx { base: number; desdeT: number; pedacos: Pedaco[]; batidaT: number }

const st = {
  tg: null as Touge | null,
  ultimo: 0,      // performance.now do quadro anterior
  t: 0,           // relógio de parede do duelo (s): impactos e textos não ficam lentos
  tj: 0,          // relógio do jogo (s): anda devagar na câmera lenta
  dt: 0, dtj: 0,
  fum: [] as Fum[],
  fag: [] as Fagulha[],
  marcas: [[], []] as [Marca[], Marca[]],
  marcaT: 0,
  pista: [[], []] as [MarcaPista[], MarcaPista[]],
  pistaZ: 0, pistaRun: 0, rivalDerrapava: false,
  baf: [] as Baforada[],
  cartoes: [] as Cartao[],
  flashT: -9, flashCor: "255,255,255", flashForca: 0,
  raiosT: -9, raiosSeed: 0, raiosCor: "255,255,255",
  vermelhoT: -9, vermelhoDur: 0.45, vermelhoForca: 0,
  acordouT: -9,
  introBateu: false,
  barras: [] as BarraFx[],
}

function novaBarra(): BarraFx { return { base: 100, desdeT: 0, pedacos: [], batidaT: -9 } }

function reiniciar(tg: Touge) {
  st.tg = tg
  st.t = 0; st.tj = 0
  st.fum.length = 0; st.fag.length = 0; st.baf.length = 0; st.cartoes.length = 0
  st.marcas[0].length = 0; st.marcas[1].length = 0
  st.pista[0].length = 0; st.pista[1].length = 0
  st.pistaRun = 0; st.rivalDerrapava = false
  st.flashT = st.raiosT = st.vermelhoT = st.acordouT = -9
  st.introBateu = false
  st.barras = [novaBarra(), novaBarra()]
}

// ---------- impactos ----------
function flash(rgb: string, forca: number) { st.flashT = st.t; st.flashCor = rgb; st.flashForca = forca }
function raios(rgb: string) { st.raiosT = st.t; st.raiosSeed = Math.random() * 100; st.raiosCor = rgb }
function vermelho(forca: number, dur: number) { st.vermelhoT = st.t; st.vermelhoForca = forca; st.vermelhoDur = dur }

function hexRgb(hex: string): string {
  const h = hex.replace("#", "")
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

/** Consome a fila de efeitos do duelo: cada um vira impacto, texto ou erro. */
function consumir(tg: Touge) {
  if (tg.fx.length === 0) return
  for (const e of tg.fx) {
    if (e.tipo === "impacto") {
      flash("255,255,255", 0.4); raios("255,255,255"); socoCamera(0.06)
    } else if (e.tipo === "acordou") {
      flash(hexRgb(e.cor), 0.45); raios(hexRgb(e.cor)); socoCamera(0.08); vermelho(0.7, 0.8)
      st.acordouT = st.t
    } else if (e.tipo === "erro") {
      vermelho(e.forte ? 1 : 0.75, e.forte ? 0.8 : 0.45)
    }
    const dur = e.tipo === "acordou" ? 1.9 : e.tipo === "texto" ? 0.95 : 1.15
    st.cartoes.push({ e, t0: st.t, dur })
  }
  tg.fx.length = 0
  while (st.cartoes.length > 2) st.cartoes.shift()
}

// ---------- passo (uma vez por quadro, na camada do mundo) ----------
function passo(eng: AutoDashEngine): Touge | null {
  const tg = eng.touge
  const agora = performance.now()
  if (!tg) { st.tg = null; st.ultimo = agora; return null }
  if (st.tg !== tg) reiniciar(tg)
  const rodando = eng.state === "racing"
  st.dt = rodando && st.ultimo ? Math.min(0.05, Math.max(0, (agora - st.ultimo) / 1000)) : 0
  st.ultimo = agora
  st.dtj = st.dt * (eng.escalaTempo < 1 ? eng.escalaTempo : 1)
  st.t += st.dt; st.tj += st.dtj
  consumir(tg)
  return tg
}

function emitirDrift(eng: AutoDashEngine, tg: Touge) {
  const dtj = st.dtj
  if (tg.fase !== "batalha" || dtj <= 0) return
  const giro = Math.abs(eng.driftAng)
  const rodas = rodasTraseiras(eng)
  const fora = rodaDeFora(eng)
  const meio = W / 2 - eng.driftAng * 70
  // marcas de pneu na tela: o ponto nasce na roda e escorrega para baixo com a pista
  st.marcaT -= dtj
  const marcando = giro > 0.12
  if (st.marcaT <= 0) {
    st.marcaT = 1 / 40
    for (let w = 0; w < 2; w++) {
      const lista = st.marcas[w]
      if (marcando) {
        const ult = lista[lista.length - 1]
        lista.push({ x: rodas[w].x, y: rodas[w].y + 4, idade: 0, corte: !ult || ult.idade > 0.06 })
        if (lista.length > 60) lista.shift()
      }
    }
  }
  const desce = (110 + eng.speed * 1.1) * dtj
  for (const lista of st.marcas) {
    for (const m of lista) { m.idade += dtj; m.y += desce * Math.max(0.3, 1 + (m.y - (H - 60)) / 60) } // perto da câmera corre mais
    while (lista.length && (lista[0].idade > 1.2 || lista[0].y > H + 30)) lista.shift()
  }
  if (giro < 0.12) return
  const dr = anguloDrift(eng)
  const naZona = !!dr && dr.ang >= zonaDa(dr.c)[0] && dr.ang <= zonaDa(dr.c)[1]
  const passou = !!dr && dr.ang > zonaDa(dr.c)[1]
  const rodou = giro > TOUGE.roda // world/touge.ts põe o carro a 1,7 rad quando roda
  // fumaça: densa e longa, a roda de fora solta mais
  const taxa = (rodou ? 55 : naZona ? 48 : 28) * dtj
  let n = Math.floor(taxa) + (Math.random() < taxa % 1 ? 1 : 0)
  while (n-- > 0 && st.fum.length < 110) {
    const w = Math.random() < 0.72 ? fora : 1 - fora
    const r = rodas[w]
    const lado = r.x < meio ? -1 : 1
    const max = 1.1 + Math.random() * 0.6
    st.fum.push({
      x: r.x + (Math.random() - 0.5) * 12, y: r.y - 2,
      vx: lado * (30 + Math.random() * 70) - eng.driftAng * 60, vy: 50 + Math.random() * 70,
      r: 12 + Math.random() * 10, cresce: 38 + Math.random() * 30, vida: max, max, escura: Math.random() < 0.18,
    })
  }
  // borracha sempre um pouco; faísca quando passa do ângulo (ou rodou)
  const taxaF = (passou || rodou ? 40 : 10) * dtj
  let f = Math.floor(taxaF) + (Math.random() < taxaF % 1 ? 1 : 0)
  while (f-- > 0 && st.fag.length < 90) {
    const r = rodas[fora]
    const lado = r.x < meio ? -1 : 1
    const borracha = !(passou || rodou) || Math.random() < 0.3
    st.fag.push({
      x: r.x, y: r.y, vx: lado * (80 + Math.random() * 220), vy: -40 - Math.random() * 160,
      vida: borracha ? 0.5 : 0.35 + Math.random() * 0.2, borracha,
    })
  }
}

function passoParticulas(dtj: number) {
  for (let i = st.fum.length - 1; i >= 0; i--) {
    const p = st.fum[i]
    p.x += p.vx * dtj; p.y += p.vy * dtj; p.r += p.cresce * dtj
    p.vx *= 1 - Math.min(1, dtj * 1.2)
    p.vida -= dtj
    if (p.vida <= 0) st.fum.splice(i, 1)
  }
  for (let i = st.fag.length - 1; i >= 0; i--) {
    const p = st.fag[i]
    p.x += p.vx * dtj; p.y += p.vy * dtj; p.vy += 700 * dtj
    p.vida -= dtj
    if (p.vida <= 0) st.fag.splice(i, 1)
  }
}

/** O rival: marcas de pneu na pista, fumaça nas curvas e faísca quando você encosta. */
function passoRival(eng: AutoDashEngine, tg: Touge) {
  const dtj = st.dtj
  const r = tg.rival
  const playerZ = eng.position + PLAYER_Z
  const gap = wrapDz(eng, r.z, playerZ)
  const ang = r.ang ?? 0
  const derrapa = tg.fase === "batalha" && Math.abs(ang) > 0.12 && gap > -400 && gap < 26000
  const meia = KINDS.car.w * ROAD_WIDTH * 0.75 // meia bitola em u
  const rabo = r.offset * ROAD_WIDTH - ang * 0.4 * KINDS.car.w * 2 * ROAD_WIDTH // a traseira escapa
  if (derrapa) {
    if (!st.rivalDerrapava) { st.pistaRun++; st.pistaZ = r.z - SEG_LEN }
    if (wrapDz(eng, r.z, st.pistaZ) >= SEG_LEN * 0.5) {
      st.pistaZ = r.z
      for (let w = 0; w < 2; w++) {
        st.pista[w].push({ z: r.z - 90, lat: rabo + (w ? meia : -meia), idade: 0, run: st.pistaRun })
        if (st.pista[w].length > 90) st.pista[w].shift()
      }
    }
    // fumaça do rival: baforadas paradas no mundo (você passa por dentro delas)
    const taxa = 22 * Math.min(1, Math.abs(ang) / 0.35) * dtj
    let n = Math.floor(taxa) + (Math.random() < taxa % 1 ? 1 : 0)
    while (n-- > 0 && st.baf.length < 45) {
      const max = 1.2 + Math.random() * 0.8
      st.baf.push({
        z: r.z - 120 - Math.random() * 120, lat: rabo + (Math.random() - 0.5) * meia * 2.4, alt: 60,
        r: 260 + Math.random() * 160, vl: -Math.sign(ang) * (200 + Math.random() * 500), vida: max, max,
      })
    }
  }
  st.rivalDerrapava = derrapa
  for (const lista of st.pista) {
    for (const m of lista) m.idade += dtj
    while (lista.length && (lista[0].idade > 10 || wrapDz(eng, lista[0].z, eng.position) < 0)) lista.shift()
  }
  for (let i = st.baf.length - 1; i >= 0; i--) {
    const b = st.baf[i]
    b.lat += b.vl * dtj; b.vl *= 1 - Math.min(1, dtj * 1.5)
    b.alt += 260 * dtj; b.r += 520 * dtj
    b.vida -= dtj
    if (b.vida <= 0 || wrapDz(eng, b.z, eng.position) < 0) st.baf.splice(i, 1)
  }
  // encostou no rival: faísca no ponto de contato
  if (tg.fase === "batalha" && Math.abs(gap) < KINDS.car.len * 1.7 && Math.abs(r.offset - eng.playerX) < KINDS.car.w * 1.9 && dtj > 0) {
    const lat = (r.offset + eng.playerX) / 2 * ROAD_WIDTH
    let x = W / 2 + (r.offset - eng.playerX) * 260, y = H - 70
    if (gap > 120 && projetar(r.z - 60, lat, 120)) { x = pt.x; y = pt.y }
    const taxa = 140 * dtj
    let n = Math.floor(taxa) + (Math.random() < taxa % 1 ? 1 : 0)
    while (n-- > 0 && st.fag.length < 90) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6
      const v = 160 + Math.random() * 320
      st.fag.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 0.25 + Math.random() * 0.25, borracha: false })
    }
  }
}

// ---------- desenho: camada do mundo ----------

/** Marcas de pneu do rival na pista, como faixas finas (um preenchimento por trecho contínuo). */
const fxs: number[] = [], fys: number[] = [], fws: number[] = []
let fIdade = 99

/** Fecha um trecho de marca: um polígono fino (borda esquerda na ida, direita na volta). */
function fecharTrecho(ctx: CanvasRenderingContext2D) {
  if (fxs.length >= 2) {
    ctx.globalAlpha = 0.42 * clamp01((10 - fIdade) / 2.5)
    ctx.beginPath()
    ctx.moveTo(fxs[0] - fws[0], fys[0])
    for (let k = 1; k < fxs.length; k++) ctx.lineTo(fxs[k] - fws[k], fys[k])
    for (let k = fxs.length - 1; k >= 0; k--) ctx.lineTo(fxs[k] + fws[k], fys[k])
    ctx.closePath(); ctx.fill()
  }
  fxs.length = 0; fys.length = 0; fws.length = 0; fIdade = 99
}

function desenharMarcasPista(ctx: CanvasRenderingContext2D) {
  for (const lista of st.pista) {
    let run = -1
    for (const m of lista) {
      if (m.run !== run) { fecharTrecho(ctx); run = m.run }
      if (!projetar(m.z, m.lat)) { fecharTrecho(ctx); continue } // atrás do morro ou da câmera: corta
      fxs.push(pt.x); fys.push(pt.y); fws.push(Math.max(0.6, 55 * pt.k))
      fIdade = Math.min(fIdade, m.idade)
    }
    fecharTrecho(ctx)
  }
}

/**
 * Camada do mundo, antes do seu carro (render/player.ts): marcas de pneu (do
 * rival na pista, as suas escorregando na tela) e a fumaça do rival.
 */
export function renderTougeMundo(eng: AutoDashEngine) {
  const tg = passo(eng)
  if (!tg) return
  montarProjecao(eng)
  emitirDrift(eng, tg)
  passoParticulas(st.dtj)
  passoRival(eng, tg)
  const ctx = eng.ctx
  ctx.fillStyle = "#121214"
  desenharMarcasPista(ctx)
  // suas marcas: duas linhas de borracha que escorregam para baixo
  ctx.strokeStyle = "rgba(14,14,16,0.5)"
  ctx.lineCap = "round"
  for (const lista of st.marcas) {
    if (lista.length < 2) continue
    ctx.globalAlpha = 1
    ctx.lineWidth = 7
    ctx.beginPath()
    for (const m of lista) { if (m.corte) ctx.moveTo(m.x, m.y); else ctx.lineTo(m.x, m.y) }
    ctx.stroke()
  }
  ctx.lineCap = "butt"
  // fumaça do rival (parada no mundo: some quando chega em você)
  if (st.baf.length) {
    const tex = fumacaTex("226,232,240")
    for (const b of st.baf) {
      if (!projetar(b.z, b.lat, b.alt)) continue
      const perto = clamp01((pt.dz - PLAYER_Z * 0.7) / (PLAYER_Z * 0.9))
      const a = 0.55 * (b.vida / b.max) * perto
      if (a < 0.02) continue
      const rp = Math.min(180, b.r * pt.k)
      ctx.globalAlpha = a
      ctx.drawImage(tex, pt.x - rp, pt.y - rp, rp * 2, rp * 2)
    }
  }
  ctx.globalAlpha = 1
}

/** Camada do mundo, depois do seu carro: a fumaça das rodas, a borracha e as faíscas. */
export function renderTougeFumaca(eng: AutoDashEngine) {
  if (!eng.touge || st.tg !== eng.touge) return
  const ctx = eng.ctx
  if (st.fum.length) {
    const clara = fumacaTex("229,231,235"), escura = fumacaTex("55,65,81")
    for (const p of st.fum) {
      const v = p.vida / p.max
      ctx.globalAlpha = 0.5 * v * clamp01((p.max - p.vida) / 0.08 + 0.3)
      ctx.drawImage(p.escura ? escura : clara, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)
    }
  }
  if (st.fag.length) {
    // faíscas: um traço só para todas; borracha: quadradinhos escuros
    ctx.globalAlpha = 1
    ctx.strokeStyle = "#fde68a"
    ctx.lineWidth = 2
    ctx.beginPath()
    for (const p of st.fag) if (!p.borracha) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03) }
    ctx.stroke()
    ctx.fillStyle = "#1c1917"
    for (const p of st.fag) if (p.borracha) ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3)
  }
  ctx.globalAlpha = 1
}

// ---------- desenho: camada do HUD ----------

/** Linhas radiais saindo do centro: o impacto (rápidas) ou a câmera lenta (quase paradas). */
function linhasRadiais(ctx: CanvasRenderingContext2D, n: number, seed: number, avanco: number, comp: number, cor: string, alpha: number, largura: number) {
  const cx = W / 2, cy = H * 0.44
  ctx.globalAlpha = alpha
  ctx.strokeStyle = cor
  ctx.lineWidth = largura
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + sorteio(i, seed) * 0.35
    const r0 = W * (0.16 + sorteio(i + 50, seed) * 0.16) + ((avanco + sorteio(i + 99, seed)) % 1) * W * 0.25
    const r1 = r0 + comp * (0.5 + sorteio(i + 7, seed))
    const c = Math.cos(a), s = Math.sin(a)
    ctx.moveTo(cx + c * r0, cy + s * r0 * 0.75)
    ctx.lineTo(cx + c * r1, cy + s * r1 * 0.75)
  }
  ctx.stroke()
  ctx.globalAlpha = 1
}

/**
 * Por baixo do HUD do duelo: a câmera lenta (tinta fria acinzentada, vinheta e
 * linhas quase paradas), a vinheta vermelha do erro, as linhas do impacto e o clarão.
 */
export function renderTougeTela(eng: AutoDashEngine) {
  const tg = eng.touge
  if (!tg || st.tg !== tg) return
  const ctx = eng.ctx
  // câmera lenta: 0 no tempo normal, 1 na mais lenta (treino)
  const k = tg.fase === "batalha" ? clamp01((1 - eng.escalaTempo) / (1 - TOUGE.lentoTreino)) : 0
  if (k > 0.02) {
    ctx.fillStyle = `rgba(100,128,170,${(0.22 * k).toFixed(3)})` // acinzenta e esfria (barato: um retângulo)
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 0.9 * k
    ctx.drawImage(vinhetaTex("10,22,48"), 0, 0, W, H)
    linhasRadiais(ctx, 18, 3, st.tj * 0.12, W * 0.08, "#e0f2fe", 0.3 * k, 1.5)
  }
  // erro: vinheta vermelha rápida
  const tv = st.t - st.vermelhoT
  if (tv >= 0 && tv < st.vermelhoDur) {
    ctx.globalAlpha = st.vermelhoForca * (1 - tv / st.vermelhoDur)
    ctx.drawImage(vinhetaTex("220,38,38"), 0, 0, W, H)
    ctx.globalAlpha = 1
  }
  // dano em você: pulso vermelho curto
  const bv = st.barras[0]
  if (bv) {
    const tb = st.t - bv.batidaT
    if (tb >= 0 && tb < 0.3) { ctx.globalAlpha = 0.45 * (1 - tb / 0.3); ctx.drawImage(vinhetaTex("220,38,38"), 0, 0, W, H); ctx.globalAlpha = 1 }
  }
  // impacto: linhas de velocidade radiais por ~0,3 s
  const tr = st.t - st.raiosT
  if (tr >= 0 && tr < 0.32) linhasRadiais(ctx, 34, st.raiosSeed, tr * 2.6, W * 0.32, `rgb(${st.raiosCor})`, 0.75 * (1 - tr / 0.32), 2.5)
  // clarão
  const tf = st.t - st.flashT
  if (tf >= 0 && tf < 0.14) {
    ctx.fillStyle = `rgba(${st.flashCor},${(st.flashForca * (1 - tf / 0.14)).toFixed(3)})`
    ctx.fillRect(0, 0, W, H)
  }
  ctx.globalAlpha = 1
}

/** Texto com contorno grosso (um strokeText e um fillText; nada de sombra borrada). */
function textoForte(ctx: CanvasRenderingContext2D, txt: string, x: number, y: number, cor: string, contorno: number) {
  ctx.lineJoin = "round"
  ctx.lineWidth = contorno
  ctx.strokeStyle = "#0b1020"
  ctx.strokeText(txt, x, y)
  ctx.fillStyle = cor
  ctx.fillText(txt, x, y)
}

/** Os textos dos momentos (ENTRADA PERFEITA!, TROCA!, ERROU A CURVA...): entram grandes e assentam. */
export function renderTougeTextos(eng: AutoDashEngine) {
  const tg = eng.touge
  if (!tg || st.tg !== tg) return
  const ctx = eng.ctx
  for (let i = st.cartoes.length - 1; i >= 0; i--) if (st.t - st.cartoes[i].t0 > st.cartoes[i].dur) st.cartoes.splice(i, 1)
  const n = st.cartoes.length
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  st.cartoes.forEach((c, i) => {
    const e = c.e
    const idade = st.t - c.t0
    const velho = i < n - 1 // o anterior sobe e encolhe
    const y = H * 0.3 - (velho ? 58 : 0)
    let s = 1, dx = 0
    if (e.tipo === "impacto" || e.tipo === "acordou") s = idade < 0.18 ? 2 - easeOutBack(idade / 0.18) : 1
    else if (e.tipo === "erro") { s = idade < 0.1 ? 1.5 - 0.5 * (idade / 0.1) : 1; dx = idade < 0.4 ? Math.sin(idade * 90) * 7 * (1 - idade / 0.4) : 0 }
    else s = idade < 0.12 ? 1.35 - 0.35 * easeOut(idade / 0.12) : 1
    if (e.tipo === "acordou") s *= 1 + 0.04 * Math.sin(idade * 14)
    if (velho) s *= 0.7
    const a = clamp01(idade / 0.04) * clamp01((c.dur - idade) / 0.25)
    if (a <= 0) return
    const tam = e.tipo === "texto" ? 34 : e.tipo === "acordou" ? 52 : 46
    ctx.save()
    ctx.globalAlpha = a
    ctx.translate(W / 2 + dx, y)
    ctx.rotate(e.tipo === "erro" ? 0.03 : -0.05)
    ctx.scale(s, s)
    ctx.font = `italic bold ${tam}px ${FONTE}`
    // eco deslocado atrás (rastro de velocidade) só na entrada do impacto
    if ((e.tipo === "impacto" || e.tipo === "acordou") && idade < 0.35) {
      ctx.globalAlpha = a * 0.35 * (1 - idade / 0.35)
      ctx.fillStyle = e.cor
      ctx.fillText(e.txt, -18 - idade * 60, 0)
      ctx.globalAlpha = a
    }
    textoForte(ctx, e.txt, 0, 0, e.cor, tam * 0.2)
    if (e.sub && !velho) {
      ctx.font = `bold ${Math.round(tam * 0.38)}px ${FONTE}`
      textoForte(ctx, e.sub, 0, tam * 0.72, "#f8fafc", 5)
    }
    ctx.restore()
  })
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.lineJoin = "miter"
}

/**
 * Barra de espírito com dano animado: o pedaço perdido cai em branco e some, a
 * barra pisca abaixo de 25% e, se é o rival acordado, uma aura pulsa em volta.
 * `qual`: 0 = você, 1 = rival.
 */
export function barraTouge(eng: AutoDashEngine, qual: 0 | 1, x: number, y: number, w: number, vida: number, cor: string, nome: string, direita: boolean, acordou: boolean) {
  const ctx = eng.ctx
  const b = st.barras[qual] ?? (st.barras[qual] = novaBarra())
  const frac = clamp01(vida / 100)
  // pedaço perdido: junta o dano (o dreno contínuo vem aos pouquinhos) e solta de uma vez
  if (vida > b.base) b.base = vida
  else if (vida < b.base - 0.01) {
    if (b.desdeT <= 0) b.desdeT = st.t
    if (b.base - vida >= 2 || st.t - b.desdeT > 0.3) {
      const x0 = direita ? x + w - w * b.base / 100 : x + w * vida / 100
      const pw = w * (b.base - vida) / 100
      b.pedacos.push({ x: x0, y, w: pw, vy: -60, vida: 0.6 })
      if (b.pedacos.length > 8) b.pedacos.shift()
      if (b.base - vida >= 5) b.batidaT = st.t
      b.base = vida; b.desdeT = 0
    }
  }
  const tb = st.t - b.batidaT
  const treme = tb >= 0 && tb < 0.22 ? Math.sin(tb * 120) * 4 * (1 - tb / 0.22) : 0
  const bx = x + treme
  // aura do rival acordado: contorno pulsando e um anel que abre
  if (acordou) {
    const p = (st.t * 1.2) % 1
    ctx.strokeStyle = cor
    ctx.globalAlpha = (1 - p) * 0.7
    ctx.lineWidth = 2
    ctx.strokeRect(bx - 4 - p * 12, y - 4 - p * 8, w + 8 + p * 24, 22 + p * 16)
    ctx.globalAlpha = 0.45 + 0.35 * Math.sin(st.t * 8)
    ctx.lineWidth = 3
    ctx.strokeRect(bx - 4, y - 4, w + 8, 22)
    ctx.globalAlpha = 1
    const ta = st.t - st.acordouT
    if (ta >= 0 && ta < 0.5) { // no instante em que acorda, a barra inteira estoura na cor dele
      ctx.globalAlpha = 0.6 * (1 - ta / 0.5)
      ctx.fillStyle = cor
      ctx.fillRect(bx - 10 - ta * 30, y - 10 - ta * 20, w + 20 + ta * 60, 34 + ta * 40)
      ctx.globalAlpha = 1
    }
  }
  ctx.fillStyle = "rgba(15,23,42,0.75)"
  rr(ctx, bx - 3, y - 3, w + 6, 20, 6)
  ctx.fillStyle = "rgba(148,163,184,0.25)"
  ctx.fillRect(bx, y, w, 14)
  // abaixo de 25%: pisca entre a cor e o branco, mais rápido quanto menos sobra
  const baixa = frac < 0.25
  const pisca = baixa && Math.floor(st.t * (4 + (0.25 - frac) * 24)) % 2 === 0
  ctx.fillStyle = pisca ? "#fef2f2" : baixa && qual === 0 ? "#ef4444" : cor
  const fw = w * frac
  ctx.fillRect(direita ? bx + w - fw : bx, y, fw, 14)
  // brilho em cima da barra (faixa clara fixa: sem gradiente)
  ctx.fillStyle = "rgba(255,255,255,0.18)"
  ctx.fillRect(direita ? bx + w - fw : bx, y, fw, 4)
  if (baixa) {
    ctx.strokeStyle = "#ef4444"
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(st.t * 12)
    ctx.lineWidth = 2
    ctx.strokeRect(bx - 3, y - 3, w + 6, 20)
    ctx.globalAlpha = 1
  }
  // pedaços caindo: brancos no primeiro instante, depois caem e somem
  for (let i = b.pedacos.length - 1; i >= 0; i--) {
    const p = b.pedacos[i]
    p.vida -= st.dt
    if (p.vida <= 0) { b.pedacos.splice(i, 1); continue }
    const parado = p.vida > 0.5
    if (!parado) { p.vy += 900 * st.dt; p.y += p.vy * st.dt }
    ctx.globalAlpha = parado ? 1 : clamp01(p.vida / 0.5)
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(p.x + treme, p.y, Math.max(1, p.w), 14)
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = "#f8fafc"
  ctx.font = `bold 13px ${FONTE}`
  ctx.textAlign = direita ? "right" : "left"
  ctx.fillText(nome, direita ? bx + w : bx, y - 8)
  ctx.textAlign = "left"
}

/**
 * Apresentação do rival: uma faixa entra correndo pela tela, o nome dele bate
 * (com impacto) e a faixa sai pelo outro lado. `te` = s desde o começo.
 */
export function renderIntroTouge(eng: AutoDashEngine, tg: Touge) {
  const ctx = eng.ctx
  const T = TOUGE.introS
  const te = T - tg.introT
  const pin = easeOut(clamp01(te / 0.22))
  const pout = clamp01((te - (T - 0.35)) / 0.35)
  const desl = (1 - pin) * -W * 1.3 + pout * pout * W * 1.3
  const y0 = H * 0.3, bh = 124, inc = 40
  const rgb = hexRgb(tg.cor)
  ctx.save()
  ctx.translate(desl, 0)
  // faixa inclinada (paralelogramo), com a cor do rival em cima e embaixo
  ctx.fillStyle = "rgba(8,12,24,0.9)"
  ctx.beginPath()
  ctx.moveTo(-60 + inc, y0); ctx.lineTo(W + 60 + inc, y0); ctx.lineTo(W + 60, y0 + bh); ctx.lineTo(-60, y0 + bh)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = tg.cor
  ctx.fillRect(-60 + inc, y0, W + 120, 4)
  ctx.fillRect(-60, y0 + bh - 4, W + 120, 4)
  // riscos correndo dentro da faixa
  ctx.strokeStyle = `rgba(${rgb},0.35)`
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i < 9; i++) {
    const yy = y0 + 12 + sorteio(i, 5) * (bh - 24)
    const xx = ((te * (900 + sorteio(i, 9) * 700) + sorteio(i, 2) * W) % (W + 300)) - 150
    ctx.moveTo(xx, yy); ctx.lineTo(xx + 60 + sorteio(i, 4) * 120, yy)
  }
  ctx.stroke()
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  // "DESAFIO NA DESCIDA" desliza da direita
  const pd = easeOut(clamp01((te - 0.1) / 0.25))
  ctx.globalAlpha = pd
  ctx.fillStyle = "#94a3b8"; ctx.font = `bold 13px ${FONTE}`
  ctx.fillText("DESAFIO NA DESCIDA  ·  TOUGE", W / 2 + (1 - pd) * 160, y0 + 20)
  // o nome bate: cai grande e assenta, com impacto na hora em que encosta
  const BATE = 0.34
  if (te > 0.18) {
    const pn = clamp01((te - 0.18) / (BATE - 0.18))
    const s = te < BATE ? 3.2 - 2.2 * pn * pn : 1
    const tremor = te >= BATE && te < BATE + 0.18 ? Math.sin(te * 110) * 5 * (1 - (te - BATE) / 0.18) : 0
    ctx.save()
    ctx.globalAlpha = clamp01(pn * 1.5)
    ctx.translate(W / 2 + tremor, y0 + 62)
    ctx.rotate(-0.04)
    ctx.scale(s, s)
    ctx.font = `italic bold 58px ${FONTE}`
    if (te >= BATE) { // eco branco atrás, que some
      ctx.globalAlpha = 0.3 * clamp01(1 - (te - BATE) / 0.5)
      ctx.fillStyle = "#ffffff"
      ctx.fillText(tg.nome, 10, 3)
      ctx.globalAlpha = 1
    }
    textoForte(ctx, tg.nome, 0, 0, tg.cor, 10)
    ctx.restore()
    if (te >= BATE && !st.introBateu) {
      st.introBateu = true
      flash(rgb, 0.35); raios(rgb); socoCamera(0.07)
      eng.trauma = Math.min(1, eng.trauma + 0.25) // só câmera: o tremor do nome batendo
    }
  }
  const ps = clamp01((te - 0.5) / 0.3)
  ctx.globalAlpha = ps
  ctx.fillStyle = "#e2e8f0"; ctx.font = `13px ${FONTE}`
  ctx.fillText("cole nele nas retas · nas curvas, siga as marcas da pista", W / 2, y0 + bh - 18)
  ctx.restore()
  ctx.globalAlpha = 1
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
}
