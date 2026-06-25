import { Link, useLocation } from "react-router-dom"
import { ArrowLeft, Wrench, Settings, LogOut, CalendarDays, Navigation } from "lucide-react"
import { useAuth } from "@/context/AuthContext"

export function Header() {
    const { pathname } = useLocation()
    const { user, logout } = useAuth()
    const naHome = pathname === "/"
    const naConfig = pathname === "/configuracoes"

    return (
        <header className="border-b border-border">
            <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-6 py-4">
                {naHome || naConfig ? (
                    <div className="flex size-8 items-center justify-center rounded-lg bg-purple-bg text-purple">
                        <Wrench className="size-4" />
                    </div>
                ) : (
                    <Link
                        to="/"
                        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
                    >
                        <ArrowLeft className="size-4" />
                    </Link>
                )}

                <div className="flex-1">
                    <Link to="/" className="font-display text-sm font-semibold text-foreground">
                        {user?.garagem?.nome ?? "AutoHub Garagem"}
                    </Link>
                    {user?.garagem?.slug && (
                        <p className="text-[11px] text-faint-foreground">
                            autohub.app/g/{user.garagem.slug}
                        </p>
                    )}
                </div>

                {user && (
                    <div className="flex items-center gap-1">
            <span className="hidden text-[12px] text-muted-foreground sm:block mr-1">
              {user.nome.split(" ")[0]}
            </span>
                        <Link
                            to="/tracks"
                            title="Autohub Tracks"
                            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                        >
                            <Navigation className="size-4" />
                        </Link>
                        <Link
                            to="/eventos"
                            title="Eventos automotivos"
                            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                        >
                            <CalendarDays className="size-4" />
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
                    </div>
                )}
            </div>
        </header>
    )
}
