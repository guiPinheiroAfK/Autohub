import { BrowserRouter, Routes, Route } from "react-router-dom"
import { lazy, Suspense } from "react"
import { AuthProvider } from "@/context/AuthContext"
import { SettingsProvider } from "@/context/SettingsContext"
import { ProtectedRoute } from "@/components/shared/ProtectedRoute"
import { Layout } from "@/components/layout/Layout"
import { InstallPWA } from "@/components/layout/InstallPWA"
import { RouteTitle } from "@/components/shared/RouteTitle"

const LoginPage         = lazy(() => import("@/pages/LoginPage"))
const GaragemOverview   = lazy(() => import("@/pages/GaragemOverview"))
const VeiculoDetalhe    = lazy(() => import("@/pages/VeiculoDetalhe"))
const NovoVeiculo       = lazy(() => import("@/pages/NovoVeiculo"))
const ConfiguracaoPage  = lazy(() => import("@/pages/ConfiguracaoPage"))
const EventosPage       = lazy(() => import("@/pages/EventosPage"))
const TracksPage        = lazy(() => import("@/pages/TracksPage"))
const RotaDetalhePage   = lazy(() => import("@/pages/RotaDetalhePage"))
const GaragemPublicaPage = lazy(() => import("@/pages/GaragemPublicaPage"))
const VeiculoPublicoPage = lazy(() => import("@/pages/VeiculoPublicoPage"))
const FeedPage          = lazy(() => import("@/pages/FeedPage"))
const ConvitePage       = lazy(() => import("@/pages/ConvitePage"))
const VerificarEmailPage = lazy(() => import("@/pages/VerificarEmailPage"))
const ResetarSenhaPage  = lazy(() => import("@/pages/ResetarSenhaPage"))
const MarketplacePage   = lazy(() => import("@/pages/MarketplacePage"))
const AuthCallbackPage  = lazy(() => import("@/pages/AuthCallbackPage"))
const RunPage           = lazy(() => import("@/pages/RunPage"))
const MinhaLojaPage     = lazy(() => import("@/pages/MinhaLojaPage"))
const LojaPage          = lazy(() => import("@/pages/LojaPage"))
const PitchPage         = lazy(() => import("@/pages/PitchPage"))
const InfoPage          = lazy(() => import("@/pages/InfoPage"))

const Spinner = () => (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-2 border-border border-t-purple" />
    </div>
)

const S = ({ children }: { children: React.ReactNode }) => (
    <Suspense fallback={<Spinner />}>{children}</Suspense>
)

export default function App() {
  return (
      <SettingsProvider>
        <BrowserRouter>
          <AuthProvider>
            {/* Sincroniza document.title com a rota atual */}
            <RouteTitle />

            {/* Banner de instalação do PWA — global, fora do Layout protegido,
              assim aparece também na tela de login */}
            <InstallPWA />

            <Routes>
              <Route path="/login" element={<S><LoginPage /></S>} />

              {/* Rotas públicas sem auth */}
              <Route path="/g/:slug" element={<Layout />}>
                <Route index element={<S><GaragemPublicaPage /></S>} />
                <Route path=":veiculoId" element={<S><VeiculoPublicoPage /></S>} />
              </Route>
              <Route path="/verificar-email" element={<S><VerificarEmailPage /></S>} />
              <Route path="/resetar-senha" element={<S><ResetarSenhaPage /></S>} />
              <Route path="/oauth/callback" element={<S><AuthCallbackPage /></S>} />
              <Route path="/landingpage-pitch" element={<S><PitchPage /></S>} />
              <Route path="/info" element={<S><InfoPage /></S>} />
              <Route path="/convite" element={<Layout />}>
                <Route index element={<S><ConvitePage /></S>} />
              </Route>
              <Route path="/loja/:garagemSlug" element={<Layout />}>
                <Route index element={<S><LojaPage /></S>} />
              </Route>

              {/* Rotas protegidas */}
              <Route element={<ProtectedRoute />}>
                {/* Corrida — tela cheia imersiva, fora do Layout (sem header/nav) */}
                <Route path="/tracks/:rotaId/run" element={<S><RunPage /></S>} />

                <Route element={<Layout />}>
                  <Route path="/" element={<S><GaragemOverview /></S>} />
                  <Route path="/novo" element={<S><NovoVeiculo /></S>} />
                  <Route path="/veiculo/:id" element={<S><VeiculoDetalhe /></S>} />
                  <Route path="/configuracoes" element={<S><ConfiguracaoPage /></S>} />
                  <Route path="/eventos" element={<S><EventosPage /></S>} />
                  <Route path="/feed" element={<S><FeedPage /></S>} />
                  <Route path="/marketplace" element={<S><MarketplacePage /></S>} />
                  <Route path="/tracks" element={<S><TracksPage /></S>} />
                  <Route path="/tracks/:rotaId" element={<S><RotaDetalhePage /></S>} />
                  <Route path="/minha-loja" element={<S><MinhaLojaPage /></S>} />
                </Route>
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </SettingsProvider>
  )
}
