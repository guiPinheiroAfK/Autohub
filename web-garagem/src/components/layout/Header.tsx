import { Link, useLocation } from "react-router-dom"
import { ArrowLeft, Settings, LogOut, CalendarDays, Navigation, Bell, Users, Check, CheckCheck, ShoppingBag, Store, Globe } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { Logo } from "@/components/shared/Logo"
import { useEffect, useRef, useState } from "react"
import { api } from "@/lib/api/client"
import { useLang } from "@/context/LangContext"
import { LANG_OPTIONS, type Lang } from "@/lib/i18n"

interface Notif {
  id: string
  tipo: string
  titulo: string
  corpo: string
  lida: boolean
  link?: string
  criado_em: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "agora"
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function NotifDropdown() {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [naoLidas, setNaoLidas] = useState(0)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function fetchCount() {
      api.get<{ nao_lidas: number }>("/api/social/notificacoes")
        .then(r => setNaoLidas(r.nao_lidas))
        .catch(() => {})
    }
    fetchCount()
    const id = setInterval(fetchCount, 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    api.get<{ notificacoes: Notif[]; nao_lidas: number }>("/api/social/notificacoes")
      .then(r => {
        setNotifs(r.notificacoes ?? [])
        setNaoLidas(r.nao_lidas)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [open])

  async function marcarLida(id: string) {
    await api.patch(`/api/social/notificacoes/${id}/lida`, {})
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n))
    setNaoLidas(prev => Math.max(0, prev - 1))
  }

  async function marcarTodasLidas() {
    await api.patch("/api/social/notificacoes/todas-lidas", {})
    setNotifs(prev => prev.map(n => ({ ...n, lida: true })))
    setNaoLidas(0)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        title={t.notif_title}
        className={`relative flex size-8 items-center justify-center rounded-lg transition-colors ${
          open ? "bg-purple-bg text-purple" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        }`}
      >
        <Bell className="size-4" />
        {naoLidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-red text-[8px] font-bold text-white">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[340px] overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-[13px] font-semibold text-foreground">{t.notif_title}</span>
            {naoLidas > 0 && (
              <button
                onClick={marcarTodasLidas}
                className="flex items-center gap-1 text-[11px] text-purple hover:underline"
              >
                <CheckCheck className="size-3" /> {t.notif_mark_all}
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading ? (
              <div className="flex flex-col gap-2 p-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-2" />
                ))}
              </div>
            ) : notifs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Bell className="size-6 text-faint-foreground" />
                <p className="text-[12px] text-muted-foreground">{t.notif_empty}</p>
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 border-b border-border/50 px-4 py-3 transition-colors last:border-0 ${
                    n.lida ? "" : "bg-purple-bg/30"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-medium leading-snug ${n.lida ? "text-muted-foreground" : "text-foreground"}`}>
                      {n.titulo}
                    </p>
                    {n.corpo && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{n.corpo}</p>
                    )}
                    <p className="mt-0.5 text-[10px] text-faint-foreground">{timeAgo(n.criado_em)}</p>
                  </div>
                  {!n.lida && (
                    <button
                      onClick={() => marcarLida(n.id)}
                      title="Marcar como lida"
                      className="mt-0.5 shrink-0 text-faint-foreground hover:text-purple"
                    >
                      <Check className="size-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function LangSwitcher() {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [open])

  const current = LANG_OPTIONS.find(o => o.value === lang)!

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        title={current.label}
        className={`flex size-8 items-center justify-center rounded-lg text-[13px] transition-colors ${
          open ? "bg-purple-bg text-purple" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        }`}
      >
        <Globe className="size-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[130px] overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          {LANG_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setLang(opt.value as Lang); setOpen(false) }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-[12px] transition-colors hover:bg-surface-2 ${
                opt.value === lang ? "text-purple font-semibold" : "text-foreground"
              }`}
            >
              <span>{opt.flag}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Header() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const { t } = useLang()
  const naHome = pathname === "/" || pathname === "/configuracoes"
  const naTracksSection = pathname.startsWith("/tracks")
  const [spinning, setSpinning] = useState(false)
  const spinDone = useRef(false)

  useEffect(() => {
    if (spinDone.current) return
    spinDone.current = true
    setSpinning(true)
    const t = setTimeout(() => setSpinning(false), 800)
    return () => clearTimeout(t)
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-4 py-3 sm:px-6 sm:py-3.5">

        {/* Logo / back */}
        {naHome ? (
          <Link to="/info" className="flex shrink-0 items-center justify-center group">
            <div className="flex size-8 items-center justify-center rounded-lg bg-purple-bg text-purple transition-transform group-hover:scale-105">
              <Logo className={`size-[22px] ${spinning ? "animate-wheel-spin" : ""}`} />
            </div>
          </Link>
        ) : (
          <Link
            to="/"
            className="flex shrink-0 size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
        )}

        {/* Garagem info */}
        <div className="min-w-0 flex-1">
          <Link to="/" className="block truncate font-display text-sm font-semibold text-foreground hover:text-purple transition-colors">
            {user?.garagem?.nome ?? "AutoHub Garagem"}
          </Link>
          {user?.garagem?.slug && (
            <p className="hidden truncate text-[11px] text-faint-foreground sm:block">
              autohub.app/g/{user.garagem.slug}
            </p>
          )}
        </div>

        {/* Nav — desktop only (mobile usa BottomNav) */}
        {user && (
          <nav className="flex shrink-0 items-center gap-0.5">
            <span className="hidden text-[12px] text-muted-foreground sm:block mr-2">
              {user.nome.split(" ")[0]}
            </span>

            <Link
              to="/tracks"
              title="AutoHub Tracks"
              className={`hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                naTracksSection ? "bg-purple-bg text-purple" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <Navigation className="size-3.5" />
              <span>{t.nav_tracks}</span>
            </Link>

            <Link
              to="/eventos"
              title={t.nav_events}
              className={`hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                pathname === "/eventos" ? "bg-purple-bg text-purple" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <CalendarDays className="size-3.5" />
              <span>{t.nav_events}</span>
            </Link>

            <Link
              to="/feed"
              title={t.nav_feed}
              className={`hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                pathname === "/feed" ? "bg-purple-bg text-purple" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <Users className="size-3.5" />
              <span>{t.nav_feed}</span>
            </Link>

            <Link
              to="/marketplace"
              title={t.nav_marketplace}
              className={`hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                pathname === "/marketplace" ? "bg-purple-bg text-purple" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <ShoppingBag className="size-3.5" />
              <span>{t.nav_marketplace}</span>
            </Link>

            <Link
              to="/minha-loja"
              title={t.nav_my_store}
              className={`hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                pathname === "/minha-loja" ? "bg-purple-bg text-purple" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <Store className="size-3.5" />
              <span>{t.nav_my_store}</span>
            </Link>

            {/* Sempre visíveis */}
            <NotifDropdown />

            <LangSwitcher />

            <Link
              to="/configuracoes"
              title={t.nav_settings}
              className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                pathname === "/configuracoes" ? "bg-purple-bg text-purple" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <Settings className="size-4" />
            </Link>

            <button
              onClick={logout}
              title={t.nav_logout}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-red"
            >
              <LogOut className="size-4" />
            </button>
          </nav>
        )}
      </div>
    </header>
  )
}
