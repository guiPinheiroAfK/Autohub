import { Outlet } from "react-router-dom"
import { Header } from "./Header"

export function Layout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-[820px] px-6 py-10 pb-20">
        <Outlet />
      </main>
    </div>
  )
}
