import { Outlet, useLocation } from "react-router-dom"
import { Header } from "./Header"
import { BottomNav } from "./BottomNav"
import { useAuth } from "@/context/AuthContext"

export function Layout() {
    const { user } = useAuth()
    const { pathname } = useLocation()

    return (
        <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
            <Header />
            <main
                key={pathname}
                className="mx-auto max-w-[1100px] px-4 py-8 pb-24 sm:px-6 sm:py-10 sm:pb-20 animate-page-in"
            >
                <Outlet />
            </main>
            {user && <BottomNav />}
        </div>
    )
}
