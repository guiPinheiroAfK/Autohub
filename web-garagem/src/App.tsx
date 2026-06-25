import { BrowserRouter, Routes, Route } from "react-router-dom"
import { lazy, Suspense } from "react"
import { AuthProvider } from "@/context/AuthContext"
import { SettingsProvider } from "@/context/SettingsContext"
import { ProtectedRoute } from "@/components/shared/ProtectedRoute"
import { Layout } from "@/components/layout/Layout"
import LoginPage from "@/pages/LoginPage"
import GaragemOverview from "@/pages/GaragemOverview"
import VeiculoDetalhe from "@/pages/VeiculoDetalhe"
import NovoVeiculo from "@/pages/NovoVeiculo"
import ConfiguracaoPage from "@/pages/ConfiguracaoPage.tsx"
import EventosPage from "@/pages/EventosPage"
import TracksPage from "@/pages/TracksPage"
import RotaDetalhePage from "@/pages/RotaDetalhePage"

// RunPage carrega Leaflet (~145kb) — lazy para não inflar o bundle principal
const RunPage = lazy(() => import("@/pages/RunPage"))

export default function App() {
  return (
      <SettingsProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              {/* Rotas protegidas */}
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<GaragemOverview />} />
                  <Route path="/novo" element={<NovoVeiculo />} />
                  <Route path="/veiculo/:id" element={<VeiculoDetalhe />} />
                  <Route path="/configuracoes" element={<ConfiguracaoPage />} />
                  <Route path="/eventos" element={<EventosPage />} />
                  <Route path="/tracks" element={<TracksPage />} />
                  <Route path="/tracks/:rotaId" element={<RotaDetalhePage />} />
                  <Route path="/tracks/:rotaId/run" element={
                    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><div className="size-8 animate-spin rounded-full border-2 border-border border-t-purple" /></div>}>
                      <RunPage />
                    </Suspense>
                  } />
                </Route>
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </SettingsProvider>
  )
}
