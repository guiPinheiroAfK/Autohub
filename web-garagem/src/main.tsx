import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.tsx"

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    })
  } else {
    // Dev: remove qualquer SW antigo + limpa caches (evita o cache atrapalhar o
    // desenvolvimento — ex.: mapa preto por tiles vetoriais interceptados)
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()))
    if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
