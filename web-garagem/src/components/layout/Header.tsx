import { Link, useLocation } from "react-router-dom"
import { ArrowLeft, Settings, LogOut, CalendarDays, Navigation, Bell, Users } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { Logo } from "@/components/shared/Logo"
import { useEffect, useState } from "react"
import { api } from "@/lib/api/client"

function NotifBell() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    api.get<{ nao_lidas: number }>("/api/social/notificacoes")
      .then(r => setCount(r.nao_lidas))
      .catch(() => {})
    const id = setInterval(() => {
      api.get<{ nao_lidas: number }>("/api/social/notificacoes")
        .then(r => setCount(r.nao_lidas))
        .catch(() => {})
    }, 60000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="relative">
      <Bell className="size-4" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-red text-[8px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </div>
  )
}

export function Header() {
    const { pathname } = useLocation()
    const { user, logout } = useAuth()
    const naHome = pathname === "/" || pathname === "/configuracoes"
    const naTracksSection = pathname.startsWith("/tracks")

    return (
        <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-40">
            <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-6 py-3.5">

                {/* Logo / back */}
                {naHome ? (
                    <Link to="/" className="flex items-center justify-center group">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-purple-bg text-purple transition-transform group-hover:scale-105">
                            <Logo className="size-[18px]" />
                        </div>
                    </Link>
                ) : (
                    <Link
                        to="/"
                        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
                    >
                        <ArrowLeft className="size-4" />
                    </Link>
                )}

                {/* Garagem info */}
                <div className="flex-1">
                    <Link to="/" className="font-display text-sm font-semibold text-foreground hover:text-purple transition-colors">
                        {user?.garagem?.nome ?? "AutoHub Garagem"}
                    </Link>
                    {user?.garagem?.slug && (
                        <p className="text-[11px] text-faint-foreground">
                            autohub.app/g/{user.garagem.slug}
                        </p>
                    )}
                </div>

                {/* Nav + ações */}
                {user && (
                    <nav className="flex items-center gap-0.5">
                        <span className="hidden text-[12px] text-muted-foreground sm:block mr-2">
                            {user.nome.split(" ")[0]}
                        </span>

                        <Link
                            to="/tracks"
                            title="Autohub Tracks"
                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                                naTracksSection
                                    ? "bg-purple-bg text-purple"
                                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                            }`}
                        >
                            <Navigation className="size-3.5" />
                            <span className="hidden sm:block">Tracks</span>
                        </Link>

                        <Link
                            to="/eventos"
                            title="Eventos automotivos"
                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                                pathname === "/eventos"
                                    ? "bg-purple-bg text-purple"
                                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                            }`}
                        >
                            <CalendarDays className="size-3.5" />
                            <span className="hidden sm:block">Eventos</span>
                        </Link>

                        <Link
                            to="/feed"
                            title="Feed da comunidade"
                            className={`flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground ${pathname === "/feed" ? "bg-purple-bg text-purple" : ""}`}
                        >
                            <Users className="size-4" />
                        </Link>

                        <Link
                            to="/configuracoes"
                            title="Notificações"
                            className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                        >
                            <NotifBell />
                        </Link>

                        <Link
                            to="/configuracoes"
                            title="Configurações"
                            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                        >
                            <Settings className="size-4" />
                        </Link>

                        <button
                            onClick={logout}
                            title="Sair"
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
