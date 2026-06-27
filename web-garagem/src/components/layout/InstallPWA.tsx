import { useEffect, useState } from "react"
import { Download, X, Share } from "lucide-react"

type Platform = "android" | "ios" | null

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return "android"
  if (/iphone|ipad|ipod/i.test(ua)) return "ios"
  return null
}

function isInStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as any).standalone === true)
  )
}

// Evento do Chrome/Android para prompt de instalação
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPWA() {
  const [platform, setPlatform] = useState<Platform>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [iosExpanded, setIosExpanded] = useState(false)

  useEffect(() => {
    // Já instalado — não mostra
    if (isInStandaloneMode()) return

    const p = detectPlatform()
    if (!p) return

    // Já dispensou antes
    if (localStorage.getItem("pwa-dismissed")) return

    setPlatform(p)

    if (p === "android") {
      const handler = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e as BeforeInstallPromptEvent)
        setVisible(true)
      }
      window.addEventListener("beforeinstallprompt", handler)
      return () => window.removeEventListener("beforeinstallprompt", handler)
    }

    if (p === "ios") {
      // Mostra banner manual no iOS depois de 2s
      const t = setTimeout(() => setVisible(true), 2000)
      return () => clearTimeout(t)
    }
  }, [])

  function dismiss() {
    setVisible(false)
    localStorage.setItem("pwa-dismissed", "1")
  }

  async function handleInstallAndroid() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setVisible(false)
    }
    setDeferredPrompt(null)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-[4.5rem] left-0 right-0 z-50 flex justify-center px-4 sm:bottom-4">
      <div className="w-full max-w-sm animate-page-in overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
        <div className="flex items-start gap-3 p-4">
          {/* Ícone */}
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple-bg">
            <Download className="size-5 text-purple" />
          </div>

          {/* Texto */}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground">Instalar AutoHub</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {platform === "ios"
                ? "Adicione à tela inicial para acesso rápido."
                : "Instale o app para acesso rápido e offline."}
            </p>
          </div>

          {/* Fechar */}
          <button
            onClick={dismiss}
            className="shrink-0 text-faint-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Android — botão direto */}
        {platform === "android" && (
          <div className="border-t border-border px-4 py-3">
            <button
              onClick={handleInstallAndroid}
              className="w-full rounded-xl bg-purple py-2 text-[13px] font-medium text-white hover:opacity-90"
            >
              Instalar
            </button>
          </div>
        )}

        {/* iOS — instruções */}
        {platform === "ios" && (
          <div className="border-t border-border px-4 py-3">
            {!iosExpanded ? (
              <button
                onClick={() => setIosExpanded(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple py-2 text-[13px] font-medium text-white hover:opacity-90"
              >
                <Share className="size-4" />
                Ver como instalar
              </button>
            ) : (
              <ol className="flex flex-col gap-2">
                <li className="flex items-center gap-2 text-[12px] text-foreground">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-purple-bg text-[10px] font-bold text-purple">1</span>
                  Toque em <Share className="inline size-3.5 text-purple mx-0.5" /> <strong>Compartilhar</strong> na barra do Safari
                </li>
                <li className="flex items-center gap-2 text-[12px] text-foreground">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-purple-bg text-[10px] font-bold text-purple">2</span>
                  Role e toque em <strong>"Adicionar à Tela de Início"</strong>
                </li>
                <li className="flex items-center gap-2 text-[12px] text-foreground">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-purple-bg text-[10px] font-bold text-purple">3</span>
                  Toque em <strong>Adicionar</strong> no canto superior direito
                </li>
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
