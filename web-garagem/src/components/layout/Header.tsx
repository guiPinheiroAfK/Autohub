import { Link, useLocation } from "react-router-dom"
import { ArrowLeft, Settings, LogOut, CalendarDays, Navigation } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { Logo } from "@/components/shared/Logo"

export function Header() {
    const { pathname } = useLocation()
    const { user, logout } = useAuth()
    const naHome = pathname === "/" || pathname === "/configuracoes"
    const naTracksSection = pathname.startsWith("/tracks")
    const naEventos = pathname === "/eventos"

    return (
        <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-40">
            <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-6 py-3.5">

                {/* Logo / back */}
                {naHome ? (
                    <Link to="/" className="flex items-center gap-2.5 group">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-purple-bg text-purple transition-transform group-hover:scale-105">
                            <Logo className="size-[18px]" />
                        </div>
                        <span className="hidden font-display text-[13px] font-bold tracking-tight text-foreground sm:block">
                            AutoHub
                        </span>
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
                                naEventos
                                    ? "bg-purple-bg text-purple"
                                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                            }`}
                        >
                            <CalendarDays className="size-3.5" />
                            <span className="hidden sm:block">Eventos</span>
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
