// AutoDash — render/road.ts. Extraído de engine.ts (refactor sem mudança de comportamento).
import { drawPickup } from "./objects"
import { drawGhost } from "./objects"
import { drawObstacle } from "./objects"
import { drawRoadSign } from "./objects"
import { drawTraffic } from "./objects"
import { drawDeco } from "./backdrop"
import { drawBridge } from "./backdrop"
import { drawTower } from "./backdrop"
import { AutoDashEngine, PLAYER_Z, H, W, type Pickup, type Obstacle, type RoadSign, NEAR_SPRITE_MIN, RUMBLE, FADE_IN_START, FADE_IN_LEN } from "../engine"
import { SEG_LEN, CAM_HEIGHT, ROAD_WIDTH, PAINTS, KMH2UPS, DRAW_DIST, CAM_DEPTH } from "../data"
import { segAt } from "../world/track"
import { shade, clamp, hexToRgb } from "../math"
import { type Traffic, KINDS } from "../traffic/types"
import { poly } from "./primitives"

export function renderRoad(eng: AutoDashEngine, amb: number, fogColor: string) {
  const ctx = eng.ctx
  const N = eng.segments.length
  const baseIdx = Math.floor(eng.position / SEG_LEN) % N
  const basePct = (eng.position % SEG_LEN) / SEG_LEN
  const playerZ = eng.position + PLAYER_Z
  const pSeg = segAt(eng, playerZ)
  const pPct = (playerZ % SEG_LEN) / SEG_LEN
  const playerY = pSeg.y1 + (pSeg.y2 - pSeg.y1) * pPct
  const camY = playerY + CAM_HEIGHT
  const camX = eng.playerX * ROAD_WIDTH

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

  interface SpriteDraw { kind: "car" | "pu" | "deco" | "ghost" | "obs" | "sign" | "bridge" | "gate"; t?: Traffic; p?: Pickup; deco?: number; dir?: number; obs?: Obstacle; sign?: RoadSign; x: number; y: number; w: number; dz?: number }
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
  const wrongwayRamp = new Map<number, number>()
  // alça de acesso do viaduto: por segmento, a largura do braço extra à
  // direita (1 = faixa paralela cheia, 0 = já fundiu na via)
  const viaductRamp = new Map<number, number>()
  for (const zn of eng.zones) {
    if (zn.type === "viaduct") {
      const a = Math.floor(zn.z / SEG_LEN) % N
      viaductSegs.add(a)
      // ALÇA: começa logo depois do cruzamento como faixa paralela cheia e
      // vai afunilando até fundir na via (a zona vermelha do teu desenho).
      // É por ela que os carros descem e entram na estrada.
      const RAMP = 42
      for (let i = 0; i < RAMP; i++) viaductRamp.set((a + 4 + i) % N, 1 - i / RAMP)
    }
    else if (zn.type === "bridge") {
      const a = Math.floor(zn.z / SEG_LEN) % N
      const len = ((Math.floor(zn.end / SEG_LEN) - Math.floor(zn.z / SEG_LEN)) % N + N) % N
      for (let i = 0; i <= len; i++) bridgeSpan.add((a + i) % N)
      towerSegs.add((a + Math.floor(len * 0.22)) % N)
      towerSegs.add((a + Math.floor(len * 0.78)) % N)
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
    const camZ = eng.position - (looped ? eng.trackLen : 0)
    const z1 = idx * SEG_LEN, z2 = z1 + SEG_LEN

    const dz1 = z1 - camZ, dz2 = z2 - camZ
    const x1 = x, x2 = x + dx
    x += dx; dx += seg.curve
    if (dz1 <= CAM_DEPTH * 10) continue

    const s1 = CAM_DEPTH / dz1 * (H / 2)
    const s2 = CAM_DEPTH / dz2 * (H / 2)
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
            const gs = eng.glowTex(), gw = sw1 * 0.6
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
        if (nearField && t.role !== "police") continue
        const pct = (t.z - z1) / SEG_LEN
        const sx = sx1 + (sx2 - sx1) * pct
        const sy = sy1 + (sy2 - sy1) * pct
        const sw = sw1 + (sw2 - sw1) * pct
        // dz vai junto: perto demais da câmera a escala explode (s = CAM_DEPTH/dz)
        // e o veículo vira um bloco gigante — ver o fade no laço de desenho
        sprites.push({ kind: "car", t, x: sx + sw * t.offset, y: sy, w: sw * KINDS[t.kind].w, dz: dz1 + SEG_LEN * pct })
      }
    }
    // do campo próximo só saem VEÍCULOS: cenário e pickups ali ficariam
    // gigantes e sem leitura, e não é informação que o jogador precise
    if (nearField) continue

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
        sprites.push({ kind: "pu", p, x: sx + sw * p.offset, y: sy, w: sw * 0.10 })
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
    if (viaductSegs.has(idx)) sprites.push({ kind: "bridge", x: sx1, y: sy1, w: sw1 })
    if (towerSegs.has(idx)) sprites.push({ kind: "gate", x: sx1, y: sy1, w: sw1 })
    // decoração de beira de estrada e placas (nada de árvore no meio da água)
    if (onBridge) continue
    if (seg.sign) {
      sprites.push({ kind: "deco", deco: 3, dir: seg.sign, x: sx1 - sw1 * 1.35 * seg.sign, y: sy1, w: sw1 * 0.16 })
    } else if (eng.mode === "race") {
      // CORTE DE DISTÂNCIA: segmento estreito na tela = fachada de 1-2 px.
      // Emitir isso custa draw call cheia por quase nenhum pixel — era 70%
      // do frame. A névoa do horizonte esconde o corte.
      // beira limpa na corrida (só a zebra roxa marca a pista)
    } else if (idx % 4 === 0) {
      const side = idx % 8 === 0 ? -1 : 1
      sprites.push({ kind: "deco", deco: 0, x: sx1 + sw1 * side * (1.55 + ((idx * 7) % 5) * 0.14), y: sy1, w: sw1 * 0.22 })
    } else if (idx % 10 === 5) {
      sprites.push({ kind: "deco", deco: 1, x: sx1 - sw1 * 1.28, y: sy1, w: sw1 * 0.05 })
    } else if (idx % 51 === 17) {
      sprites.push({ kind: "deco", deco: 2, x: sx1 + sw1 * 1.75, y: sy1, w: sw1 * 0.55 })
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
  if (amb < 0.62 && (eng.state === "racing" || eng.state === "countdown" || eng.state === "paused")) {
    const lg = ctx.createRadialGradient(W / 2, H * 0.72, 20, W / 2, H * 0.72, 330)
    lg.addColorStop(0, `rgba(255,240,180,${(0.62 - amb) * 0.5})`)
    lg.addColorStop(1, "rgba(255,240,180,0)")
    ctx.fillStyle = lg
    ctx.beginPath()
    ctx.ellipse(W / 2, H * 0.70, 330, 150, 0, 0, Math.PI * 2)
    ctx.fill()
  }

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
    else if (s.kind === "bridge") drawBridge(eng, s.x, s.y, s.w, amb)
    else if (s.kind === "gate") drawTower(eng, s.x, s.y, s.w, amb)
    else drawDeco(eng, s.deco!, s.dir ?? 0, s.x, s.y, s.w, amb)
  }

  // névoa suave no horizonte — esfuma a pista e os sprites distantes
  const fr = hexToRgb(fogColor)
  const fogG = ctx.createLinearGradient(0, maxY - 34, 0, maxY + 120)
  fogG.addColorStop(0, `rgba(${fr[0]},${fr[1]},${fr[2]},0)`)
  fogG.addColorStop(0.25, `rgba(${fr[0]},${fr[1]},${fr[2]},${0.5 + 0.25 * amb})`)
  fogG.addColorStop(1, `rgba(${fr[0]},${fr[1]},${fr[2]},0)`)
  ctx.fillStyle = fogG
  ctx.fillRect(0, maxY - 34, W, 154)
}
