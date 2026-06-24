import { Link, useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, Wrench, LogOut } from "lucide-react"
import { useAuth } from "@/context/AuthContext"

export function Header() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const naVisaoGeral = pathname === "/"

  function handleLogout() {
    logout()
    navigate("/login")
  }

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-[820px] items-center gap-3 px-6 py-4">
        {naVisaoGeral ? (
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
          <div className="flex items-center gap-2">
            <span className="hidden text-[12px] text-muted-foreground sm:block">
              {user.nome.split(" ")[0]}
            </span>
            <button
              onClick={handleLogout}
              title="Sair"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
