// AutoDash — world/touge.ts. Duelo de TOUGE na descida da serra: o chefe da serra.
//
// Histórico do playtest de 16/11: "batalha de chefe: aperta na hora certa e
// escorrega" → "na serra, com drift de verdade" → "liberdade, mini boss fight"
// → "o carro tinha que fazer mais manobras" → "parece só clicar em botões
// aleatórios; os comandos têm que aparecer no lugar certo; a luta tinha que ser
// mais luta, com momentos de correr por conta e voltar para as cenas; o carro
// perde velocidade sem trocar de marcha".
//
// Desenho (pesquisa: canyon duel do NFS Carbon, SP battle do Tokyo Xtreme Racer,
// e boas práticas de QTE: o comando aparece NO CENÁRIO, com os controles normais
// do jogo, poucas vezes, e errar pune de leve):
//
// 17/11: "agora tudo controlamos, ficou só confuso". A divisão ficou assim:
//   TRECHO LIVRE → o volante é SEU (gás e câmbio automáticos).
//   CENA (curva-chave) → o CARRO PILOTA: freia, faz o drift, troca de lado e dá o
//   nitro sozinho, e o volante fica travado. Você só faz UMA coisa: SHIFT na linha
//   amarela (câmera lenta até apertar). A qualidade do SHIFT é a nota da cena.
//
// ATO 1 — CAÇA: você atrás do rival. Nos TRECHOS LIVRES você pilota: colado nele,
//   ele perde espírito; ficando para trás, você perde.
// CENAS: a linha AMARELA de entrada mostra quando apertar SHIFT (o resto é do carro).
// ULTRAPASSAGEM: no meio do duelo o rival abre a porta numa reta: passe por ele.
// ATO 2 — LIDERANÇA: você na frente; agora é ele que cola. Longe dele, ele perde.
// Fim: a barra de alguém zerou, ou acabaram as cenas.
import { type AutoDashEngine, H, PLAYER_Z } from "../engine"
import { DRAW_DIST, SEG_LEN, KMH2UPS, saveConfig } from "../data"
import { wrapDz } from "../traffic/spawner"
import { emitSmokeRodas } from "../fx/particles"
import { avisar } from "./avisos"
import { hash01 } from "./cenario"
import type { Traffic } from "../traffic/types"

export type TipoCurva = "grampo" | "s" | "rapida"
type Bloco = "livre" | "grampo" | "s" | "rapida" | "porta"

export const TOUGE = {
  // a descida: trechos livres, cenas e a ultrapassagem no meio
  roteiro: ["livre", "grampo", "livre", "s", "porta", "livre", "grampo", "livre", "s", "grampo"] as Bloco[],
  aproxSegs: 70,      // reta antes do primeiro bloco
  livreSegs: 230,     // trecho livre: curvas abertas, você pilota
  livreCurva: 3.2,
  portaSegs: 220,     // reta da ultrapassagem
  retaCena: 60,       // reta curta depois de cada cena (o nitro de saída)
  grampo: { entra: 10, segura: 34, sai: 12, curva: 6.8 },
  s: { entra: 8, perna: 22, troca: 10, sai: 8, curva: 6.2 },
  rapida: { entra: 12, segura: 26, sai: 12, curva: 4.2 },
  freioSegs: 18,      // faixa vermelha de frenagem, antes da entrada
  freioAntes: 22,     // ... começa a este tanto de segmentos antes da entrada
  perfeito: 0.12,     // s de folga do SHIFT perfeito
  bom: 0.3,           // s de folga do SHIFT bom, da TROCA e do ESPAÇO
  // drift no volante (rad): faixa verde de cada tipo, onde roda, onde perde
  zona: [0.45, 0.85] as const,
  zonaRapida: [0.3, 0.6] as const,
  roda: 1.15,
  perde: 0.18,
  abre: 0.9, fecha: 1.3, solto: 0.15, // rad/s: volante para dentro, para fora, sem volante
  lento: 0.4,         // escala do tempo na linha de entrada (câmera lenta)
  lentoTreino: 0.28,  // na cena de treino, mais lento ainda
  lentoDrift: 0.8,    // escala do tempo durante o drift
  introS: 2.6,        // s da apresentação do rival
  fase2: { perfeito: 0.09, bom: 0.22 }, // janelas com o rival acordado
  nitroSaida: 18,     // km/h de empurrão do nitro de saída (automático para quem entrou bem)
  vCena: 135,         // km/h: até onde o carro freia sozinho antes de entrar na cena
  freioAuto: 55,      // km/h por s: a freada automática
  // espírito (barras): cenas e distância
  dano: { perfeito: 22, otimo: 15, bom: 8, erro: 18 },
  // distâncias (u; ~475 u por metro: 1 km/h = 132 u/s)
  colado: 2400,       // ~5 m: perto assim do rival, quem está na frente perde espírito
  longe: 9500,        // ~20 m: longe assim, quem está atrás perde
  drenoS: 6,          // espírito por segundo pela distância
  gapCaca: 4800,      // ~10 m: o rival anda a esta distância na sua frente (na caça)
  gapLider: 4500,     // e atrás de você (na liderança)
  gapPorPonto: 40,    // u de distância por ponto de diferença entre as barras
  pontosVitoria: 3000,
  rivais: [
    { nome: "RYO", cor: "#f97316", pintura: "#f8fafc" },
    { nome: "KEN", cor: "#facc15", pintura: "#111827" },
    { nome: "NAOMI", cor: "#ec4899", pintura: "#7c3aed" },
  ],
}

export type Nota = "perfeito" | "bom" | "erro"
export type NotaCurva = "perfeito" | "otimo" | "bom" | "erro"
export type Comando = "freio" | "shift" | "drift" | "troca" | "nitro"
export type Marca = "freio" | "entrada" | "troca" | "saida" | "porta"

export interface CurvaTouge {
  tipo: TipoCurva
  freioZ: number; freioFimZ: number // faixa vermelha
  entradaZ: number; fimZ: number; dir: number
  trocaZ: number | null   // "S": onde o drift troca de lado
  treino: boolean
  nota: Nota | null       // o SHIFT (abre o drift)
  freio: boolean | null   // segurou o S na faixa?
  troca: boolean | null   // "S": trocou de lado no tempo?
  zonaT: number; curvaT: number // s com o ângulo na faixa verde / s dentro da curva
  rodou: boolean
  nitro: boolean | null   // ESPAÇO no tempo?
  final: NotaCurva | null // nota da curva, quando fecha
}

/**
 * Efeito visual pedido pelo duelo (render/tougeFx.ts consome a fila): o texto
 * estilizado, o "impact frame" dos acertos, o tremor e a vinheta vermelha dos
 * erros. Só desenho: não mexe em regra.
 */
export interface EfeitoTouge {
  tipo: "impacto" | "texto" | "erro" | "acordou"
  txt: string
  cor: string
  sub?: string
  forte?: boolean // erro grande (rodou): mais tremor e vinheta mais longa
}

export interface Touge {
  fase: "batalha" | "fim"
  papel: "caca" | "lider" // ato 1: você caça; ato 2: você lidera
  curvas: CurvaTouge[]
  atual: number          // índice da próxima cena a fechar
  porta: { z: number; fim: number; lado: number; feita: boolean } | null
  marcas: Map<number, Marca> // segmento → marca pintada na pista (render/road.ts)
  vidaVoce: number
  vidaRival: number
  rival: Traffic
  nome: string
  cor: string
  z: number; end: number // trecho do duelo
  acordou: boolean       // o rival com metade da vida
  introT: number         // s restantes da apresentação
  passou: boolean        // você passou pelo rival
  avisoT: number         // s até poder repetir um aviso de distância
  fx: EfeitoTouge[]      // efeitos visuais ainda não desenhados (render/tougeFx.ts)
}

const janelas = (eng: AutoDashEngine) => eng.touge?.acordou ? TOUGE.fase2 : { perfeito: TOUGE.perfeito, bom: TOUGE.bom }
const vUps = (eng: AutoDashEngine) => Math.max(20, eng.speed) * KMH2UPS
const ate = (eng: AutoDashEngine, z: number) => wrapDz(eng, z, eng.position + PLAYER_Z) / vUps(eng)

/** Segundos até a linha de entrada da cena (negativo: já passou). */
export function tempoAteEntrada(eng: AutoDashEngine, c: CurvaTouge): number { return ate(eng, c.entradaZ) }
/** Segundos até a linha de saída (a hora do nitro). */
export function tempoAteSaida(eng: AutoDashEngine, c: CurvaTouge): number { return ate(eng, c.fimZ) }

function dirAgora(eng: AutoDashEngine, c: CurvaTouge): number {
  if (c.trocaZ === null) return c.dir
  if (c.troca === true) return -c.dir // trocou (pode ser um tico antes da linha)
  return wrapDz(eng, c.trocaZ, eng.position + PLAYER_Z) > 0 ? c.dir : -c.dir
}

/** Faixa verde do ângulo nesta cena. */
export function zonaDa(c: CurvaTouge): readonly [number, number] { return c.tipo === "rapida" ? TOUGE.zonaRapida : TOUGE.zona }

/** A próxima coisa a fazer na cena da vez e quanto falta para a linha dela (s). */
export function comandoAtual(eng: AutoDashEngine): { cmd: Comando; t: number; c: CurvaTouge } | null {
  const tg = eng.touge
  if (!tg || tg.fase !== "batalha") return null
  const c = tg.curvas[tg.atual]
  if (!c) return null
  // o carro faz o resto sozinho: o único comando do jogador é o SHIFT da entrada
  if (c.nota === null) return { cmd: "shift", t: tempoAteEntrada(eng, c), c }
  return null
}

/** Marca pintada na pista neste segmento (render/road.ts), ou undefined. */
export function marcaNoSeg(eng: AutoDashEngine, idx: number): Marca | undefined {
  return eng.touge?.fase === "batalha" ? eng.touge.marcas.get(idx) : undefined
}

export interface RotuloMarca { txt: string; dica: string; cor: string; agora: boolean; lado: number }

/** O que o painel em cima da marca mostra: a tecla, a cor e se é a hora dela. */
export function rotuloDaMarca(eng: AutoDashEngine, idx: number): RotuloMarca | null {
  const tg = eng.touge
  const mk = marcaNoSeg(eng, idx)
  if (!tg || !mk) return null
  const at = comandoAtual(eng)
  const z = idx * SEG_LEN
  const seta = (d: number) => (d > 0 ? "▶" : "◀")
  if (mk === "porta") {
    const lado = -(tg.porta?.lado ?? 1)
    return { txt: seta(lado), dica: "ULTRAPASSE", cor: "#4ade80", agora: true, lado }
  }
  const c = tg.curvas.find(q => (mk === "freio" && q.freioZ === z) || (mk === "entrada" && q.entradaZ === z) || (mk === "troca" && q.trocaZ === z) || (mk === "saida" && q.fimZ === z))
  if (!c) return null
  const hora = !!at && at.c === c && Math.abs(at.t) < 0.35
  if (mk === "freio") return { txt: "S", dica: "SEGURA O FREIO", cor: "#ef4444", agora: hora && at!.cmd === "freio" || (at?.c === c && at.cmd === "freio" && at.t <= 0), lado: 0 }
  if (mk === "entrada") return { txt: "SHIFT", dica: "FREIO DE MÃO", cor: "#facc15", agora: hora && at!.cmd === "shift", lado: 0 }
  if (mk === "troca") return { txt: seta(-c.dir), dica: "TROCA", cor: "#38bdf8", agora: hora && at!.cmd === "troca", lado: -c.dir }
  return { txt: "ESPAÇO", dica: "NITRO", cor: "#4ade80", agora: hora && at!.cmd === "nitro", lado: 0 }
}

/**
 * Abre o duelo além do horizonte: o roteiro de trechos livres, cenas e a
 * ultrapassagem, com as marcas na pista. O rival aparece à sua frente.
 */
export function spawnTouge(eng: AutoDashEngine): boolean {
  if (eng.touge) return false
  const VIEW = DRAW_DIST * SEG_LEN, START = VIEW * 1.05
  const N = eng.segments.length
  const at = (d: number) => ((eng.position + d) % eng.trackLen + eng.trackLen) % eng.trackLen
  const z0 = at(START)
  const a = Math.floor(z0 / SEG_LEN)
  const T = TOUGE
  const curvas: CurvaTouge[] = []
  const marcas = new Map<number, Marca>()
  let porta: Touge["porta"] = null
  let i = 0
  const segIdx = (k: number) => (a + k) % N
  const poe = (c: number) => { const s = eng.segments[segIdx(i)]; s.curve = c; s.sign = undefined; i++ }
  const zDe = (k: number) => segIdx(k) * SEG_LEN
  for (let k = 0; k < T.aproxSegs; k++) poe(0)
  const lado0 = hash01(a, 3) < 0.5 ? -1 : 1
  let nCena = 0
  T.roteiro.forEach((b, n) => {
    const dir = n % 4 < 2 ? lado0 : -lado0
    if (b === "livre") {
      // curvas abertas: aqui é você pilotando, colado (ou não) no rival
      for (let k = 0; k < T.livreSegs; k++) poe(Math.sin((k / T.livreSegs) * Math.PI * 2) * T.livreCurva * dir * Math.min(1, k / 30, (T.livreSegs - k) / 30))
      return
    }
    if (b === "porta") {
      const ini = i
      for (let k = 0; k < T.portaSegs; k++) poe(0)
      porta = { z: zDe(ini + 20), fim: zDe(i - 10), lado: dir, feita: false }
      for (let k = ini + 20; k < ini + 32; k++) marcas.set(segIdx(k), "porta")
      return
    }
    // cena: faixa de freio antes, linha de entrada, (troca), linha de saída
    const entra = i
    let trocaZ: number | null = null
    if (b === "s") {
      const g = T.s
      for (let k = 0; k < g.entra; k++) poe(dir * g.curva * ((k + 1) / g.entra))
      for (let k = 0; k < g.perna; k++) poe(dir * g.curva)
      const meio = i + Math.floor(g.troca / 2)
      for (let k = 0; k < g.troca; k++) poe(dir * g.curva * (1 - 2 * (k + 1) / g.troca))
      trocaZ = zDe(meio)
      for (let k = 0; k < g.perna; k++) poe(-dir * g.curva)
      for (let k = 0; k < g.sai; k++) poe(-dir * g.curva * (1 - (k + 1) / g.sai))
    } else {
      const g = b === "grampo" ? T.grampo : T.rapida
      for (let k = 0; k < g.entra; k++) poe(dir * g.curva * ((k + 1) / g.entra))
      for (let k = 0; k < g.segura; k++) poe(dir * g.curva)
      for (let k = 0; k < g.sai; k++) poe(dir * g.curva * (1 - (k + 1) / g.sai))
    }
    const fim = i
    for (let k = 0; k < T.retaCena; k++) poe(0)
    const fa = entra - T.freioAntes
    marcas.set(segIdx(entra), "entrada") // só a linha do SHIFT é pintada: o resto o carro faz sozinho
    curvas.push({
      tipo: b, freioZ: zDe(fa), freioFimZ: zDe(fa + T.freioSegs), entradaZ: zDe(entra), fimZ: zDe(fim), dir, trocaZ,
      treino: nCena === 0, nota: null, freio: null, troca: null, zonaT: 0, curvaT: 0, rodou: false, nitro: null, final: null,
    })
    nCena++
  })
  const end = at(START + i * SEG_LEN)
  eng.zones.push({ type: "touge", z: z0, end, spawnT: 0 })
  // o chefe: carro de racha sem estado de racha (anda na velocidade que o duelo manda)
  const def = T.rivais[Math.floor(hash01(a, 9) * T.rivais.length)]
  const playerZ = eng.position + PLAYER_Z
  const zr = ((playerZ + T.gapCaca) % eng.trackLen + eng.trackLen) % eng.trackLen // (gapCaca u à frente)
  const rival: Traffic = {
    z: zr, offset: 0.25, targetOffset: 0.25, speed: eng.speed,
    kind: "car", role: "racha", color: def.pintura, blinkT: 0, prevD: T.gapCaca,
    label: def.nome, accent: def.cor,
  }
  // a descida é do duelo: tira o trânsito (e não nasce mais nenhum até acabar)
  eng.traffic = eng.traffic.filter(t => t.role === "police" || wrapDz(eng, t.z, playerZ) < -2000)
  eng.traffic.push(rival)
  eng.touge = {
    fase: "batalha", papel: "caca", curvas, atual: 0, porta, marcas, vidaVoce: 100, vidaRival: 100, rival,
    nome: def.nome, cor: def.cor, z: z0, end, acordou: false, introT: TOUGE.introS, passou: false, avisoT: 0, fx: [],
  }
  eng.roadSigns.push({ z: at(START - VIEW * 0.6), type: "drift", label: `TOUGE: ${def.nome}` })
  avisar(eng, { icone: "⛰️", titulo: `TOUGE · ${def.nome}`, dica: "cole nele; nas curvas, siga as marcas da pista", nivel: "info", z: z0, fim: end })
  eng.audio.horn()
  return true
}

/** Um comando do teclado no duelo. `false` se não era hora dele (aperto à toa não pune). */
export function comandoTouge(eng: AutoDashEngine, cmd: "freio" | "shift" | "troca" | "nitro"): boolean {
  if (cmd !== "shift") return false // freio, troca e nitro são do carro (passoTouge)
  const atual = comandoAtual(eng)
  if (!atual || atual.cmd !== "shift" || atual.t > 1.3) return false
  const { c } = atual
  const j = janelas(eng)
  const d = Math.abs(tempoAteEntrada(eng, c))
  julgarShift(eng, c, d <= j.perfeito ? "perfeito" : d <= j.bom ? "bom" : "erro")
  return true
}

/** Shift (teclado). */
export function apertouShift(eng: AutoDashEngine) { comandoTouge(eng, "shift") }

/** Pede um efeito ao render (fila curta: sem render, como nos testes, ela não cresce). */
function efeito(eng: AutoDashEngine, e: EfeitoTouge) {
  const tg = eng.touge
  if (!tg) return
  tg.fx.push(e)
  if (tg.fx.length > 6) tg.fx.shift()
}

function julgarShift(eng: AutoDashEngine, c: CurvaTouge, nota: Nota) {
  c.nota = nota
  const z = zonaDa(c)
  if (nota !== "erro") eng.driftAng = c.dir * (nota === "perfeito" ? (z[0] + z[1]) / 2 : z[0] - 0.03)
  // o texto agora é estilizado no render (render/tougeFx.ts), com impact frame no perfeito
  if (nota === "perfeito") efeito(eng, { tipo: "impacto", txt: "ENTRADA PERFEITA!", cor: "#4ade80" })
  else if (nota === "bom") efeito(eng, { tipo: "texto", txt: "ENTRADA BOA", cor: "#facc15" })
  else efeito(eng, { tipo: "erro", txt: "SAIU DE FRENTE", cor: "#ef4444" })
  if (nota === "erro") { eng.shakeT = Math.max(eng.shakeT, 0.25); eng.audio.offroad() }
  else { eng.audio.ui(); eng.pitchY -= 3 }
}

function trocar(eng: AutoDashEngine, c: CurvaTouge, ok: boolean) {
  c.troca = ok
  if (ok) {
    eng.driftAng = -eng.driftAng
    eng.trauma = Math.min(1, eng.trauma + 0.25)
    efeito(eng, { tipo: "impacto", txt: "TROCA!", cor: "#38bdf8" })
    emitSmokeRodas(eng, 10, "#e5e7eb")
  } else eng.driftAng *= 0.3
}

/** Fecha a cena: a nota é a qualidade do SHIFT (o resto o carro fez sozinho) e vai para o espírito. */
function fecharCurva(eng: AutoDashEngine, c: CurvaTouge) {
  const tg = eng.touge!
  const final: NotaCurva = c.nota === "perfeito" ? "perfeito" : c.nota === "bom" ? "otimo" : "erro"
  c.final = final
  if (final === "erro") { if (!c.treino) tg.vidaVoce = Math.max(0, tg.vidaVoce - TOUGE.dano.erro) }
  else tg.vidaRival = Math.max(0, tg.vidaRival - TOUGE.dano[final])
  const txt = { perfeito: "CURVA PERFEITA!", otimo: "BOA CURVA", bom: "BOM", erro: c.treino ? "TREINO: NA PRÓXIMA VALE" : "ERROU A CURVA" }[final]
  const cor = final === "erro" ? "#ef4444" : final === "otimo" ? "#facc15" : "#4ade80"
  const tipo: EfeitoTouge["tipo"] = final === "perfeito" ? "impacto" : final === "erro" && !c.treino ? "erro" : "texto"
  efeito(eng, { tipo, txt, cor })
  if (tipo === "erro") eng.trauma = Math.min(1, eng.trauma + 0.35)
  tg.atual++
}

/**
 * Um quadro do duelo dentro da física (sim/update.ts, logo depois da força da
 * curva): marcas que passaram, drift no volante, troca e câmera lenta.
 * Devolve a intensidade do chiado (0..1).
 */
export function passoTouge(eng: AutoDashEngine, dt: number, curva: number, centrif: number): number {
  const tg = eng.touge
  if (!tg || tg.fase !== "batalha") { eng.escalaTempo += (1 - eng.escalaTempo) * Math.min(1, dt * 4); return 0 }
  if (tg.introT > 0) tg.introT = Math.max(0, tg.introT - dt)
  const playerZ = eng.position + PLAYER_Z
  const c = tg.curvas[tg.atual]
  let lento = 1
  const cena = emCena(eng)
  // CENA: o carro pilota. O volante fica travado (sim/update.ts) e ele puxa para o
  // meio da pista e alivia na faixa de frenagem; o jogador só aperta SHIFT.
  if (cena) eng.playerX += (0 - eng.playerX) * Math.min(1, dt * 1.4)
  if (c) {
    const j = janelas(eng)
    const te = tempoAteEntrada(eng, c), ts = tempoAteSaida(eng, c)
    // frenagem automática antes da entrada (a faixa vermelha não é mais comando)
    if (c.nota === null && ate(eng, c.freioZ) <= 0 && te > 0) eng.speed = Math.max(TOUGE.vCena, eng.speed - TOUGE.freioAuto * dt)
    if (c.freio === null && ate(eng, c.freioFimZ) <= 0) c.freio = true
    if (c.nota === null && te < -j.bom) julgarShift(eng, c, "erro")
    // troca do "S": o carro troca de lado sozinho na linha, se a entrada foi boa
    if (c.trocaZ !== null && c.troca === null && c.nota && c.nota !== "erro") {
      if (ate(eng, c.trocaZ) <= 0) trocar(eng, c, true)
    }
    // nitro de saída: automático para quem entrou bem
    if (c.nitro === null && ts <= 0 && c.nota !== null) {
      c.nitro = c.nota !== "erro"
      if (c.nitro) { eng.speed += TOUGE.nitroSaida; efeito(eng, { tipo: "texto", txt: "NITRO!", cor: "#4ade80" }) }
    }
    if (c.nota !== null && c.nitro !== null && ts < 0) fecharCurva(eng, c)
    // câmera lenta na linha de entrada até o Shift
    if (c.nota === null && te < (c.treino ? 0.9 : 0.5) && te > -j.bom) lento = Math.min(lento, c.treino ? TOUGE.lentoTreino : TOUGE.lento)
  }
  // dentro de alguma cena já aberta pelo SHIFT?
  const k = tg.curvas.find(q => q.nota && wrapDz(eng, q.entradaZ, playerZ) <= 0 && wrapDz(eng, q.fimZ, playerZ) > 0)
  let chiado = 0
  if (!k || k.nota === "erro") {
    if (k) { // saiu de frente (errou o SHIFT): a curva joga para fora e a velocidade cai
      k.curvaT += dt
      eng.playerX -= centrif * 0.5 * dt
      eng.speed = Math.max(0, eng.speed - 22 * dt)
      chiado = 0.4
    }
    eng.driftAng += (0 - eng.driftAng) * Math.min(1, dt * 5)
    if (Math.abs(eng.driftAng) < 0.01) eng.driftAng = 0
  } else {
    // DRIFT AUTOMÁTICO: o carro segura o ângulo na faixa verde (no meio se o SHIFT foi
    // perfeito, na beirada se foi só bom). Ninguém mexe no volante aqui.
    const dir = dirAgora(eng, k)
    const z = zonaDa(k)
    const alvo = k.nota === "perfeito" ? (z[0] + z[1]) / 2 : z[0] + 0.04
    const ang = Math.max(0, eng.driftAng * dir)
    const novo = ang + (alvo - ang) * Math.min(1, dt * 4) + Math.abs(curva) * 0.02 * dt
    k.curvaT += dt
    k.zonaT += dt
    eng.playerX += centrif * dt
    eng.playerX += (0 - eng.playerX) * Math.min(1, dt * 1.2)
    eng.speed = Math.max(0, eng.speed + 1.5 * dt)
    eng.driftAng = dir * novo
    // fumaça das rodas traseiras (o rastro longo e a borracha ficam em render/tougeFx.ts)
    emitSmokeRodas(eng, 4, "#e5e7eb")
    if (Math.random() < 0.5) emitSmokeRodas(eng, 1, "#1f2937")
    lento = Math.min(lento, TOUGE.lentoDrift)
    chiado = 1
  }
  eng.escalaTempo += (lento - eng.escalaTempo) * Math.min(1, dt * 6)
  return chiado
}

/** Ângulo do drift em relação à curva agora (para o medidor), ou null fora de drift. */
export function anguloDrift(eng: AutoDashEngine): { ang: number; c: CurvaTouge; dir: number } | null {
  const tg = eng.touge
  if (!tg || tg.fase !== "batalha") return null
  const playerZ = eng.position + PLAYER_Z
  const k = tg.curvas.find(q => q.nota && q.nota !== "erro" && !q.rodou && wrapDz(eng, q.entradaZ, playerZ) <= 0 && wrapDz(eng, q.fimZ, playerZ) > 0)
  if (!k || (k.trocaZ !== null && k.troca === false && wrapDz(eng, k.trocaZ, playerZ) <= 0)) return null
  const dir = dirAgora(eng, k)
  return { ang: Math.max(0, eng.driftAng * dir), c: k, dir }
}

/** O duelo está correndo (o trânsito não nasce, o gás e o câmbio são automáticos). */
export function emDuelo(eng: AutoDashEngine): boolean {
  return !!eng.touge && eng.touge.fase === "batalha"
}

/** Em cena (de uma faixa de freio até a saída) ou num trecho livre? */
export function emCena(eng: AutoDashEngine): boolean {
  const tg = eng.touge
  if (!tg || tg.fase !== "batalha") return false
  const c = tg.curvas[tg.atual]
  return !!c && ate(eng, c.freioZ) < 1.2
}

/** Um quadro do duelo fora da física: o rival, a distância, a ultrapassagem e o fim. */
export function atualizarTouge(eng: AutoDashEngine, dt: number, playerZ: number) {
  const tg = eng.touge
  if (!tg) return
  const r = tg.rival
  const gap = wrapDz(eng, r.z, playerZ) // > 0: rival na frente
  if (tg.avisoT > 0) tg.avisoT -= dt
  if (tg.fase === "batalha") {
    if (eng.offroadT > 0) tg.vidaVoce = Math.max(0, tg.vidaVoce - 8 * dt)
    const p = tg.porta
    const naPorta = !!p && !p.feita && wrapDz(eng, p.z, playerZ) <= 0 && wrapDz(eng, p.fim, playerZ) > 0
    if (naPorta) {
      // ULTRAPASSAGEM: o rival encosta de um lado e tira o pé; a seta da pista mostra o outro
      r.targetOffset = r.offset = r.offset + (p!.lado * 0.75 - r.offset) * Math.min(1, dt * 2)
      r.speed = Math.max(0, eng.speed - 25)
      if (gap < -600) {
        p!.feita = true; tg.papel = "lider"; tg.passou = true
        tg.vidaRival = Math.max(0, tg.vidaRival - 15)
        efeito(eng, { tipo: "impacto", txt: `PASSOU O ${tg.nome}!`, cor: "#4ade80", sub: "AGORA SEGURA ELE ATRÁS" })
        eng.trauma = Math.min(1, eng.trauma + 0.3)
      }
    } else {
      if (p && !p.feita && wrapDz(eng, p.fim, playerZ) <= 0) {
        // a porta fechou sem você passar: ele segue na frente e você perde espírito
        p.feita = true
        tg.vidaVoce = Math.max(0, tg.vidaVoce - 15)
        efeito(eng, { tipo: "erro", txt: "NÃO PASSOU", cor: "#ef4444", sub: "ELE FECHOU A PORTA" })
      }
      // o rival anda na distância do ato (à frente na caça, atrás na liderança),
      // puxado pela diferença entre as barras; nas cenas, segue sua pilotagem
      const alvo = tg.papel === "caca"
        ? TOUGE.gapCaca + (tg.vidaRival - tg.vidaVoce) * TOUGE.gapPorPonto
        : -(TOUGE.gapLider + (tg.vidaVoce - tg.vidaRival) * TOUGE.gapPorPonto)
      // corrige devagar: o que você ganha ou perde pilotando aparece na distância
      r.speed = Math.max(0, eng.speed + Math.max(-30, Math.min(30, (alvo - gap) / 120)))
      // distância: colado tira de quem está na frente; longe tira de quem está atrás
      const d = Math.abs(gap)
      const atras = gap > 0 ? "voce" : "rival"
      if (!emCena(eng)) {
        if (d < TOUGE.colado) {
          if (atras === "voce") tg.vidaRival = Math.max(0, tg.vidaRival - TOUGE.drenoS * dt)
          else tg.vidaVoce = Math.max(0, tg.vidaVoce - TOUGE.drenoS * dt)
        } else if (d > TOUGE.longe) {
          if (atras === "voce") tg.vidaVoce = Math.max(0, tg.vidaVoce - TOUGE.drenoS * dt)
          else tg.vidaRival = Math.max(0, tg.vidaRival - TOUGE.drenoS * dt)
        }
      }
      if (tg.acordou && tg.papel === "caca" && gap > 1200 && gap < 9000) r.targetOffset = r.offset = r.offset + (Math.max(-0.75, Math.min(0.75, eng.playerX)) - r.offset) * Math.min(1, dt * 1.5)
    }
    // o rival também derrapa: a traseira abre com a curva onde ele está (desenho)
    const cr = eng.segments[Math.floor(r.z / SEG_LEN) % eng.segments.length].curve
    r.ang = Math.sign(cr) * Math.min(0.6, Math.abs(cr) * 0.09)
    // luz de freio do rival piscando na chegada de cada cena (só desenho: render/objects.ts)
    let freia = false
    for (let i = Math.max(0, tg.atual - 1); i <= tg.atual + 1 && i < tg.curvas.length; i++) {
      const d = wrapDz(eng, tg.curvas[i].entradaZ, r.z)
      if (d > -2 * SEG_LEN && d < TOUGE.freioAntes * SEG_LEN) freia = true
    }
    r.freioT = freia && Math.floor(eng.camT * 9) % 2 === 0 ? 1 : 0
    if (!tg.acordou && tg.vidaRival <= 50) {
      tg.acordou = true
      efeito(eng, { tipo: "acordou", txt: `${tg.nome} ACORDOU!`, cor: tg.cor, sub: "AS JANELAS FICARAM MENORES" })
      eng.trauma = Math.min(1, eng.trauma + 0.4)
      eng.audio.horn()
    }
    const acabou = tg.vidaVoce <= 0 || tg.vidaRival <= 0 || tg.atual >= tg.curvas.length
    if (acabou || eng.crashed) encerrarTouge(eng, !eng.crashed && tg.vidaRival < tg.vidaVoce)
    return
  }
  // fim: quem perdeu fica para trás
  if (r.alerta) {
    r.targetOffset = r.offset = r.offset + ((eng.playerX > 0 ? -0.75 : 0.75) - r.offset) * Math.min(1, dt * 2)
    if (!tg.passou && gap < -1500) {
      tg.passou = true
      eng.floaters.push({ text: `PASSOU O ${tg.nome}!`, color: "#4ade80", y: H * 0.3, life: 1.8, big: true })
    }
  }
  r.speed = Math.max(0, eng.speed + (r.alerta ? -50 : 60))
  if (Math.abs(gap) > DRAW_DIST * SEG_LEN * 0.8) { r.dead = true; eng.touge = null }
}

/** Fecha o duelo: resultado, reputação e pontos. */
export function encerrarTouge(eng: AutoDashEngine, venceu: boolean) {
  const tg = eng.touge
  if (!tg || tg.fase === "fim") return
  tg.fase = "fim"
  tg.rival.ang = 0
  tg.rival.freioT = 0
  eng.escalaTempo = 1
  tg.rival.alerta = venceu
  eng.driftAng = 0
  if (venceu) {
    eng.cfg.reputacao = (eng.cfg.reputacao ?? 0) + 1
    saveConfig(eng.cfg)
    eng.score += TOUGE.pontosVitoria
    eng.floaters.push({ text: `VOCÊ DERROTOU ${tg.nome}! +1 REP`, color: "#4ade80", y: H * 0.28, life: 2.6, big: true })
    eng.floaters.push({ text: `+${TOUGE.pontosVitoria} pontos`, color: "#f8fafc", y: H * 0.36, life: 2.2, big: false })
    eng.audio.levelUp()
  } else {
    eng.floaters.push({ text: `${tg.nome} VENCEU O TOUGE`, color: "#ef4444", y: H * 0.28, life: 2.4, big: true })
    eng.audio.horn()
  }
}
