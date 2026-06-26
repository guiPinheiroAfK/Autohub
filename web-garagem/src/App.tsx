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
import GaragemPublicaPage from "@/pages/GaragemPublicaPage"
import VeiculoPublicoPage from "@/pages/VeiculoPublicoPage"
import FeedPage from "@/pages/FeedPage"
import ConvitePage from "@/pages/ConvitePage"
import VerificarEmailPage from "@/pages/VerificarEmailPage"
import ResetarSenhaPage from "@/pages/ResetarSenhaPage"
import MarketplacePage from "@/pages/MarketplacePage"
import AuthCallbackPage from "@/pages/AuthCallbackPage"

const RunPage = lazy(() => import("@/pages/RunPage"))

const Spinner = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="size-8 animate-spin rounded-full border-2 border-border border-t-purple" />
  </div>
)

export default function App() {
  return (
    <SettingsProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Rotas públicas sem auth */}
            <Route path="/g/:slug" element={<Layout />}>
              <Route index element={<GaragemPublicaPage />} />
              <Route path=":veiculoId" element={<VeiculoPublicoPage />} />
            </Route>
            <Route path="/verificar-email" element={<VerificarEmailPage />} />
            <Route path="/resetar-senha" element={<ResetarSenhaPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/convite" element={<Layout />}>
              <Route index element={<ConvitePage />} />
            </Route>

            {/* Rotas protegidas */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<GaragemOverview />} />
                <Route path="/novo" element={<NovoVeiculo />} />
                <Route path="/veiculo/:id" element={<VeiculoDetalhe />} />
                <Route path="/configuracoes" element={<ConfiguracaoPage />} />
                <Route path="/eventos" element={<EventosPage />} />
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/marketplace" element={<MarketplacePage />} />
                <Route path="/tracks" element={<TracksPage />} />
                <Route path="/tracks/:rotaId" element={<RotaDetalhePage />} />
                <Route path="/tracks/:rotaId/run" element={
                  <Suspense fallback={<Spinner />}>
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
