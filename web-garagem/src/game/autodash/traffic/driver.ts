// AutoDash — IAs do tráfego (padrão strategy).
// Cada Driver decide o movimento de UM veículo por frame a partir de uma
// WorldView read-only. São stateless (todo estado mora no objeto Traffic), então
// uma instância só é compartilhada por todos os veículos do mesmo papel — ver
// DRIVERS no fim do arquivo.
//
// O engine cuida do que é interação com o jogador (colisão, pontuação, render,
// reciclagem); o Driver cuida só de dirigir: seguir, ceder, ultrapassar, perseguir.

import { KMH2UPS } from "../data"
import { KINDS, type Traffic, type TrafficRole, type WorldView } from "./types"

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v }

export abstract class Driver {
  /**
   * Dirige o veículo por um frame: decide faixa/velocidade, aplica o movimento
   * lateral e avança no Z. Retorna a velocidade momentânea (km/h) — o engine usa
   * pra pontuar o "quase" (near-miss).
   */
  abstract drive(self: Traffic, world: WorldView, dt: number): number

  /** Verdadeiro se `lane` está livre num raio Z de `clearZ` (olha faixa atual E destino dos outros). */
  protected laneFree(self: Traffic, world: WorldView, lane: number, clearZ: number): boolean {
    for (const o of world.traffic) {
      if (o === self) continue
      const dz = Math.abs(world.wrapDz(o.z, self.z))
      if (dz < clearZ && (Math.abs(o.offset - lane) < 0.3 || Math.abs(o.targetOffset - lane) < 0.3)) return false
    }
    return true
  }

  /**
   * Tenta trocar de faixa pro primeiro lado livre em `sides` (offsets relativos,
   * ex.: [-0.5, 0.5]). Respeita as bordas da pista. Se `checkPlayer`, também
   * evita cortar o jogador dentro de `playerClearZ`. Retorna true se marcou a troca.
   */
  protected tryLaneChange(
    self: Traffic, world: WorldView, sides: number[],
    clearZ: number, blink: number, checkPlayer: boolean, playerClearZ = 0,
  ): boolean {
    for (const side of sides) {
      const lane = self.offset + side
      if (lane < -0.9 || lane > 0.9) continue
      if (!this.laneFree(self, world, lane, clearZ)) continue
      // não entrar na faixa do jogador se isso significa cortar na frente dele
      // (janela grande à frente = playerClearZ) ou raspar logo atrás (curta)
      if (checkPlayer && !world.demo && Math.abs(world.playerX - lane) < 0.3) {
        const pd = world.wrapDz(self.z, world.playerZ) // >0: carro à frente do jogador
        if (pd > -600 && pd < playerClearZ) continue
      }
      self.targetOffset = lane
      self.blinkT = blink
      return true
    }
    return false
  }

  /**
   * Aplica o movimento já decidido: consome a seta, interpola o offset até o
   * targetOffset (abortando se alguém surgiu no caminho) e avança no Z.
   */
  protected applyMovement(self: Traffic, world: WorldView, spd: number, dt: number) {
    if (self.blinkT > 0) self.blinkT -= dt
    if (self.targetOffset !== self.offset && self.blinkT <= 0.3) {
      // aborta a troca se alguém surgiu na faixa destino enquanto se movia
      let blocked = false
      for (const o of world.traffic) {
        if (o === self) continue
        const dz = Math.abs(world.wrapDz(o.z, self.z))
        if (dz < 500 && Math.abs(o.offset - self.targetOffset) < 0.25) { blocked = true; break }
      }
      if (blocked) {
        self.targetOffset = self.offset
      } else {
        const step = 0.45 * dt * Math.sign(self.targetOffset - self.offset)
        if (Math.abs(self.targetOffset - self.offset) <= Math.abs(step)) self.offset = self.targetOffset
        else self.offset += step
      }
    }
    self.z = ((self.z + spd * KMH2UPS * dt) % world.trackLen + world.trackLen) % world.trackLen
  }

  /** Veículo mais próximo à frente na mesma faixa (dentro de `range` unidades Z). */
  protected nearestAhead(self: Traffic, world: WorldView, range = 1500): Traffic | null {
    let best: Traffic | null = null
    for (const o of world.traffic) {
      if (o === self) continue
      const d = world.wrapDz(o.z, self.z)
      if (d > 0 && d < range && Math.abs(o.offset - self.offset) < 0.32) {
        if (!best || d < world.wrapDz(best.z, self.z)) best = o
      }
    }
    return best
  }

  /**
   * Trava anti-sobreposição: colado no `ahead`, nunca anda mais rápido que ele
   * (o gap não fecha, um não entra no outro). Muito colado, freia pra reabrir.
   * É isso que impede QUALQUER driver — inclusive a polícia — de atravessar carros.
   */
  protected antiOverlap(self: Traffic, world: WorldView, ahead: Traffic | null, spd: number): number {
    if (!ahead) return spd
    const gap = world.wrapDz(ahead.z, self.z)
    const safe = (KINDS[self.kind].len + KINDS[ahead.kind].len) / 2 + 80
    if (gap < safe) spd = Math.min(spd, ahead.speed)
    if (gap < safe * 0.6) spd = Math.min(spd, Math.max(0, ahead.speed - 25))
    return spd
  }
}

/**
 * Trânsito comum. Segue o carro da frente sem bater, cede ao farol alto, tenta
 * ultrapassar quem está lento e sai da frente de quem vem colado atrás — sempre
 * checando os outros carros E o jogador antes de mudar de faixa.
 * Motos são civis mais agressivos (trocam de faixa mais cedo e aceitam gaps
 * menores), mas ainda respeitam todo mundo.
 */
export class CivilianDriver extends Driver {
  drive(self: Traffic, world: WorldView, dt: number): number {
    // cedeu ao farol alto: tenta abrir caminho pro lado do jogador
    if (self.yieldT && self.yieldT > 0) {
      self.yieldT -= dt
      if (self.targetOffset === self.offset) {
        const comply = self.kind === "car" || self.kind === "moto" || Math.random() < 0.02
        if (comply) {
          const sides = world.playerX > self.offset ? [-0.5, 0.5] : [0.5, -0.5]
          if (this.tryLaneChange(self, world, sides, 1100, 0.6, false)) self.yieldT = 0
        }
      }
    }

    // carro imediatamente à frente (freia) e quem vem colado atrás mais rápido (sai da frente)
    let ahead: Traffic | null = null
    let beside: Traffic | null = null
    for (const o of world.traffic) {
      if (o === self) continue
      const d = world.wrapDz(o.z, self.z)
      if (d > 0 && d < 1500 && Math.abs(o.offset - self.offset) < 0.32) {
        if (!ahead || d < world.wrapDz(ahead.z, self.z)) ahead = o
      } else if (d < 0 && d > -600 && Math.abs(o.offset - self.offset) < 0.32 && o.speed > self.speed) {
        beside = o
      }
    }

    let spd = self.speed
    if (ahead && ahead.speed < self.speed) {
      // freia mais forte se o gap está curto
      const brakeGap = world.wrapDz(ahead.z, self.z)
      const urgency = brakeGap < 400 ? 0.7 : 1.0
      spd = Math.max(ahead.speed * urgency, self.speed - 40)
      const moto = self.kind === "moto"
      const changeProb = moto ? 0.04 : 0.02 // moto puxa ultrapassagem mais cedo
      if (self.blinkT <= 0 && self.targetOffset === self.offset && (self.kind === "car" || moto) && Math.random() < changeProb) {
        const sides = Math.random() < 0.5 ? [-0.5, 0.5] : [0.5, -0.5]
        // clearZ menor = moto costura mais entre carros; player clearance alto = não corta na sua frente
        this.tryLaneChange(self, world, sides, moto ? 700 : 1100, 0.8, true, moto ? 3000 : 2500)
      }
    }
    // alguém colado atrás e mais rápido na mesma faixa: tenta liberar (sem cortar o jogador)
    if (beside && self.blinkT <= 0 && self.targetOffset === self.offset && Math.random() < 0.015) {
      const sides = Math.random() < 0.5 ? [-0.5, 0.5] : [0.5, -0.5]
      this.tryLaneChange(self, world, sides, 900, 0.6, true, 2500)
    }

    spd = this.antiOverlap(self, world, ahead, spd)
    this.applyMovement(self, world, spd, dt)
    return spd
  }
}

/**
 * IA da polícia — persegue o jogador colando na faixa dele. Diferente do civil:
 * mira ATIVAMENTE no jogador e aceita gaps curtos. Mas — crucial — respeita o
 * trânsito (antiOverlap): tem que frear e contornar carros igual você, então dá
 * pra despistar enfiando no meio do movimento. O teto de velocidade fica ABAIXO
 * do top speed dos carros, então em reta limpa o jogador abre distância; a
 * viatura só te alcança quando você freia (curva/trânsito).
 * ESQUELETO / ponto de extensão: o evento completo (empurrar pra fora, estado
 * "preso" que encerra a run, timer de 2 min) entra junto com a feature.
 */
export class PoliceDriver extends Driver {
  // teto de velocidade — abaixo do top dos carros de propósito: o jogador é mais
  // rápido no limpo e escapa; a polícia depende do trânsito frear ele
  private static readonly TOP = 215
  // arrancada FRACA (km/h por segundo): acompanha nos primeiros segundos, mas
  // quando o jogador segue acelerando ela não recupera. Freia bem mais rápido.
  private static readonly ACCEL = 55
  private static readonly DECEL = 170
  // distância em Z abaixo da qual a viatura NÃO entra na faixa do jogador
  private static readonly CLOSE = 1500

  drive(self: Traffic, world: WorldView, dt: number): number {
    const gap = world.wrapDz(self.z, world.playerZ) // >0: viatura à frente do jogador
    const ahead = this.nearestAhead(self, world)

    // REGRA DE OURO: a viatura só entra na faixa do jogador quando está LONGE em
    // Z. Colada, ela segura a linha — senão o movimento lateral vira um "pulo"
    // em cima de você, impossível de desviar. Ela ameaça fechando a distância,
    // não teleportando de lado.
    const canEnterPlayerLane = Math.abs(gap) > PoliceDriver.CLOSE

    if (self.blinkT <= 0 && self.targetOffset === self.offset) {
      let want: number | null = null
      if (ahead && ahead.speed < self.speed - 10) {
        // trânsito travando ELA (não o jogador): contorna pro lado livre
        for (const side of Math.random() < 0.5 ? [-0.5, 0.5] : [0.5, -0.5]) {
          const lane = self.offset + side
          if (lane < -0.9 || lane > 0.9) continue
          if (!this.laneFree(self, world, lane, 800)) continue
          if (!canEnterPlayerLane && Math.abs(world.playerX - lane) < 0.3) continue
          want = lane; break
        }
      } else if (canEnterPlayerLane && Math.abs(self.offset - world.playerX) > 0.1) {
        // aproximação de longe: alinha na faixa do jogador pra fechar o cerco
        const dir = Math.sign(world.playerX - self.offset)
        const lane = clamp(self.offset + dir * 0.5, -0.75, 0.75)
        if (this.laneFree(self, world, lane, 300)) want = lane
      }
      // blink > 0.3 dá um instante de seta antes de sair da faixa (telegrafa o
      // movimento em vez de pular de lado no mesmo frame)
      if (want !== null) { self.targetOffset = want; self.blinkT = 0.55 }
    }

    // Alvo de velocidade. TOP é teto ABSOLUTO em todos os casos: é ele que
    // garante que quem corre mais que 215 simplesmente vai embora — sem isso
    // vira rubber-band e a fuga fica impossível.
    const atras = -gap // >0 quando a viatura está atrás de você
    // marcos da perseguição, por entidade:
    // engaged = já te ACERTOU um encostão · wasAhead/beaten = você a ultrapassou
    // (limiares folgados: durante o encostão o gap oscila em ±150 e disparava
    // wasAhead/beaten espúrios — a viatura "desistia" no meio da prensada)
    // Engajar só no CONTATO (backoffT é setado pelo engine no encostão), não por
    // proximidade: chegar perto e não conseguir bater não conta — ela insiste
    // na caçada até acertar você pelo menos uma vez.
    if (self.backoffT && self.backoffT > 0) self.engaged = true
    if (gap > 400) self.wasAhead = true
    if (self.wasAhead && atras > 400) self.beaten = true

    let target: number
    if (self.beaten) {
      // JÁ FOI ULTRAPASSADA: desiste de vez e recua até o despiste limpar.
      target = Math.min(PoliceDriver.TOP, Math.max(0, world.playerSpeed - 40))
    } else if (gap > 300) {
      // bem à FRENTE de você: alivia e deixa você passar — o lugar dela é
      // atrás/do lado, nunca de parede na frente
      target = Math.min(PoliceDriver.TOP, Math.max(0, world.playerSpeed - 25))
    } else if (self.engaged) {
      // JÁ COLOU UMA VEZ: daqui em diante é a REGRA DA VELOCIDADE, sem mola.
      // Ela corre no próprio limite, constante. Você mais rápido = vai deixando
      // pra trás, linear. A folga proporcional que existia aqui era uma mola
      // (longe acelera, perto afrouxa, contato recua) — a "gangorra" relatada.
      target = PoliceDriver.TOP
    } else {
      // primeira aproximação por trás: vem com tudo, folga encolhendo com a
      // distância pra chegar desacelerando e encostar em vez de passar reto
      target = Math.min(PoliceDriver.TOP, world.playerSpeed + clamp(atras / 60, 4, 85))
    }
    // acabou de dar um encostão: RECUA e abre distância antes de voltar pra cima.
    // Sem isso ela fica moendo o jogador em loop assim que o cooldown expira.
    // Único ponto onde a velocidade do jogador entra, e de propósito: é um
    // desengate deliberado e curto, não perseguição.
    if (self.backoffT && self.backoffT > 0) {
      self.backoffT -= dt
      target = Math.min(target, Math.max(0, world.playerSpeed - 35))
    }
    // respeita o trânsito: não mira acelerar pra dentro de um carro
    target = this.antiOverlap(self, world, ahead, target)
    // ACELERAÇÃO LIMITADA: rampa self.speed até o alvo — é isso que faz ela não
    // grudar. Ela persegue o alvo, mas a arrancada fraca deixa o jogador abrir gap.
    const dv = target - self.speed
    self.speed += clamp(dv, -PoliceDriver.DECEL * dt, PoliceDriver.ACCEL * dt)
    this.applyMovement(self, world, self.speed, dt)
    return self.speed
  }
}

/**
 * Contramão: vem no sentido oposto (speed negativa), reto na faixa dele.
 * Sem troca de faixa nem freio — o perigo é justamente a velocidade de
 * fechamento; quem desvia é você.
 */
export class OncomingDriver extends Driver {
  drive(self: Traffic, world: WorldView, dt: number): number {
    self.z = ((self.z + self.speed * KMH2UPS * dt) % world.trackLen + world.trackLen) % world.trackLen
    return self.speed
  }
}

// Registro papel -> IA. Instâncias únicas compartilhadas (drivers são stateless).
export const DRIVERS: Record<TrafficRole, Driver> = {
  civilian: new CivilianDriver(),
  police: new PoliceDriver(),
  oncoming: new OncomingDriver(),
}
