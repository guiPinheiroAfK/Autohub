import { useEffect } from "react"
import { useLocation } from "react-router-dom"

const SUFIXO = "AutoHub"

// Mapa rota → título. Para rotas com parâmetro, casamos pelo prefixo.
const TITULOS: Array<[RegExp, string]> = [
  [/^\/login$/, "Entrar"],
  [/^\/info$/, "Sobre"],
  [/^\/feed$/, "Feed da comunidade"],
  [/^\/marketplace$/, "Marketplace"],
  [/^\/minha-loja$/, "Minha loja"],
  [/^\/eventos$/, "Eventos"],
  [/^\/tracks\/[^/]+\/run$/, "Cronômetro"],
  [/^\/tracks\/[^/]+$/, "Rota"],
  [/^\/tracks$/, "Tracks"],
  [/^\/configuracoes$/, "Configurações"],
  [/^\/novo$/, "Novo veículo"],
  [/^\/veiculo\//, "Veículo"],
  [/^\/loja\//, "Loja"],
  [/^\/g\//, "Garagem"],
  [/^\/verificar-email$/, "Verificar e-mail"],
  [/^\/resetar-senha$/, "Redefinir senha"],
  [/^\/convite$/, "Convite"],
  [/^\/$/, "Minha garagem"],
]

/** Mantém document.title sincronizado com a rota atual. */
export function RouteTitle() {
  const { pathname } = useLocation()

  useEffect(() => {
    const match = TITULOS.find(([re]) => re.test(pathname))
    document.title = match ? `${match[1]} · ${SUFIXO}` : SUFIXO
  }, [pathname])

  return null
}
