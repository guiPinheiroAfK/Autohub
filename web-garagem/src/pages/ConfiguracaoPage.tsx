import { Sun, Moon, Bell, ChevronRight } from "lucide-react"
import { useSettings, type Theme } from "@/context/SettingsContext"
import { useAuth } from "@/context/AuthContext"
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
            <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border">
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

            {/* ── Conta ────────────────────────────────────────────────────────── */}
            <Section title="Conta">
                <Row label="Nome" sub={user?.nome}>
                    <ChevronRight className="size-4 text-faint-foreground" />
                </Row>
                <Row label="E-mail" sub={user?.email}>
                    <ChevronRight className="size-4 text-faint-foreground" />
                </Row>
                <Row label="Garagem" sub={user?.garagem?.slug ? `autohub.app/g/${user.garagem.slug}` : undefined}>
                    <ChevronRight className="size-4 text-faint-foreground" />
                </Row>
            </Section>

            {/* ── Aparência ────────────────────────────────────────────────────── */}
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

            {/* ── Regras de negócio ────────────────────────────────────────────── */}
            <Section title="Build">
                <Row
                    label="Validar orçamento da fase"
                    sub="Avisa quando a soma dos itens ultrapassa o orçamento definido para a fase, com opção de ajustar automaticamente ou manualmente."
                >
                    <Toggle checked={validarOrcamentoFase} onChange={setValidarOrcamentoFase} />
                </Row>
                <Row
                    label="Alerta de notificações"
                    sub="Em breve"
                >
                    <div className="flex items-center gap-2">
                        <Bell className="size-4 text-faint-foreground" />
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-faint-foreground">
              em breve
            </span>
                    </div>
                </Row>
            </Section>

            {/* ── Danger zone ──────────────────────────────────────────────────── */}
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
