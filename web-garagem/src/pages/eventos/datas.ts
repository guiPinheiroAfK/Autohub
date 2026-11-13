
export function parseData(iso: string) {
  const [ano, mes, dia] = iso.split("-")
  return { ano: Number(ano), mes: Number(mes) - 1, dia: Number(dia) }
}

export function isPassado(iso: string): boolean {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return new Date(iso + "T12:00:00") < hoje
}

export function diasRestantes(iso: string): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const data = new Date(iso + "T12:00:00")
  return Math.ceil((data.getTime() - hoje.getTime()) / 86_400_000)
}

export function formatDataExibicao(inicio: string, fim?: string): string {
  const i = new Date(inicio + "T12:00:00")
  if (!fim || fim === inicio) {
    return i.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
  }
  const f = new Date(fim + "T12:00:00")
  return `${i.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} – ${f.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`
}
