import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "@/context/AuthContext"
import { ProtectedRoute } from "@/components/shared/ProtectedRoute"
import { Layout } from "@/components/layout/Layout"
import LoginPage from "@/pages/LoginPage"
import GaragemOverview from "@/pages/GaragemOverview"
import VeiculoDetalhe from "@/pages/VeiculoDetalhe"
import NovoVeiculo from "@/pages/NovoVeiculo"

export default function App() {
  return (
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
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
