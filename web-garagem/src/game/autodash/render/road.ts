// AutoDash — render/road.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { glowTex } from "./textures"
import { drawPickup } from "./objects"
import { drawGhost } from "./objects"
import { drawObstacle } from "./objects"
import { drawRoadSign } from "./objects"
import { drawTraffic } from "./objects"
import { drawDeco } from "./backdrop"
import { drawBridge } from "./backdrop"
import { drawTower } from "./backdrop"
import { AutoDashEngine, PLAYER_Z, H, W, type Pickup, type Obstacle, type RoadSign, NEAR_SPRITE_MIN, RUMBLE, FADE_IN_START, FADE_IN_LEN } from "../engine"
import { SEG_LEN, CAM_HEIGHT, ROAD_WIDTH, PAINTS, KMH2UPS, DRAW_DIST } from "../data"
import { segAt } from "../world/track"
import { shade, clamp, hexToRgb, mixHex } from "../math"
import { climaAtual } from "../sim/clima"
import { type Traffic, KINDS } from "../traffic/types"
import { poly } from "./primitives"
import { drawRamalSeg, drawElevadoSeg, type ElevadoSeg } from "./ramal"
import { drawTunelSeg, drawClarao, type TunelSeg } from "./tunel"
import { TUNEL } from "../world/tunel"
import { drawEnfeite, drawGuardRail, type RailSeg } from "./cenario"
import { enfeitesDoSegmento, ENF, tipoNoSeg, GUARD_RAIL } from "../world/cenario"
import { elevacao, elevacaoEm, ramalBordas, ramalPerfilOuZero, ramalNoSeg, RAMAL_ABRE, RAMAL_COLADO } from "../world/ramais"
import { drawPosto, drawPostoLoja, drawPostoTotem } from "./eventos"
import { postoMeio, postoLoja, postoTotem, postoPatio, naFaixaDoPosto } from "../world/posto"
import { type Ramal } from "../world/ramais"
import { drawHolofote, drawHelicoptero, type PontoTela } from "./policia"
import { lenteAtual } from "./fov"

const PLACA_ATALHO_DIR: RoadSign = { z: 0, type: "atalho", lado: 1 }
const PLACA_ATALHO_ESQ: RoadSign = { z: 0, type: "atalho", lado: -1 }

export function renderRoad(eng: AutoDashEngine, amb: number, fogColor: string) {
  const ctx = eng.ctx
  const N = eng.segments.length
  const baseIdx = Math.floor(eng.position / SEG_LEN) % N
  const basePct = (eng.position % SEG_LEN) / SEG_LEN
  const playerZ = eng.position + PLAYER_Z
  const pSeg = segAt(eng, playerZ)
  const pPct = (playerZ % SEG_LEN) / SEG_LEN
  const playerY = pSeg.y1 + (pSeg.y2 - pSeg.y1) * pPct
  // em cima do elevado do viaduto a câmera sobe junto (Fase 8.6)
  const camY = playerY + CAM_HEIGHT + eng.elevJogador
  const camX = eng.playerX * ROAD_WIDTH
  // FOV dinâmico (render/fov.ts): profundidade da lente e avanço da câmera que
  // mantêm o chão do jogador no mesmo ponto. Parado ou com câmera fixa, é
  // exatamente CAM_DEPTH e avanço 0 (o desenho de antes).
  const lente = lenteAtual(eng)

  // chão base com profundidade (abaixo do horizonte)
  const gg = ctx.createLinearGradient(0, H * 0.5, 0, H)
  gg.addColorStop(0, shade("#0c6b3c", amb * 0.85))
  gg.addColorStop(1, shade("#0f8a4c", amb))
  ctx.fillStyle = gg
  ctx.fillRect(-10, H * 0.5, W + 20, H * 0.5 + 10)

  const roadL = shade("#66666d", amb), roadD = shade("#616167", amb)
  // corrida: zebra roxa+branca; solo: vermelha+branca de sempre
  const rumbA = shade(eng.mode === "race" ? "#7c3aed" : "#e0342f", amb), rumbB = shade("#f1f5f9", amb)
  const laneC = shade("#f8fafc", amb)

  let x = 0
  let dx = -(eng.segments[baseIdx].curve * basePct)
  let maxY = H + 10
  // false enquanto estamos no campo próximo (asfalto ainda abaixo da tela).
  // Depois do primeiro segmento pintado, sy2 >= maxY passa a significar
  // "escondido por morro" — aí sim o segmento some inteiro.
  let roadStarted = false
  let cobriuTunel = false // dentro do túnel: o primeiro segmento já cobriu a tela

  interface SpriteDraw { kind: "car" | "pu" | "deco" | "ghost" | "obs" | "sign" | "bridge" | "gate" | "posto" | "postoLoja" | "postoTotem" | "elevado" | "tunel" | "rail"; el?: ElevadoSeg; tn?: TunelSeg; rl?: RailSeg; t?: Traffic; p?: Pickup; deco?: number; dir?: number; obs?: Obstacle; sign?: RoadSign; ramal?: Ramal; x: number; y: number; w: number; dz?: number }
  const sprites: SpriteDraw[] = []
  // buckets de tráfego, obstáculos, placas e powerups por segmento
  const obsBySeg = new Map<number, Obstacle[]>()
  for (const o of eng.obstacles) {
    const si = Math.floor(o.z / SEG_LEN) % N
    const arr = obsBySeg.get(si)
    if (arr) arr.push(o); else obsBySeg.set(si, [o])
  }
  const signBySeg = new Map<number, RoadSign[]>()
  for (const s of eng.roadSigns) {
    const si = Math.floor(s.z / SEG_LEN) % N
    const arr = signBySeg.get(si)
    if (arr) arr.push(s); else signBySeg.set(si, [s])
  }
  // viaduto = sprite pontual (passa por cima); ponte = TRECHO que você dirige
  // em cima (água + guarda-corpo por segmento, torres em 2 pontos do vão)
  const viaductSegs = new Set<number>()
  const bridgeSpan = new Set<number>()
  const towerSegs = new Set<number>()
  const wrongwaySpan = new Set<number>()
  // túnel (Fase 8.7): trecho com paredes e teto, e o segmento da boca
  const tunelSpan = new Set<number>()
  const tunelBoca = new Set<number>()
  const wrongwayRamp = new Map<number, number>()
  // alça de acesso do viaduto: por segmento, a largura do braço extra à
  // direita (1 = faixa paralela cheia, 0 = já fundiu na via)
  const viaductRamp = new Map<number, number>()
  // ruas da cidade cruzando embaixo do elevado (Fase 8.6, polimento): por
  // segmento, a posição dentro da rua (0..RUA_SEGS-1). Não cruzam a pista.
  const ruaCruzando = new Map<number, number>()
  const RUA_SEGS = 7
  for (const zn of eng.zones) {
    if (zn.type === "viaduct") {
      const a = Math.floor(zn.z / SEG_LEN) % N
      viaductSegs.add(a)
      // ALÇA: começa logo depois do cruzamento como faixa paralela cheia e
      // vai afunilando até fundir na via (a zona vermelha do teu desenho).
      // É por ela que os carros descem e entram na estrada.
      // (a alça de aceleração antiga deu lugar ao elevado, Fase 8.6)
      if (eng.ramais.some(r => r.alto)) for (const off of [-150, -70, 45, 125]) for (let i = 0; i < RUA_SEGS; i++) ruaCruzando.set(((a + off + i) % N + N) % N, i)
    }
    else if (zn.type === "bridge") {
      const a = Math.floor(zn.z / SEG_LEN) % N
      const len = ((Math.floor(zn.end / SEG_LEN) - Math.floor(zn.z / SEG_LEN)) % N + N) % N
      for (let i = 0; i <= len; i++) bridgeSpan.add((a + i) % N)
      towerSegs.add((a + Math.floor(len * 0.22)) % N)
      towerSegs.add((a + Math.floor(len * 0.78)) % N)
    } else if (zn.type === "tunnel") {
      const a = Math.floor(zn.z / SEG_LEN) % N
      const len = ((Math.floor(zn.end / SEG_LEN) - Math.floor(zn.z / SEG_LEN)) % N + N) % N
      for (let i = 0; i < len; i++) tunelSpan.add((a + i) % N)
      tunelBoca.add(a)
    } else if (zn.type === "wrongway") {
      const a = Math.floor(zn.z / SEG_LEN) % N
      const len = ((Math.floor(zn.end / SEG_LEN) - Math.floor(zn.z / SEG_LEN)) % N + N) % N
      for (let i = 0; i <= len; i++) wrongwaySpan.add((a + i) % N)
      // CONTEXTO da mão dupla: bifurcações à esquerda nas duas pontas — a rua
      // pra onde os carros da contramão VÃO (cabeceira) e a de onde eles VÊM
      // (fim da zona). f cresce com a distância da junção = via divergindo.
      for (let i = 0; i <= 14; i++) {
        wrongwayRamp.set(((a - i) % N + N) % N, i / 14)
        wrongwayRamp.set((a + len + i) % N, i / 14)
      }
    }
  }
  const bySeg = new Map<number, Traffic[]>()
  // rivais da corrida entram como sprites de trânsito (mesma projeção); o
  // `role: "oncoming"` NÃO é usado aqui — eles andam no seu sentido
  if (eng.race && eng.mode === "race") {
    for (const r of eng.race.rivais) {
      if (r.finished) continue
      const fake: Traffic = {
        z: ((r.z % eng.trackLen) + eng.trackLen) % eng.trackLen,
        offset: r.x, targetOffset: r.x, speed: r.v, kind: "car", role: "civilian",
        color: PAINTS[clamp(Math.floor(r.paint), 0, PAINTS.length - 1)],
        blinkT: 0, prevD: 1,
        label: r.nome, accent: r.cor,
      }
      const si = Math.floor(fake.z / SEG_LEN) % N
      const arr = bySeg.get(si)
      if (arr) arr.push(fake); else bySeg.set(si, [fake])
    }
  }
  for (const t of eng.traffic) {
    const si = Math.floor(t.z / SEG_LEN) % N
    const arr = bySeg.get(si)
    if (arr) arr.push(t); else bySeg.set(si, [t])
  }
  const puBySeg = new Map<number, Pickup[]>()
  for (const p of eng.powerups) {
    const si = Math.floor(p.z / SEG_LEN) % N
    const arr = puBySeg.get(si)
    if (arr) arr.push(p); else puBySeg.set(si, [p])
  }
  // holofote do helicóptero (Fase 6, E13): segmento do ponto de luz e onde ele cai na tela
  const heli = eng.policia.heli
  const heliIdx = heli ? Math.floor(heli.z / SEG_LEN) % N : -1
  let luz: PontoTela | null = null
  // bordas da pista acumuladas para o passe de brilho do asfalto
  const edgeL: number[] = []
  const edgeR: number[] = []

  // fantasma do rival no duelo (mesma pista via seed)
  let ghostIdx = -1, ghostZ = 0, ghostX = 0
  const d = eng.duel
  if (eng.mode === "duel" && d?.opp && (eng.state === "racing" || eng.state === "countdown" || eng.state === "duelspectate" || eng.state === "paused")) {
    ghostZ = ((d.oppD * KMH2UPS * 3600) % eng.trackLen + eng.trackLen) % eng.trackLen
    ghostIdx = Math.floor(ghostZ / SEG_LEN) % N
    ghostX = clamp(d.opp.x, -1.2, 1.2)
  }

  for (let n = 0; n < DRAW_DIST; n++) {
    const idx = (baseIdx + n) % N
    const seg = eng.segments[idx]
    const looped = idx < baseIdx
    const camZ = eng.position + lente.avanco - (looped ? eng.trackLen : 0)
    const z1 = idx * SEG_LEN, z2 = z1 + SEG_LEN

    const dz1 = z1 - camZ, dz2 = z2 - camZ
    const x1 = x, x2 = x + dx
    x += dx; dx += seg.curve
    if (dz1 <= lente.depth * 10) continue

    const s1 = lente.depth / dz1 * (H / 2)
    const s2 = lente.depth / dz2 * (H / 2)
    const sx1 = W / 2 + (x1 - camX) * s1 * (W / H)
    const sy1 = H / 2 - (seg.y1 - camY) * s1 / (H / 2) * (H / 2)
    const sw1 = ROAD_WIDTH * s1 * (W / H)
    const sx2 = W / 2 + (x2 - camX) * s2 * (W / H)
    const sy2 = H / 2 - (seg.y2 - camY) * s2 / (H / 2) * (H / 2)
    const sw2 = ROAD_WIDTH * s2 * (W / H)

    // visibilidade testada em float: fatias subpixel do horizonte continuam
    // emitindo sprites (senão o trânsito distante some e "pipoca" perto)
    //
    // CAMPO PRÓXIMO: a câmera fica PLAYER_Z atrás do jogador, então existe uma
    // faixa entre as duas onde o veículo está na frente da câmera (projetável)
    // mas o asfalto já cai abaixo da tela. Antes o laço pulava o segmento
    // inteiro e o carro sumia junto — era por isso que quem vinha de trás
    // "teleportava": só existia depois de já ter ultrapassado o jogador.
    // O sprite é alto e entra pela borda de baixo, então aqui a gente pula só
    // o ASFALTO e continua emitindo os veículos.
    const nearField = !roadStarted && sy2 >= maxY
    // ...mas só ATRÁS do jogador. Em cima do elevado a câmera está 4100 u acima
    // da pista e o asfalto lá embaixo fica fora da tela por um bom trecho À
    // FRENTE: ali não é campo próximo, e os carros e pickups do tabuleiro têm de
    // aparecer (playtest 16/11: carros do elevado invisíveis, e dava para bater).
    const pertoDaCamera = nearField && dz1 < PLAYER_Z - lente.avanco + SEG_LEN
    if (sy2 >= maxY && roadStarted) continue // escondido por morro: some tudo mesmo
    if (nearField && dz1 < NEAR_SPRITE_MIN) continue // tão perto que nem o topo aparece

    // arredondado SÓ pra pintar: bordas exatas, sem fresta de anti-aliasing
    const ry1 = Math.round(sy1), ry2 = Math.round(sy2)

    const alt = Math.floor(idx / RUMBLE) % 2 === 0
    const onBridge = bridgeSpan.has(idx)
    if (!nearField) {

      if (onBridge) {
        // vão da ponte: água no lugar da grama, guarda-corpo no lugar da zebra.
        // A água vai SÓ nas laterais, nunca sob o tabuleiro — mesmo motivo da
        // zebra: o fillRect de tela cheia tem altura ry1-ry2+1, e esse +1 faz
        // cada faixa invadir 1px da anterior. No horizonte, onde o segmento tem
        // 1-2px, isso empilhava e o mar cobria a pista.
        ctx.fillStyle = shade(alt ? "#14425f" : "#123c57", amb)
        poly(ctx, -10, ry1, sx1 - sw1 * 1.11, ry1, sx2 - sw2 * 1.11, ry2, -10, ry2)
        poly(ctx, sx1 + sw1 * 1.11, ry1, W + 10, ry1, W + 10, ry2, sx2 + sw2 * 1.11, ry2)
        // guarda-corpo (mureta) com friso claro no topo — o "corrimão"
        ctx.fillStyle = shade(alt ? "#9aa4b5" : "#7e8899", amb)
        poly(ctx, sx1 - sw1 * 1.11, ry1, sx1 - sw1 * 0.97, ry1, sx2 - sw2 * 0.97, ry2, sx2 - sw2 * 1.11, ry2)
        poly(ctx, sx1 + sw1 * 0.97, ry1, sx1 + sw1 * 1.11, ry1, sx2 + sw2 * 1.11, ry2, sx2 + sw2 * 0.97, ry2)
        // friso do corrimão só quando tem largura de tela (subpixel = shimmer)
        if (sw1 > 6) {
          ctx.fillStyle = shade("#d7dce6", amb)
          poly(ctx, sx1 - sw1 * 1.11, ry1, sx1 - sw1 * 1.075, ry1, sx2 - sw2 * 1.075, ry2, sx2 - sw2 * 1.11, ry2)
          poly(ctx, sx1 + sw1 * 1.075, ry1, sx1 + sw1 * 1.11, ry1, sx2 + sw2 * 1.11, ry2, sx2 + sw2 * 1.075, ry2)
        }
        // Detalhes SÓ quando o segmento tem tamanho de tela pra isso — desenhar
        // tirante/poste subpixel no horizonte era o "mistura tudo" (mesma
        // classe do antigo bleed da zebra) e pagava caro à toa.
        // ENGENHARIA: tirantes verticais (os cabos que seguram o tabuleiro)
        if (alt && sw1 > 10) {
          const hang = sw1 * 0.5
          ctx.strokeStyle = shade("#b23a30", amb)
          ctx.lineWidth = Math.max(1, sw1 * 0.012)
          ctx.beginPath()
          ctx.moveTo(sx1 - sw1 * 1.05, ry1); ctx.lineTo(sx1 - sw1 * 1.05, ry1 - hang)
          ctx.moveTo(sx1 + sw1 * 1.05, ry1); ctx.lineTo(sx1 + sw1 * 1.05, ry1 - hang)
          ctx.stroke()
        }
        // ILUMINAÇÃO: postes warm; à noite acendem com halo (sprite CACHEADO —
        // criar gradiente radial por poste por frame derrubava o FPS)
        if (idx % 6 === 0 && sw1 > 12) {
          const lh = sw1 * 0.32
          ctx.fillStyle = shade("#64748b", amb)
          ctx.fillRect(sx1 - sw1 * 1.09, ry1 - lh, Math.max(1, sw1 * 0.015), lh)
          ctx.fillRect(sx1 + sw1 * 1.075, ry1 - lh, Math.max(1, sw1 * 0.015), lh)
          const lit = amb < 0.7
          ctx.fillStyle = lit ? "#ffe9a8" : shade("#e2e8f0", amb)
          ctx.beginPath(); ctx.arc(sx1 - sw1 * 1.08, ry1 - lh, Math.max(1, sw1 * 0.022), 0, Math.PI * 2); ctx.fill()
          ctx.beginPath(); ctx.arc(sx1 + sw1 * 1.08, ry1 - lh, Math.max(1, sw1 * 0.022), 0, Math.PI * 2); ctx.fill()
          if (lit && sw1 > 26) {
            const gs = glowTex(eng), gw = sw1 * 0.6
            ctx.drawImage(gs, sx1 - sw1 * 1.08 - gw / 2, ry1 - lh - gw / 2, gw, gw)
            ctx.drawImage(gs, sx1 + sw1 * 1.08 - gw / 2, ry1 - lh - gw / 2, gw, gw)
          }
        }
      } else {
        // grama: listras sutis por cima do gradiente de base
        ctx.fillStyle = alt ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)"
        ctx.fillRect(-10, ry2, W + 20, ry1 - ry2 + 1)
        // zebra só nas laterais — nunca embaixo do asfalto (era daí que vazava o vermelho)
        ctx.fillStyle = alt ? rumbA : rumbB
        poly(ctx, sx1 - sw1 * 1.11, ry1, sx1 - sw1 * 0.97, ry1, sx2 - sw2 * 0.97, ry2, sx2 - sw2 * 1.11, ry2)
        poly(ctx, sx1 + sw1 * 0.97, ry1, sx1 + sw1 * 1.11, ry1, sx2 + sw2 * 1.11, ry2, sx2 + sw2 * 0.97, ry2)
      }
      // asfalto
      ctx.fillStyle = alt ? roadL : roadD
      poly(ctx, sx1 - sw1, ry1, sx1 + sw1, ry1, sx2 + sw2, ry2, sx2 - sw2, ry2)
      // bifurcação da mão dupla: braço de asfalto divergindo à esquerda
      const rampF1 = wrongwayRamp.get(idx)
      if (rampF1 !== undefined) {
        const rampF2 = wrongwayRamp.get((idx + 1) % N) ?? rampF1
        poly(ctx,
            sx1 - sw1 * (0.97 + 2.0 * rampF1), ry1, sx1 - sw1 * 0.97, ry1,
            sx2 - sw2 * 0.97, ry2, sx2 - sw2 * (0.97 + 2.0 * rampF2), ry2)
      }
      // alça do viaduto: faixa de aceleração à direita, afunilando até fundir
      const vrF1 = viaductRamp.get(idx)
      if (vrF1 !== undefined) {
        const vrF2 = viaductRamp.get((idx + 1) % N) ?? vrF1
        ctx.fillStyle = alt ? roadL : roadD
        poly(ctx,
            sx1 + sw1 * 0.97, ry1, sx1 + sw1 * (0.97 + 0.62 * vrF1), ry1,
            sx2 + sw2 * (0.97 + 0.62 * vrF2), ry2, sx2 + sw2 * 0.97, ry2)
        // faixa tracejada separando a alça da via (some no fim, onde funde)
        if (alt && vrF1 > 0.12) {
          ctx.fillStyle = laneC
          poly(ctx,
              sx1 + sw1 * 0.985, ry1, sx1 + sw1 * 1.0, ry1,
              sx2 + sw2 * 1.0, ry2, sx2 + sw2 * 0.985, ry2)
        }
        // zebrado de convergência no bico do afunilamento
        if (vrF1 < 0.16 && vrF1 > 0.01) {
          ctx.fillStyle = shade(alt ? "#e2e8f0" : "#94a3b8", amb)
          poly(ctx,
              sx1 + sw1 * 0.97, ry1, sx1 + sw1 * (0.97 + 0.62 * vrF1), ry1,
              sx2 + sw2 * (0.97 + 0.62 * vrF2), ry2, sx2 + sw2 * 0.97, ry2)
        }
      }
      // rua cruzando (dos dois lados, fora da pista): asfalto até a borda da tela
      const rua = ruaCruzando.get(idx)
      if (rua !== undefined) {
        ctx.fillStyle = alt ? roadL : roadD
        poly(ctx, sx1 - sw1 * 40, ry1, sx1 - sw1 * 1.14, ry1, sx2 - sw2 * 1.14, ry2, sx2 - sw2 * 40, ry2)
        poly(ctx, sx1 + sw1 * 1.14, ry1, sx1 + sw1 * 40, ry1, sx2 + sw2 * 40, ry2, sx2 + sw2 * 1.14, ry2)
        if (rua === Math.floor(RUA_SEGS / 2)) { // faixa central tracejada da rua
          ctx.fillStyle = laneC
          for (let k = 1.5; k < 14; k += 1.2) {
            poly(ctx, sx1 + sw1 * k, ry1, sx1 + sw1 * (k + 0.5), ry1, sx2 + sw2 * (k + 0.5), ry2, sx2 + sw2 * k, ry2)
            poly(ctx, sx1 - sw1 * (k + 0.5), ry1, sx1 - sw1 * k, ry1, sx2 - sw2 * k, ry2, sx2 - sw2 * (k + 0.5), ry2)
          }
        }
      }
      // ramal paralelo (atalho) dos circuitos fixos
      if (eng.ramais.length) drawRamalSeg(eng, idx, sx1, sw1, ry1, sx2, sw2, ry2, alt, roadL, roadD, rumbA, rumbB, laneC, amb)
      // linhas de faixa
      if (alt) {
        ctx.fillStyle = laneC
        for (let l = 1; l < 4; l++) {
          const lx = -1 + (2 * l) / 4
          if (l === 2 && wrongwaySpan.has(idx)) continue // o centro vira a dupla amarela
          poly(ctx,
              sx1 + sw1 * lx - sw1 * 0.012, ry1, sx1 + sw1 * lx + sw1 * 0.012, ry1,
              sx2 + sw2 * lx + sw2 * 0.012, ry2, sx2 + sw2 * lx - sw2 * 0.012, ry2)
        }
      }
      // LINHA DE CHEGADA quadriculada: sem uma marca no chão o jogador não tem
      // como saber que fechou uma volta — a pista é um loop sem referência
      if (eng.mode === "race" && idx < 9) {
        const quadros = 10
        for (let q = 0; q < quadros; q++) {
          const a1 = -1 + (2 * q) / quadros, a2 = -1 + (2 * (q + 1)) / quadros
          ctx.fillStyle = (q + idx) % 2 === 0 ? "#f8fafc" : "#0f172a"
          poly(ctx,
              sx1 + sw1 * a1, ry1, sx1 + sw1 * a2, ry1,
              sx2 + sw2 * a2, ry2, sx2 + sw2 * a1, ry2)
        }
      }
      // mão dupla: faixa dupla amarela CONTÍNUA no centro (sinalização de contramão)
      if (wrongwaySpan.has(idx)) {
        ctx.fillStyle = shade("#eab308", amb)
        poly(ctx, sx1 - sw1 * 0.042, ry1, sx1 - sw1 * 0.014, ry1, sx2 - sw2 * 0.014, ry2, sx2 - sw2 * 0.042, ry2)
        poly(ctx, sx1 + sw1 * 0.014, ry1, sx1 + sw1 * 0.042, ry1, sx2 + sw2 * 0.042, ry2, sx2 + sw2 * 0.014, ry2)
      }
      // dentro do túnel o asfalto fica no escuro (só as luzes do teto)
      if (tunelSpan.has(idx)) {
        ctx.fillStyle = "rgba(6,9,16,0.45)"
        poly(ctx, sx1 - sw1 * 1.2, ry1, sx1 + sw1 * 1.2, ry1, sx2 + sw2 * 1.2, ry2, sx2 - sw2 * 1.2, ry2)
      }
      edgeL.push(sx1 - sw1 * 1.11, ry1, sx2 - sw2 * 1.11, ry2)
      edgeR.push(sx1 + sw1 * 1.11, ry1, sx2 + sw2 * 1.11, ry2)
      maxY = sy2
      roadStarted = true
    } // fim do asfalto (pulado no campo próximo)

    // sprites deste segmento
    const carsHere = bySeg.get(idx)
    if (carsHere) {
      for (const t of carsHere) {
        // No campo próximo (entre a câmera e você) só a POLÍCIA aparece: foi
        // pra ela que isso existe, pra não "teleportar" ao vir de trás. Pro
        // trânsito comum era regressão — um carro colado atrás na sua faixa
        // era desenhado com 3x a largura do seu carro, englobando você.
        if (pertoDaCamera && t.role !== "police" && t.role !== "racha") continue
        const pct = (t.z - z1) / SEG_LEN
        const sx = sx1 + (sx2 - sx1) * pct
        const sy = sy1 + (sy2 - sy1) * pct
        const sw = sw1 + (sw2 - sw1) * pct
        // dz vai junto: perto demais da câmera a escala explode (s = CAM_DEPTH/dz)
        // e o veículo vira um bloco gigante — ver o fade no laço de desenho
        // em cima do elevado: sobe junto com o tabuleiro
        const el = t.offset > 0.95 || t.offset < -0.95 ? elevacaoEm(eng.ramais, idx, t.offset) : 0
        const sySobe = el > 0 ? sy - el * (s1 + (s2 - s1) * pct) : sy
        sprites.push({ kind: "car", t, x: sx + sw * t.offset, y: sySobe, w: sw * KINDS[t.kind].w, dz: dz1 + SEG_LEN * pct })
      }
    }
    // carros nas ruas que cruzam embaixo do elevado (vão e voltam de lado, sem
    // entrar na pista): duas mãos, uma em cada metade da rua
    const ruaAqui = ruaCruzando.get(idx)
    if (ruaAqui === 1 || ruaAqui === RUA_SEGS - 2) {
      const mao = ruaAqui === 1 ? 1 : -1, agora = performance.now() / 1000
      for (let k = 0; k < 3; k++) {
        const fase = ((agora * 0.55 * mao + k / 3 + idx * 0.37) % 1 + 1) % 1
        for (const lado of [-1, 1]) {
          const off = lado * (1.6 + fase * 9)
          const fake: Traffic = { z: z1, offset: off, targetOffset: off, speed: 60, kind: "car", role: "civilian", color: PAINTS[(idx + k * 3 + (lado > 0 ? 1 : 0)) % PAINTS.length], blinkT: 0, prevD: 1 }
          sprites.push({ kind: "car", t: fake, x: sx1 + sw1 * off, y: sy1, w: sw1 * KINDS.car.w, dz: dz1 })
        }
      }
    }
    // túnel: paredes e teto deste segmento (também no campo próximo: é o teto
    // em cima da câmera). O primeiro visto de dentro cobre a tela fora do tubo.
    if (tunelSpan.has(idx)) {
      const tY = TUNEL.altura, P = TUNEL.parede
      sprites.push({ kind: "tunel", x: 0, y: 0, w: 0, tn: {
        idx, xl1: sx1 - sw1 * P, xr1: sx1 + sw1 * P, xl2: sx2 - sw2 * P, xr2: sx2 + sw2 * P,
        yb1: sy1, yb2: sy2, yt1: sy1 - tY * s1, yt2: sy2 - tY * s2,
        boca: tunelBoca.has(idx) && !eng.dentroTunel,
        cobre: eng.dentroTunel && !cobriuTunel,
        saida: !tunelSpan.has((idx + 1) % N),
      } })
      if (eng.dentroTunel) cobriuTunel = true
    }
    // elevado do viaduto: um sprite por segmento, depois dos carros deste
    // segmento (o desenho é de trás para frente: os carros ficam por cima)
    for (const r of eng.ramais) {
      if (!r.alto) continue
      const h1 = elevacao(r, idx), h2 = elevacao(r, idx + 1)
      if (h1 <= 0 && h2 <= 0) continue
      const b1 = ramalBordas(r, ramalPerfilOuZero(r, idx)), b2 = ramalBordas(r, ramalPerfilOuZero(r, idx + 1))
      sprites.push({ kind: "elevado", x: 0, y: 0, w: 0, el: {
        r, idx,
        xi1: sx1 + r.lado * sw1 * b1.inner, xo1: sx1 + r.lado * sw1 * b1.outer,
        xi2: sx2 + r.lado * sw2 * b2.inner, xo2: sx2 + r.lado * sw2 * b2.outer,
        yd1: sy1 - h1 * s1, yd2: sy2 - h2 * s2, yg1: sy1, yg2: sy2, s1, s2, h1, h2,
        camAcima: camY > seg.y1 + h1, alt: Math.floor(idx / 3) % 2 === 0,
      } })
    }
    if (idx === heliIdx && !pertoDaCamera) {
      const pct = (heli!.z - z1) / SEG_LEN
      const sw = sw1 + (sw2 - sw1) * pct
      luz = { x: sx1 + (sx2 - sx1) * pct + sw * heli!.x, y: sy1 + (sy2 - sy1) * pct, w: sw }
    }
    // do campo próximo só saem VEÍCULOS: cenário e pickups ali ficariam
    // gigantes e sem leitura, e não é informação que o jogador precise
    if (pertoDaCamera) continue

    // guard-rail contínuo nos trechos de mata (só no solo; nada na ponte e no túnel)
    if (eng.mode !== "race" && !onBridge && !tunelSpan.has(idx) && tipoNoSeg(eng.cenario, idx) === "mata") {
      const g = GUARD_RAIL.dist
      sprites.push({ kind: "rail", x: 0, y: 0, w: 0, rl: { idx, xl1: sx1 - sw1 * g, xl2: sx2 - sw2 * g, xr1: sx1 + sw1 * g, xr2: sx2 + sw2 * g, y1: sy1, y2: sy2, s1, s2 } })
    }

    if (idx === ghostIdx) {
      const pct = (ghostZ - z1) / SEG_LEN
      const sx = sx1 + (sx2 - sx1) * pct
      const sy = sy1 + (sy2 - sy1) * pct
      const sw = sw1 + (sw2 - sw1) * pct
      sprites.push({ kind: "ghost", x: sx + sw * ghostX, y: sy, w: sw })
    }
    const pusHere = puBySeg.get(idx)
    if (pusHere) {
      for (const p of pusHere) {
        const pct = (p.z - z1) / SEG_LEN
        const sx = sx1 + (sx2 - sx1) * pct
        const sy = sy1 + (sy2 - sy1) * pct
        const sw = sw1 + (sw2 - sw1) * pct
        const el = p.offset > 0.95 ? elevacaoEm(eng.ramais, idx, p.offset) : 0
        sprites.push({ kind: "pu", p, x: sx + sw * p.offset, y: sy - el * (s1 + (s2 - s1) * pct), w: sw * 0.10 })
      }
    }
    // obstáculos, placas e ponte deste segmento
    const obsHere = obsBySeg.get(idx)
    if (obsHere) {
      for (const o of obsHere) {
        const pct = (o.z - z1) / SEG_LEN
        const sx = sx1 + (sx2 - sx1) * pct
        const sy = sy1 + (sy2 - sy1) * pct
        const sw = sw1 + (sw2 - sw1) * pct
        sprites.push({ kind: "obs", obs: o, x: sx + sw * o.offset, y: sy, w: sw * o.w })
      }
    }
    const signsHere = signBySeg.get(idx)
    if (signsHere) {
      for (const s of signsHere) {
        // placa na beira direita da pista
        sprites.push({ kind: "sign", sign: s, x: sx1 + sw1 * 1.35, y: sy1, w: sw1 * 0.11 })
      }
    }
    // placas de atalho antes da entrada de cada ramal, do lado dele
    for (const r of eng.ramais) {
      if (r.posto) { // posto: cobertura com bombas no miolo da faixa de acesso
        if (idx === postoMeio(r)) sprites.push({ kind: "posto", x: sx1, y: sy1, w: sw1, ramal: r })
        else if (idx === postoLoja(r)) sprites.push({ kind: "postoLoja", x: sx1, y: sy1, w: sw1, ramal: r })
        else if (idx === postoTotem(r)) sprites.push({ kind: "postoTotem", x: sx1, y: sy1, w: sw1, ramal: r })
        // polimento do posto: postes de luz nas pontas do pátio, calibrador,
        // lava-rápido depois da loja e a placa de SAÍDA
        const pm = postoMeio(r), pt = postoPatio(r), X = (k: number) => sx1 + r.lado * sw1 * k
        if (idx === pm - 22 || idx === pm + 22 || idx === pm + 60) sprites.push({ kind: "deco", deco: ENF.poste, x: X(pt.outer + 0.12), y: sy1, w: sw1 * 0.05 })
        if (idx === pm + 34) sprites.push({ kind: "deco", deco: ENF.calibrador, dir: 1, x: X(pt.outer + 0.18), y: sy1, w: sw1 * 0.12 })
        if (idx === pm + 46) sprites.push({ kind: "deco", deco: ENF.lavaRapido, dir: 1, x: X(pt.outer + 1.1), y: sy1, w: sw1 * 1.0 })
        if (idx === r.b - RAMAL_ABRE - RAMAL_COLADO - 10) sprites.push({ kind: "deco", deco: ENF.placaSaida, dir: 1, x: X(pt.outer + 0.2), y: sy1, w: sw1 * 0.2 })
        continue
      }
      if (idx === r.a - 50 || idx === r.a - 12) {
        sprites.push({ kind: "sign", sign: r.lado > 0 ? PLACA_ATALHO_DIR : PLACA_ATALHO_ESQ, x: sx1 + sw1 * 1.35 * r.lado, y: sy1, w: sw1 * 0.11 })
      }
    }
    if (viaductSegs.has(idx)) sprites.push({ kind: "bridge", x: sx1, y: sy1, w: sw1 })
    if (towerSegs.has(idx)) sprites.push({ kind: "gate", x: sx1, y: sy1, w: sw1 })
    // decoração de beira de estrada e placas (nada de árvore no meio da água)
    if (onBridge || tunelSpan.has(idx)) continue
    if (seg.sign) {
      sprites.push({ kind: "deco", deco: 3, dir: seg.sign, x: sx1 - sw1 * 1.35 * seg.sign, y: sy1, w: sw1 * 0.16 })
    } else if (eng.mode === "race") {
      // CORTE DE DISTÂNCIA: segmento estreito na tela = fachada de 1-2 px.
      // Emitir isso custa draw call cheia por quase nenhum pixel — era 70%
      // do frame. A névoa do horizonte esconde o corte.
      // beira limpa na corrida (só a zebra roxa marca a pista)
    } else {
      // cenário por trechos (Fase 8.4, world/cenario.ts): centro, subúrbio, campo, orla
      const noPosto = naFaixaDoPosto(eng.ramais, idx)
      const q = eng.ramais.length ? ramalNoSeg(eng.ramais, idx) : null
      for (const en of ruaCruzando.has(idx) ? [] : enfeitesDoSegmento(eng.cenario, idx, eng.bioma.arvore)) {
        // nada em cima do pátio do posto nem do ramal/elevado (os dois ficam de um lado)
        if (en.lado > 0 && noPosto) continue
        if (q && en.lado === q.r.lado && en.dist < q.outer + 0.5) continue
        if (en.kind === ENF.fiacao && (q || noPosto)) continue // o fio cruzaria o elevado/a cobertura
        sprites.push({ kind: "deco", deco: en.kind, dir: en.seed, x: sx1 + sw1 * en.lado * en.dist, y: sy1, w: sw1 * en.escala })
      }
    }
  }

  // farol alto: clarão pedindo passagem
  if (eng.beamT > 0) {
    const a = Math.min(1, eng.beamT / 0.55)
    const beam = ctx.createRadialGradient(W / 2, H * 0.62, 30, W / 2, H * 0.62, 420)
    beam.addColorStop(0, `rgba(255,250,215,${0.38 * a})`)
    beam.addColorStop(1, "rgba(255,250,215,0)")
    ctx.fillStyle = beam
    ctx.beginPath(); ctx.ellipse(W / 2, H * 0.60, 400, 215, 0, 0, Math.PI * 2); ctx.fill()
  }

  // passe de material do asfalto: sheen + espelho molhado na chuva
  if (edgeL.length >= 4) {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(edgeL[0], edgeL[1])
    for (let i = 0; i < edgeL.length; i += 2) ctx.lineTo(edgeL[i], edgeL[i + 1])
    for (let i = edgeR.length - 2; i >= 0; i -= 2) ctx.lineTo(edgeR[i], edgeR[i + 1])
    ctx.closePath()
    ctx.clip()
    const sheen = ctx.createLinearGradient(0, H * 0.45, 0, H)
    sheen.addColorStop(0, "rgba(255,255,255,0)")
    sheen.addColorStop(1, `rgba(255,255,255,${0.05 + 0.03 * amb})`)
    ctx.fillStyle = sheen
    ctx.fillRect(0, 0, W, H)
    if (eng.raining) {
      const wet = ctx.createLinearGradient(0, H * 0.45, 0, H)
      wet.addColorStop(0, "rgba(170,205,255,0.10)")
      wet.addColorStop(0.5, "rgba(170,205,255,0.03)")
      wet.addColorStop(1, "rgba(205,228,255,0.15)")
      ctx.fillStyle = wet
      ctx.fillRect(0, 0, W, H)
    }
    ctx.restore()
  }

  // farol à noite
  if ((amb < 0.62 || eng.dentroTunel) && (eng.state === "racing" || eng.state === "countdown" || eng.state === "paused")) {
    const lg = ctx.createRadialGradient(W / 2, H * 0.72, 20, W / 2, H * 0.72, 330)
    lg.addColorStop(0, `rgba(255,240,180,${(0.62 - amb) * 0.5})`)
    lg.addColorStop(1, "rgba(255,240,180,0)")
    ctx.fillStyle = lg
    ctx.beginPath()
    ctx.ellipse(W / 2, H * 0.70, 330, 150, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // o círculo de luz fica no asfalto, embaixo dos carros
  if (luz && heli && heli.cegoT <= 0) drawHolofote(ctx, luz)

  // desenha do fundo pro primeiro plano
  for (let i = sprites.length - 1; i >= 0; i--) {
    const s = sprites[i]
    if (s.kind === "car") {
      // materializa com fade no limiar em que o veículo entra em cena, em vez
      // de pipocar já em tamanho cheio (ver FADE_IN_START)
      const fade = clamp(((s.dz ?? Infinity) - FADE_IN_START) / FADE_IN_LEN, 0, 1)
      if (fade <= 0) continue
      if (fade < 1) ctx.globalAlpha = fade
      drawTraffic(eng, s.t!, s.x, s.y, s.w, amb)
      if (fade < 1) ctx.globalAlpha = 1
    }
    else if (s.kind === "pu") drawPickup(eng, s.p!, s.x, s.y, s.w, amb)
    else if (s.kind === "ghost") drawGhost(eng, s.x, s.y, s.w, amb)
    else if (s.kind === "obs") drawObstacle(eng, s.obs!, s.x, s.y, s.w, amb)
    else if (s.kind === "sign") drawRoadSign(eng, s.sign!, s.x, s.y, s.w, amb)
    else if (s.kind === "bridge") drawBridge(eng, s.x, s.y, s.w, amb, eng.ramais.some(r => !!r.alto))
    else if (s.kind === "gate") drawTower(eng, s.x, s.y, s.w, amb)
    else if (s.kind === "posto") drawPosto(eng, s.ramal!, s.x, s.y, s.w, amb)
    else if (s.kind === "postoLoja") drawPostoLoja(eng, s.ramal!, s.x, s.y, s.w, amb)
    else if (s.kind === "postoTotem") drawPostoTotem(eng, s.ramal!, s.x, s.y, s.w, amb)
    else if (s.kind === "elevado") drawElevadoSeg(eng, s.el!, amb, roadL, roadD, laneC)
    else if (s.kind === "tunel") drawTunelSeg(eng, s.tn!, amb)
    else if (s.kind === "rail") drawGuardRail(eng, s.rl!, amb)
    else if (!drawEnfeite(eng, s.deco!, s.dir ?? 0, s.x, s.y, s.w, amb)) drawDeco(eng, s.deco!, s.dir ?? 0, s.x, s.y, s.w, amb)
  }

  // névoa suave no horizonte — esfuma a pista e os sprites distantes
  const fr = hexToRgb(fogColor)
  const fogG = ctx.createLinearGradient(0, maxY - 34, 0, maxY + 120)
  fogG.addColorStop(0, `rgba(${fr[0]},${fr[1]},${fr[2]},0)`)
  fogG.addColorStop(0.25, `rgba(${fr[0]},${fr[1]},${fr[2]},${0.5 + 0.25 * amb})`)
  fogG.addColorStop(1, `rgba(${fr[0]},${fr[1]},${fr[2]},0)`)
  ctx.fillStyle = fogG
  ctx.fillRect(0, maxY - 34, W, 154)

  // visibilidade do clima (ADR 0013): neblina e chuva engolem o fundo da pista.
  // Desenhado DEPOIS dos sprites de propósito: carro e obstáculo distantes só
  // aparecem quando chegam mais perto — é o efeito de jogo, não só o visual.
  const fogK = 1 - climaAtual(eng).visib // misturado na troca de clima
  if (fogK > 0.01) {
    const fc = hexToRgb(mixHex(fogColor, amb > 0.6 ? "#d5dae2" : "#545d70", 0.6))
    const top = maxY - 60, alto = 90 + 560 * fogK
    const peak = Math.min(0.92, 1.6 * fogK)
    const g = ctx.createLinearGradient(0, top, 0, top + alto)
    g.addColorStop(0, `rgba(${fc[0]},${fc[1]},${fc[2]},${peak * 0.7})`)
    g.addColorStop(0.3, `rgba(${fc[0]},${fc[1]},${fc[2]},${peak})`)
    g.addColorStop(1, `rgba(${fc[0]},${fc[1]},${fc[2]},0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, top, W, alto)
  }

  // helicóptero por cima de tudo (até da neblina: é luz no céu)
  if (heli) drawHelicoptero(eng, luz)
  // saindo do túnel: o clarão
  drawClarao(eng, eng.claraoT, TUNEL.claraoS)
}
