export function isPassado(iso: string) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return new Date(iso + "T12:00:00") < hoje
}

export function formatDataCurta(iso: string) {
  const d = new Date(iso + "T12:00:00")
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")
}

const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]

export function formatDataBox(iso: string) {
  const [, m, d] = iso.split("-")
  return { dia: d, mes: MESES_ABREV[Number(m) - 1] }
}
