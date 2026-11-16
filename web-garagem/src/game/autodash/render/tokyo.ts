// AutoDash — render/tokyo.ts. Enfeites da cidade com cara de Tokyo Drift
// (playtest 16/11; bíblia de cenários em docs/specs/autodash/CENARIOS.md).
// Regra da bíblia: cada distrito tem 1 cor dominante + 1 de acento e o resto é
// azul-escuro; o neon é cor chapada + um halo cacheado (neonGlow), nunca luz de
// verdade, e o "molhado" é um reflexo esticado no chão. `w` é a largura do
// sprite na tela, (x, y) o pé dele no chão. Longe (w pequeno) os detalhes somem.
import { type AutoDashEngine } from "../engine"
import { shade } from "../math"
import { rr } from "./primitives"
import { neonGlow } from "./textures"
import { ENF, FIACAO } from "../world/cenario"

// paleta da bíblia (seção 1.2)
export const TK = {
  noite: "#0b0e1a", magenta: "#ff2e88", ciano: "#19e3ff", sodio: "#ffb347",
  konbini: "#3ddc97", freio: "#e6213a", led: "#f4f7ff",
}
const SHIBUYA = [TK.magenta, TK.led, TK.magenta, "#ffd43b"]
const SHINJUKU = [TK.ciano, TK.magenta, TK.ciano, TK.freio]
// cores de fachada sem neon: concreto, bege, azulejo branco, tijolo, verde e azul claros, creme, grafite
const FACHADAS = ["#9ca3af", "#d6c7a1", "#e5e7eb", "#9a4a3a", "#a7c4a0", "#9fb7cf", "#efe3c8", "#4b5563", "#c9a27e"]
const TOLDOS = ["#dc2626", "#16a34a", "#2563eb", "#f59e0b", "#7c3aed"]
const ROUPAS = ["#1f2937", "#7c2d12", "#1e3a8a", "#f8fafc", "#be185d", "#065f46", "#a16207"]

const de = <T,>(lista: readonly T[], seed: number): T => lista[Math.abs(seed) % lista.length]
const agora = () => performance.now()

/** Reflexo do neon no asfalto molhado: uma faixa esticada e translúcida no pé. */
function reflexo(ctx: CanvasRenderingContext2D, cor: string, x: number, y: number, w: number) {
  if (w < 14) return
  ctx.fillStyle = cor + "2e"
  ctx.beginPath(); ctx.ellipse(x, y + w * 0.04, w * 0.45, w * 0.1, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = cor + "18"
  ctx.fillRect(x - w * 0.12, y, w * 0.24, w * 0.22)
}

/** Fachada de distrito: corpo escuro, letreiros horizontais em 2 cores, ar-condicionado e loja acesa. */
function fachada(eng: AutoDashEngine, cores: string[], alta: boolean, seed: number, x: number, y: number, w: number, amb: number) {
  const ctx = eng.ctx
  const noite = amb < 0.62
  const bw = w * 0.9
  const h = bw * (alta ? 1.7 + (seed % 60) / 100 : 1.15 + (seed % 40) / 100)
  ctx.fillStyle = shade(seed % 3 === 0 ? "#141827" : "#181022", Math.max(0.45, amb))
  ctx.fillRect(x - bw / 2, y - h, bw, h)
  const dom = de(cores, seed), acento = de(cores, seed + 1)
  if (w < 12) { // LOD: longe é um bloco com uma faixa de cor (a névoa esconde o resto)
    ctx.fillStyle = dom
    ctx.fillRect(x - bw * 0.44, y - h * 0.8, bw * 0.88, h * 0.5)
    return
  }
  const barras = alta ? 5 : 3 + (seed % 2)
  const zona = h * 0.72, barH = zona / barras
  for (let i = 0; i < barras; i++) {
    const by = y - h + h * 0.06 + i * barH
    ctx.fillStyle = i % 2 === 0 ? dom : acento
    const larg = (i + seed) % 3 === 0 ? 0.62 : 0.88
    ctx.fillRect(x - bw / 2 + bw * 0.06, by + barH * 0.18, bw * larg, barH * 0.6)
    if (w > 22) { // "caracteres" claros no letreiro
      ctx.fillStyle = "rgba(255,255,255,0.75)"
      for (let c = 0; c < 4; c++) ctx.fillRect(x - bw / 2 + bw * (0.12 + c * 0.18 * larg), by + barH * 0.3, bw * 0.06, barH * 0.36)
    }
  }
  if (w > 14) { // aparelhos de ar-condicionado e a caixa d'água no topo
    ctx.fillStyle = shade("#9ca3af", Math.max(0.4, amb))
    for (let i = 0; i < 3; i++) ctx.fillRect(x + bw * (0.18 + (i % 2) * 0.12), y - h * (0.35 + i * 0.17), bw * 0.1, bw * 0.06)
    ctx.fillStyle = shade("#475569", Math.max(0.4, amb))
    ctx.fillRect(x - bw * 0.3, y - h - bw * 0.12, bw * 0.18, bw * 0.12)
  }
  // térreo: vitrine acesa
  ctx.fillStyle = noite ? "#fff1d6" : shade("#e2e8f0", amb)
  ctx.fillRect(x - bw * 0.42, y - h * 0.18, bw * 0.84, h * 0.13)
  if (noite && w > 70) { // halo só de noite, bem de perto e na cor forte (o branco virava névoa; eram 66 por quadro)
    const gw = bw * 1.5, halo = dom === TK.led ? acento : dom
    ctx.drawImage(neonGlow(eng, halo), x - gw / 2, y - h * 0.6 - gw * 0.35, gw, gw * 0.7)
  }
  reflexo(ctx, dom, x, y, w)
}

/** Desenha um enfeite de Tokyo. Devolve false se o `kind` não é daqui. */
export function drawTokyo(eng: AutoDashEngine, kind: number, seed: number, x: number, y: number, w: number, amb: number): boolean {
  const ctx = eng.ctx
  const noite = amb < 0.62
  const luz = Math.max(0.4, amb)
  switch (kind) {
    case ENF.fachadaShibuya: fachada(eng, SHIBUYA, false, seed, x, y, w, amb); return true
    case ENF.fachadaShinjuku: fachada(eng, SHINJUKU, true, seed, x, y, w, amb); return true
    case ENF.telaLED: {
      // prédio com tela gigante (a "vitrine" de Shibuya): a imagem troca devagar
      const bw = w * 0.9, h = bw * (2.2 + (seed % 50) / 100)
      ctx.fillStyle = shade(TK.noite, Math.max(0.5, amb))
      ctx.fillRect(x - bw / 2, y - h, bw, h)
      const tx = x - bw * 0.42, ty = y - h + bw * 0.12, tw = bw * 0.84, th = h * 0.36
      const quadro = Math.floor(agora() / 1400 + (seed % 7))
      const cores = [TK.magenta, TK.ciano, TK.led, "#ffd43b", "#7c3aed"]
      if (w < 12) { ctx.fillStyle = de(cores, quadro); ctx.fillRect(tx, ty, tw, th); return true } // LOD
      // quadro da tela: fundo + duas faixas e um "rosto"/logo redondo
      ctx.fillStyle = de(cores, quadro)
      ctx.fillRect(tx, ty, tw, th)
      ctx.fillStyle = de(cores, quadro + 2)
      ctx.fillRect(tx, ty + th * 0.62, tw, th * 0.2)
      ctx.fillStyle = de(cores, quadro + 3)
      ctx.beginPath(); ctx.arc(tx + tw * (0.3 + (quadro % 3) * 0.2), ty + th * 0.36, th * 0.22, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = shade("#1f2937", luz); ctx.lineWidth = Math.max(1, bw * 0.02)
      ctx.strokeRect(tx, ty, tw, th)
      if (noite && w > 8) { // janelas embaixo da tela
        ctx.fillStyle = "rgba(244,247,255,0.45)"
        for (let wy = ty + th + bw * 0.1; wy < y - bw * 0.2; wy += Math.max(3, bw * 0.12))
          for (let k = 0; k < 4; k++) if ((seed + k * 5 + Math.floor(wy)) % 3 === 0) ctx.fillRect(x - bw * 0.4 + k * bw * 0.22, wy, bw * 0.12, bw * 0.05)
      }
      if (noite && w > 70) {
        const gw = bw * 1.7, halo = de(cores, quadro) === TK.led ? TK.ciano : de(cores, quadro)
        ctx.drawImage(neonGlow(eng, halo), x - gw / 2, ty + th / 2 - gw / 2, gw, gw)
      }
      reflexo(ctx, de(cores, quadro), x, y, w)
      return true
    }
    case ENF.izakaya: {
      // izakaya: frente de madeira, cortina noren e fileira de lanternas vermelhas
      const bw = w, h = w * 0.6
      ctx.fillStyle = shade("#3b2516", luz)
      ctx.fillRect(x - bw / 2, y - h, bw, h)
      ctx.fillStyle = shade("#1f1a17", luz) // telhadinho
      ctx.fillRect(x - bw * 0.55, y - h - w * 0.06, bw * 1.1, w * 0.07)
      ctx.fillStyle = noite ? "#ffd59a" : shade("#fde68a", luz) // porta acesa
      ctx.fillRect(x - bw * 0.18, y - h * 0.62, bw * 0.36, h * 0.62)
      ctx.fillStyle = shade("#1e3a8a", Math.max(0.55, amb)) // noren em 3 panos
      for (let k = 0; k < 3; k++) ctx.fillRect(x - bw * 0.18 + k * bw * 0.122, y - h * 0.62, bw * 0.11, h * 0.26)
      const n = 5
      for (let k = 0; k < n; k++) {
        const lx = x - bw * 0.42 + (k / (n - 1)) * bw * 0.84, ly = y - h * 0.86
        ctx.fillStyle = TK.freio
        ctx.beginPath(); ctx.ellipse(lx, ly, w * 0.045, w * 0.07, 0, 0, Math.PI * 2); ctx.fill()
        if (w > 14) { ctx.fillStyle = "#1f1a17"; ctx.fillRect(lx - w * 0.03, ly - w * 0.075, w * 0.06, w * 0.015) }
      }
      if (noite && w > 20) {
        const gw = bw * 1.6
        ctx.drawImage(neonGlow(eng, TK.freio), x - gw / 2, y - h * 0.86 - gw * 0.3, gw, gw * 0.6)
      }
      reflexo(ctx, TK.freio, x, y, w * 0.8)
      return true
    }
    case ENF.maquinaBebida: {
      // duas máquinas de bebida lado a lado: painel aceso e fileiras de garrafinhas
      const h = w * 1.25, mw = w * 0.48
      for (let m = 0; m < 2; m++) {
        const mx = x - w / 2 + m * w * 0.52
        ctx.fillStyle = shade(m === 0 ? "#f8fafc" : (seed % 2 ? "#dc2626" : "#2563eb"), luz)
        rr(ctx, mx, y - h, mw, h, w * 0.03)
        ctx.fillStyle = noite ? "#f4f7ff" : shade("#e0f2fe", luz)
        ctx.fillRect(mx + mw * 0.1, y - h * 0.92, mw * 0.8, h * 0.45)
        if (w > 10) {
          const cores = ["#ef4444", "#22c55e", "#f59e0b", "#3b82f6", "#a855f7"]
          for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
            ctx.fillStyle = cores[(r * 4 + c + m + seed) % cores.length]
            ctx.fillRect(mx + mw * (0.15 + c * 0.19), y - h * (0.86 - r * 0.14), mw * 0.1, h * 0.08)
          }
        }
        ctx.fillStyle = shade("#111827", luz) // boca de saída
        ctx.fillRect(mx + mw * 0.2, y - h * 0.22, mw * 0.6, h * 0.08)
      }
      if (noite && w > 16) {
        const gw = w * 2
        ctx.drawImage(neonGlow(eng, TK.konbini), x - gw / 2, y - h * 0.6 - gw / 2, gw, gw)
      }
      reflexo(ctx, TK.led, x, y, w * 1.4)
      return true
    }
    case ENF.konbini: {
      // loja 24h: caixa branca, faixa verde-menta e azul, vitrine grande acesa
      const bw = w, h = w * 0.48
      ctx.fillStyle = shade("#f1f5f9", luz)
      ctx.fillRect(x - bw / 2, y - h, bw, h)
      ctx.fillStyle = TK.konbini
      ctx.fillRect(x - bw / 2, y - h, bw, h * 0.14)
      ctx.fillStyle = shade("#2563eb", Math.max(0.6, amb))
      ctx.fillRect(x - bw / 2, y - h + h * 0.14, bw, h * 0.05)
      ctx.fillStyle = noite ? "#f4f7ff" : shade("#bae6fd", luz)
      ctx.fillRect(x - bw * 0.44, y - h * 0.68, bw * 0.88, h * 0.62)
      if (w > 20) { // prateleiras vistas pela vitrine
        ctx.fillStyle = "rgba(100,116,139,0.55)"
        for (let k = 0; k < 3; k++) ctx.fillRect(x - bw * 0.4, y - h * (0.55 - k * 0.16), bw * 0.8, Math.max(1, h * 0.03))
      }
      if (noite && w > 20) {
        const gw = bw * 1.8
        ctx.drawImage(neonGlow(eng, TK.konbini), x - gw / 2, y - h * 0.5 - gw * 0.35, gw, gw * 0.7)
      }
      reflexo(ctx, TK.konbini, x, y, w)
      return true
    }
    case ENF.fiacao: {
      // poste de concreto com transformador e o emaranhado de fios atravessando a
      // rua até o poste do outro lado. O par fica na mesma distância à direita:
      // meia-pista = w / escala, e o poste esquerdo está em −dist meias-pistas.
      const hw = w / FIACAO.escala
      const xr = x + 2 * FIACAO.dist * hw
      const ph = hw * 0.95, pw = Math.max(1, w * 0.35)
      ctx.fillStyle = shade("#6b7280", luz)
      ctx.fillRect(x - pw / 2, y - ph, pw, ph)
      ctx.fillRect(xr - pw / 2, y - ph, pw, ph)
      ctx.fillStyle = shade("#374151", luz) // travessas
      ctx.fillRect(x - hw * 0.08, y - ph * 0.94, hw * 0.16, Math.max(1, hw * 0.012))
      ctx.fillRect(xr - hw * 0.08, y - ph * 0.94, hw * 0.16, Math.max(1, hw * 0.012))
      ctx.fillRect(x - hw * 0.05, y - ph * 0.84, hw * 0.1, Math.max(1, hw * 0.01))
      if (hw > 30) { // transformador
        ctx.fillStyle = shade("#9ca3af", luz)
        rr(ctx, x - pw * 2.2, y - ph * 0.78, pw * 1.6, hw * 0.07, pw * 0.3)
      }
      // fios: catenárias entre os dois postes, mais um par saindo para o lado
      ctx.strokeStyle = noite ? "rgba(15,23,42,0.85)" : "rgba(30,41,59,0.7)"
      ctx.lineWidth = Math.max(0.6, hw * 0.004)
      ctx.beginPath()
      for (let k = 0; k < 4; k++) {
        const fy = y - ph * (0.94 - k * 0.035), sag = hw * (0.1 + k * 0.03)
        ctx.moveTo(x, fy); ctx.quadraticCurveTo((x + xr) / 2, fy + sag, xr, fy + (k === 3 ? hw * 0.02 : 0))
      }
      ctx.moveTo(x, y - ph * 0.9); ctx.quadraticCurveTo(x - hw * 0.6, y - ph * 0.75, x - hw * 1.6, y - ph * 0.7)
      ctx.moveTo(xr, y - ph * 0.9); ctx.quadraticCurveTo(xr + hw * 0.6, y - ph * 0.78, xr + hw * 1.6, y - ph * 0.74)
      ctx.stroke()
      return true
    }
    case ENF.pneus: {
      // pilhas de pneus usados na porta da oficina
      const pw = w * 0.45, ph = w * 0.16
      for (let p = 0; p < 2; p++) {
        const px = x - w * 0.25 + p * w * 0.5
        const n = 3 + ((seed >> p) % 3)
        for (let k = 0; k < n; k++) {
          const py = y - k * ph * 0.95
          ctx.fillStyle = shade("#111827", luz)
          ctx.beginPath(); ctx.ellipse(px, py - ph / 2, pw / 2, ph / 2, 0, 0, Math.PI * 2); ctx.fill()
          if (w > 10) { ctx.fillStyle = shade("#374151", luz); ctx.fillRect(px - pw * 0.42, py - ph * 0.55, pw * 0.84, Math.max(1, ph * 0.12)) }
        }
      }
      return true
    }
    case ENF.galpao: {
      // galpão de tuning: chapa ondulada, porta de enrolar meio aberta, luz
      // branca lá dentro e um carro no elevador
      const bw = w, h = w * 0.62
      ctx.fillStyle = shade(seed % 2 ? "#4b5563" : "#52525b", luz)
      ctx.fillRect(x - bw / 2, y - h, bw, h)
      ctx.fillStyle = shade("#374151", luz) // telhado em arco baixo
      ctx.beginPath(); ctx.moveTo(x - bw / 2, y - h); ctx.quadraticCurveTo(x, y - h - w * 0.14, x + bw / 2, y - h); ctx.closePath(); ctx.fill()
      if (w > 20) {
        ctx.fillStyle = "rgba(255,255,255,0.08)"
        for (let k = 0; k < 12; k++) ctx.fillRect(x - bw / 2 + k * bw / 12, y - h, Math.max(1, bw * 0.012), h)
      }
      const px = x - bw * 0.36, pw = bw * 0.52, ph = h * 0.7
      ctx.fillStyle = noite ? "#f4f7ff" : shade("#e5e7eb", luz) // interior aceso
      ctx.fillRect(px, y - ph * 0.55, pw, ph * 0.55)
      ctx.fillStyle = shade("#9ca3af", luz) // porta de enrolar
      ctx.fillRect(px, y - ph, pw, ph * 0.45)
      if (w > 16) { // carro no elevador
        ctx.fillStyle = shade(de(["#f97316", "#e11d48", "#0ea5e9", "#facc15", "#f8fafc"], seed), Math.max(0.6, amb))
        rr(ctx, px + pw * 0.15, y - ph * 0.48, pw * 0.7, ph * 0.14, ph * 0.04)
        ctx.fillStyle = "#111827"
        ctx.beginPath(); ctx.arc(px + pw * 0.28, y - ph * 0.33, ph * 0.05, 0, Math.PI * 2); ctx.arc(px + pw * 0.72, y - ph * 0.33, ph * 0.05, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = shade("#facc15", luz) // colunas do elevador
        ctx.fillRect(px + pw * 0.08, y - ph * 0.5, pw * 0.03, ph * 0.5)
        ctx.fillRect(px + pw * 0.89, y - ph * 0.5, pw * 0.03, ph * 0.5)
      }
      // letreiro verde e branco
      ctx.fillStyle = TK.konbini
      ctx.fillRect(x + bw * 0.2, y - h * 0.9, bw * 0.26, h * 0.22)
      if (w > 40) {
        ctx.fillStyle = TK.noite
        ctx.font = `bold ${Math.round(h * 0.13)}px 'Space Grotesk', 'Segoe UI', sans-serif`
        ctx.textAlign = "center"; ctx.fillText("TUNE", x + bw * 0.33, y - h * 0.74); ctx.textAlign = "left"
      }
      if (noite && w > 8) reflexo(ctx, TK.led, px + pw / 2, y, pw)
      return true
    }
    case ENF.multidao: {
      // gente na calçada: silhuetas de alturas diferentes, algumas com guarda-chuva transparente
      const n = 4 + (seed % 3)
      for (let k = 0; k < n; k++) {
        const px = x - w / 2 + (k + 0.5) * (w / n), ph = w * (0.55 + ((seed >> k) % 5) * 0.04)
        const bal = Math.sin(agora() / 400 + k * 1.7) * w * 0.01
        ctx.fillStyle = shade(de(["#1f2937", "#334155", "#4c1d95", "#0f172a", "#475569"], seed + k), luz)
        rr(ctx, px - w * 0.045 + bal, y - ph * 0.82, w * 0.09, ph * 0.82, w * 0.02)
        ctx.beginPath(); ctx.arc(px + bal, y - ph * 0.9, w * 0.035, 0, Math.PI * 2); ctx.fill()
        if ((seed + k) % 3 === 0) {
          ctx.fillStyle = "rgba(244,247,255,0.32)"
          ctx.beginPath(); ctx.arc(px + bal, y - ph * 1.0, w * 0.1, Math.PI, 0); ctx.fill()
        }
      }
      if (noite) reflexo(ctx, TK.magenta, x, y, w * 0.6)
      return true
    }
    case ENF.lojinha: {
      // lojinha de 1–2 andares: fachada de cor própria, toldo listrado, vitrine e plaquinha
      const bw = w, andares = 1 + (seed % 2), h = w * (0.38 + andares * 0.2)
      ctx.fillStyle = shade(de(FACHADAS, seed), luz)
      ctx.fillRect(x - bw / 2, y - h, bw, h)
      if (w < 10) return true
      ctx.fillStyle = noite ? "#ffe8b8" : shade("#cfe6f5", luz) // vitrine
      ctx.fillRect(x - bw * 0.4, y - h * (andares > 1 ? 0.45 : 0.62), bw * 0.8, h * (andares > 1 ? 0.38 : 0.5))
      const toldo = de(TOLDOS, seed >> 2), ty = y - h * (andares > 1 ? 0.5 : 0.7)
      for (let k = 0; k < 6; k++) { // toldo listrado
        ctx.fillStyle = k % 2 ? shade("#f8fafc", luz) : shade(toldo, Math.max(0.55, amb))
        ctx.fillRect(x - bw * 0.48 + k * bw * 0.16, ty, bw * 0.16, h * 0.1)
      }
      if (andares > 1 && w > 16) { // janela do andar de cima, fixa (não pisca)
        ctx.fillStyle = noite && seed % 3 ? "#fde68a" : shade("#475569", luz)
        ctx.fillRect(x - bw * 0.32, y - h * 0.9, bw * 0.24, h * 0.18)
        ctx.fillRect(x + bw * 0.08, y - h * 0.9, bw * 0.24, h * 0.18)
      }
      // plaquinha (neon só em uma de cada três)
      ctx.fillStyle = seed % 3 === 0 ? de([TK.magenta, TK.ciano, TK.freio, TK.konbini], seed >> 4) : shade("#f1f5f9", luz)
      ctx.fillRect(x - bw * 0.25, ty - h * 0.14, bw * 0.5, h * 0.11)
      return true
    }
    case ENF.predioJP: {
      // prédio de 3 a 10 andares, de cor, largura e topo próprios. Janelas em FAIXA
      // por andar (um retângulo de vidro) e as acesas escolhidas pelo índice do
      // andar e da coluna: não piscam quando o prédio anda na tela.
      const andares = 3 + (seed % 8), bw = w * (0.8 + ((seed >> 3) % 30) / 100)
      const ah = bw * 0.22, h = ah * andares + bw * 0.1
      const cor = de(FACHADAS, seed >> 1)
      ctx.fillStyle = shade(cor, luz)
      ctx.fillRect(x - bw / 2, y - h, bw, h)
      if (w < 10) return true
      const vidro = shade(noite ? "#1e293b" : "#7aa2c4", luz)
      if (w < 18) { // LOD: meia distância, o vidro é um bloco só
        ctx.fillStyle = vidro
        ctx.fillRect(x - bw * 0.42, y - h + ah * 0.3, bw * 0.84, h - ah * 0.9)
        return true
      }
      const cols = 3 + (seed % 2)
      for (let a = 0; a < andares; a++) {
        const fy = y - bw * 0.1 - (a + 1) * ah + ah * 0.25
        ctx.fillStyle = vidro
        ctx.fillRect(x - bw * 0.42, fy, bw * 0.84, ah * 0.5)
        if (noite && w > 14) {
          ctx.fillStyle = (a + seed) % 4 === 0 ? "#cfe3ff" : "#fde68a"
          for (let c = 0; c < cols; c++) if ((a * 7 + c * 3 + seed) % 5 < 2) ctx.fillRect(x - bw * 0.42 + c * bw * 0.84 / cols + bw * 0.02, fy + ah * 0.06, bw * 0.84 / cols - bw * 0.04, ah * 0.38)
        }
        if (seed % 2 && w > 20) { ctx.fillStyle = shade("#64748b", luz); ctx.fillRect(x - bw / 2, fy + ah * 0.55, bw, Math.max(1, ah * 0.08)) } // varanda
      }
      ctx.fillStyle = noite ? "#fff1d6" : shade("#e2e8f0", luz) // térreo
      ctx.fillRect(x - bw * 0.4, y - bw * 0.1 - ah * 0.6, bw * 0.8, ah * 0.5)
      // topo: caixa d'água, outdoor no teto ou nada
      const topo = (seed >> 5) % 3
      if (topo === 0) { ctx.fillStyle = shade("#94a3b8", luz); ctx.fillRect(x + bw * 0.1, y - h - bw * 0.14, bw * 0.2, bw * 0.14) }
      else if (topo === 1 && w > 14) {
        ctx.fillStyle = shade("#334155", luz); ctx.fillRect(x - bw * 0.36, y - h - bw * 0.06, bw * 0.03, bw * 0.06); ctx.fillRect(x + bw * 0.33, y - h - bw * 0.06, bw * 0.03, bw * 0.06)
        ctx.fillStyle = de([TK.magenta, TK.ciano, "#ffd43b", TK.led], seed >> 7)
        ctx.fillRect(x - bw * 0.4, y - h - bw * 0.28, bw * 0.8, bw * 0.22)
      }
      // letreiro vertical na quina (um em cada três)
      if (seed % 3 === 0 && w > 12) {
        ctx.fillStyle = de([TK.magenta, TK.ciano, TK.freio], seed >> 9)
        ctx.fillRect(x + bw * 0.5, y - h * 0.85, bw * 0.1, h * 0.5)
      }
      return true
    }
    case ENF.estacionamento: {
      // terreno de estacionamento: chão, cerquinha, dois carros e o poste com a placa P
      ctx.fillStyle = shade("#3f3f46", luz)
      ctx.fillRect(x - w / 2, y - w * 0.04, w, w * 0.04)
      if (w < 10) return true
      ctx.fillStyle = shade("#a1a1aa", luz)
      ctx.fillRect(x - w / 2, y - w * 0.09, w, Math.max(1, w * 0.012))
      for (let k = 0; k < 2; k++) {
        const cx = x - w * 0.22 + k * w * 0.42
        ctx.fillStyle = shade(de(["#e11d48", "#f8fafc", "#1f2937", "#0ea5e9", "#facc15"], seed + k * 3), Math.max(0.5, amb))
        rr(ctx, cx - w * 0.14, y - w * 0.13, w * 0.28, w * 0.09, w * 0.02)
        ctx.fillStyle = shade("#0f172a", luz); ctx.fillRect(cx - w * 0.09, y - w * 0.17, w * 0.18, w * 0.05)
      }
      ctx.fillStyle = shade("#475569", luz); ctx.fillRect(x + w * 0.44, y - w * 0.45, Math.max(1, w * 0.02), w * 0.45)
      ctx.fillStyle = "#2563eb"; ctx.fillRect(x + w * 0.39, y - w * 0.5, w * 0.12, w * 0.1)
      if (w > 24) { ctx.fillStyle = "#f8fafc"; ctx.font = `bold ${Math.round(w * 0.08)}px 'Space Grotesk', sans-serif`; ctx.textAlign = "center"; ctx.fillText("P", x + w * 0.45, y - w * 0.42); ctx.textAlign = "left" }
      return true
    }
    case ENF.pedestres: {
      // gente andando na calçada: pernas em passo, bolsa ou guarda-chuva, cada um
      // no seu ritmo; o grupo desliza devagar para um lado (o sentido vem do seed)
      if (w < 6) return true // longe: gente de 1 px não vale o custo
      const n = 1 + (seed % 3), sentido = seed % 2 ? 1 : -1
      const t = agora() / 1000
      for (let k = 0; k < n; k++) {
        const ph = t * (2.2 + k * 0.3) + k * 1.9
        const px = x + ((((t * 0.06 * sentido + k * 0.37 + (seed % 97) / 97) % 1) + 1) % 1 - 0.5) * w
        const ph2 = Math.sin(ph * Math.PI)
        const ht = w * (0.62 + ((seed >> k) % 4) * 0.04)
        const roupa = shade(de(ROUPAS, seed + k * 5), Math.max(0.5, amb))
        ctx.strokeStyle = shade("#1f2937", luz); ctx.lineWidth = Math.max(1, w * 0.035)
        ctx.beginPath() // pernas em tesoura
        ctx.moveTo(px, y - ht * 0.42); ctx.lineTo(px + ph2 * w * 0.06, y)
        ctx.moveTo(px, y - ht * 0.42); ctx.lineTo(px - ph2 * w * 0.06, y)
        ctx.stroke()
        ctx.fillStyle = roupa
        rr(ctx, px - w * 0.05, y - ht * 0.85, w * 0.1, ht * 0.45, w * 0.02)
        ctx.fillStyle = shade("#d6a77a", luz)
        ctx.beginPath(); ctx.arc(px, y - ht * 0.93, w * 0.04, 0, Math.PI * 2); ctx.fill()
        if ((seed + k) % 4 === 0) { ctx.fillStyle = "rgba(244,247,255,0.35)"; ctx.beginPath(); ctx.arc(px, y - ht * 1.04, w * 0.11, Math.PI, 0); ctx.fill() }
      }
      return true
    }
    case ENF.vapor: {
      // bueiro soltando vapor (Kabukicho de madrugada)
      ctx.fillStyle = shade("#1f2937", luz)
      ctx.beginPath(); ctx.ellipse(x, y, w * 0.3, w * 0.07, 0, 0, Math.PI * 2); ctx.fill()
      const t = agora() / 1000
      for (let k = 0; k < 4; k++) {
        const f = (t * 0.35 + k / 4) % 1
        ctx.fillStyle = `rgba(226,232,240,${0.22 * (1 - f)})`
        ctx.beginPath(); ctx.arc(x + Math.sin(t + k) * w * 0.1, y - f * w * 1.4, w * (0.15 + f * 0.3), 0, Math.PI * 2); ctx.fill()
      }
      return true
    }
  }
  return false
}
