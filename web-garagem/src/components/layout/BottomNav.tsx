import { Link, useLocation } from "react-router-dom"
import { Home, Users, ShoppingBag, Store, Navigation } from "lucide-react"
import { useLang } from "@/context/LangContext"

export function BottomNav() {
  const { pathname } = useLocation()
  const { t } = useLang()

  const ITEMS = [
    { to: "/",            icon: Home,        label: t.nav_garage     },
    { to: "/feed",        icon: Users,       label: t.nav_feed       },
    { to: "/marketplace", icon: ShoppingBag, label: t.nav_marketplace },
    { to: "/minha-loja",  icon: Store,       label: t.nav_my_store   },
    { to: "/tracks",      icon: Navigation,  label: t.nav_tracks     },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm sm:hidden">
      <div className="flex items-stretch">
        {ITEMS.map(({ to, icon: Icon, label }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                active ? "text-purple" : "text-faint-foreground"
              }`}
            >
              <Icon className="size-5" strokeWidth={active ? 2.5 : 1.75} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
