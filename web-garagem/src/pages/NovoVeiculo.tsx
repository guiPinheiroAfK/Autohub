import { useState, type FormEvent } from "react"
import { useNavigate, Link } from "react-router-dom"
import { criarVeiculo } from "@/lib/api/veiculos"
import type { PerfilVeiculo } from "@/types"

const PERFIS: { value: PerfilVeiculo; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "street_build", label: "Street Build" },
  { value: "restomod", label: "Restomod" },
  { value: "track", label: "Track" },
  { value: "project", label: "Projeto" },
]

const anoAtual = new Date().getFullYear()

export default function NovoVeiculo() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [apelido, setApelido] = useState("")
  const [marca, setMarca] = useState("")
  const [modelo, setModelo] = useState("")
  const [anoFabricacao, setAnoFabricacao] = useState(String(anoAtual))
  const [anoModelo, setAnoModelo] = useState(String(anoAtual))
  const [perfil, setPerfil] = useState<PerfilVeiculo>("daily")
  const [metaPotenciaWhp, setMetaPotenciaWhp] = useState("")

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    try {
      const { id } = await criarVeiculo({
        apelido,
        marca,
        modelo,
        anoFabricacao: Number(anoFabricacao),
        anoModelo: Number(anoModelo),
        perfil,
        metaPotenciaWhp: metaPotenciaWhp ? Number(metaPotenciaWhp) : null,
      })
      navigate(`/veiculo/${id}`)
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar veículo")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-faint-foreground">
          Garagem
        </div>
        <h1 className="font-display text-[28px] font-semibold leading-tight text-foreground">
          Novo veículo
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">
            Apelido do build
          </label>
          <input
            type="text"
            required
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
            placeholder="RX-8 K24"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">
              Marca
            </label>
            <input
              type="text"
              required
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Mazda"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">
              Modelo
            </label>
            <input
              type="text"
              required
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder="RX-8"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">
              Ano de fabricação
            </label>
            <input
              type="number"
              required
              min={1900}
              max={2030}
              value={anoFabricacao}
              onChange={(e) => setAnoFabricacao(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-purple focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">
              Ano modelo
            </label>
            <input
              type="number"
              required
              min={1900}
              max={2030}
              value={anoModelo}
              onChange={(e) => setAnoModelo(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-purple focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">
            Perfil
          </label>
          <select
            value={perfil}
            onChange={(e) => setPerfil(e.target.value as PerfilVeiculo)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-purple focus:outline-none"
          >
            {PERFIS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">
            Meta de potência (whp) — opcional
          </label>
          <input
            type="number"
            min={1}
            value={metaPotenciaWhp}
            onChange={(e) => setMetaPotenciaWhp(e.target.value)}
            placeholder="370"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
          />
        </div>

        {erro && (
          <p className="rounded-lg border border-red-bg bg-red-bg px-3 py-2 text-sm text-red">{erro}</p>
        )}

        <div className="mt-1 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-purple px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Criar veículo"}
          </button>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
