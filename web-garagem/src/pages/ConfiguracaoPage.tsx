import { useState, useEffect } from "react"
import { Sun, Moon, Globe, Lock, Save, Check, Mail, AlertCircle } from "lucide-react"
import { useSettings, type Theme } from "@/context/SettingsContext"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api/client"
import { cn } from "@/lib/utils"

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
        checked ? "bg-purple" : "bg-surface-2"
      )}
    >
      <span className={cn(
        "pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200",
        checked ? "translate-x-4" : "translate-x-0"
      )} />
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-faint-foreground">
        {title}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface divide-y divide-border">
        {children}
      </div>
    </div>
  )
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div>
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "light", label: "Claro", icon: Sun },
]

export default function ConfiguracaoPage() {
  const { theme, setTheme, validarOrcamentoFase, setValidarOrcamentoFase } = useSettings()
  const { user, logout } = useAuth()

  const [nomeGaragem, setNomeGaragem] = useState("")
  const [bio, setBio] = useState("")
  const [publica, setPublica] = useState(false)
  const [loadingGaragem, setLoadingGaragem] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erroSalvar, setErroSalvar] = useState("")

  const [emailVerificado] = useState<boolean | null>(null)
  const [reenviando, setReenviando] = useState(false)
  const [reenviado, setReenviado] = useState(false)

  // Carrega dados atuais da garagem
  useEffect(() => {
    api.get<{
      id: string; nome: string; email: string; avatarUrl: string | null
      garagem: { id: string; slug: string; nome: string; bio?: string; publica?: boolean }
    }>("/api/auth/me")
      .then(r => {
        setNomeGaragem(r.garagem?.nome ?? "")
        setBio(r.garagem?.bio ?? "")
        setPublica(r.garagem?.publica ?? false)
      })
      .catch(() => {})
      .finally(() => setLoadingGaragem(false))
  }, [])

  async function salvarGaragem() {
    setSalvando(true); setErroSalvar("")
    try {
      await api.patch("/api/auth/garagem", {
        nome: nomeGaragem || undefined,
        bio: bio || null,
        publica,
      })
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2500)
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : "Erro ao salvar")
    } finally {
      setSalvando(false)
    }
  }

  async function reenviarVerificacao() {
    if (!user?.email) return
    setReenviando(true)
    try {
      await api.post("/auth/reenviar-verificacao", { email: user.email })
      setReenviado(true)
    } finally {
      setReenviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-[520px]">
      <div>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-faint-foreground">
          Configurações
        </div>
        <h1 className="font-display text-[26px] font-semibold leading-tight text-foreground">
          Preferências
        </h1>
      </div>

      {/* ── Conta ─────────────────────────────────────────────────────────── */}
      <Section title="Conta">
        <Row label="Nome" sub={user?.nome}>
          <span className="text-[11px] text-faint-foreground">somente leitura</span>
        </Row>
        <Row label="E-mail" sub={user?.email}>
          {emailVerificado === false ? (
            <div className="flex items-center gap-2">
              <AlertCircle className="size-3.5 text-amber" />
              <span className="text-[11px] text-amber">não verificado</span>
            </div>
          ) : (
            <span className="text-[11px] text-faint-foreground">somente leitura</span>
          )}
        </Row>
        {emailVerificado === false && (
          <div className="px-5 py-3">
            {reenviado ? (
              <p className="text-[12px] text-green flex items-center gap-1.5">
                <Check className="size-3.5" /> E-mail de verificação enviado!
              </p>
            ) : (
              <button
                onClick={reenviarVerificacao}
                disabled={reenviando}
                className="flex items-center gap-1.5 text-[12px] text-purple hover:underline disabled:opacity-50"
              >
                <Mail className="size-3.5" />
                {reenviando ? "Enviando..." : "Reenviar e-mail de verificação"}
              </button>
            )}
          </div>
        )}
        <Row label="Garagem" sub={user?.garagem?.slug ? `autohub.app/g/${user.garagem.slug}` : undefined}>
          <span className="text-[11px] text-faint-foreground">somente leitura</span>
        </Row>
      </Section>

      {/* ── Garagem ───────────────────────────────────────────────────────── */}
      <Section title="Garagem">
        {loadingGaragem ? (
          <div className="px-5 py-4 flex flex-col gap-3">
            <div className="h-8 animate-pulse rounded-lg bg-surface-2" />
            <div className="h-16 animate-pulse rounded-lg bg-surface-2" />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 px-5 py-4">
              <div>
                <label className="text-[12px] font-medium text-foreground">Nome da garagem</label>
                <input
                  value={nomeGaragem}
                  onChange={e => setNomeGaragem(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
                  placeholder="Minha Garagem"
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground">Bio</label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={2}
                  maxLength={300}
                  className="mt-1.5 w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
                  placeholder="Conte sobre seus projetos, estilos e inspirações..."
                />
                <p className="mt-0.5 text-right text-[10px] text-faint-foreground">{bio.length}/300</p>
              </div>
            </div>

            <Row
              label="Garagem pública"
              sub={publica
                ? "Sua garagem aparece no feed e é acessível por link"
                : "Apenas você vê sua garagem"
              }
            >
              <div className="flex items-center gap-2">
                {publica
                  ? <Globe className="size-3.5 text-purple" />
                  : <Lock className="size-3.5 text-faint-foreground" />
                }
                <Toggle checked={publica} onChange={setPublica} />
              </div>
            </Row>

            {erroSalvar && (
              <div className="px-5 py-2">
                <p className="text-[12px] text-red">{erroSalvar}</p>
              </div>
            )}

            <div className="px-5 py-3">
              <button
                onClick={salvarGaragem}
                disabled={salvando}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-colors",
                  salvo
                    ? "bg-green-bg text-green border border-green/30"
                    : "bg-purple text-white hover:opacity-90 disabled:opacity-50"
                )}
              >
                {salvo ? <Check className="size-4" /> : <Save className="size-4" />}
                {salvo ? "Salvo!" : salvando ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </>
        )}
      </Section>

      {/* ── Aparência ─────────────────────────────────────────────────────── */}
      <Section title="Aparência">
        <Row label="Tema" sub="Alterna entre escuro e claro">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 p-1">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                  theme === value
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      {/* ── Build ─────────────────────────────────────────────────────────── */}
      <Section title="Build">
        <Row
          label="Validar orçamento da fase"
          sub="Avisa quando a soma dos itens ultrapassa o orçamento definido"
        >
          <Toggle checked={validarOrcamentoFase} onChange={setValidarOrcamentoFase} />
        </Row>
      </Section>

      {/* ── Sessão ────────────────────────────────────────────────────────── */}
      <Section title="Sessão">
        <Row label="Sair da conta" sub="Encerra a sessão neste dispositivo">
          <button
            onClick={logout}
            className="rounded-lg border border-red/30 bg-red-bg px-3 py-1.5 text-[12px] font-medium text-red transition-colors hover:bg-red/20"
          >
            Sair
          </button>
        </Row>
      </Section>
    </div>
  )
}
