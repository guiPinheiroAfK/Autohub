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
  const [minimized, setMinimized] = useState(false)
  const [iosExpanded, setIosExpanded] = useState(false)

  useEffect(() => {
    // Já instalado — não mostra nada, nem o botão minúsculo
    if (isInStandaloneMode()) return

    const p = detectPlatform()
    if (!p) return

    setPlatform(p)
    const dismissedBefore = !!localStorage.getItem("pwa-dismissed")

    if (p === "android") {
      const handler = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e as BeforeInstallPromptEvent)
        if (dismissedBefore) {
          setMinimized(true)
        } else {
          setVisible(true)
        }
      }
      window.addEventListener("beforeinstallprompt", handler)
      return () => window.removeEventListener("beforeinstallprompt", handler)
    }

    if (p === "ios") {
      if (dismissedBefore) {
        setMinimized(true)
        return
      }
      // Mostra banner manual no iOS depois de 2s
      const t = setTimeout(() => setVisible(true), 2000)
      return () => clearTimeout(t)
    }
  }, [])

  function dismiss() {
    setVisible(false)
    setMinimized(true)
    localStorage.setItem("pwa-dismissed", "1")
  }

  function reopen() {
    setMinimized(false)
    setVisible(true)
  }

  async function handleInstallAndroid() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setVisible(false)
      setMinimized(false)
    }
    setDeferredPrompt(null)
  }

  if (!platform) return null

  // Botão minúsculo persistente (depois do dismiss)
  if (minimized) {
    return (
        <button
            onClick={reopen}
            aria-label="Instalar AutoHub"
            className="fixed bottom-[4.5rem] right-4 z-50 flex size-9 items-center justify-center rounded-full border border-border bg-surface text-purple shadow-lg transition-transform hover:scale-105 sm:bottom-4"
        >
          <Download className="size-4" />
        </button>
    )
  }

  if (!visible) return null

  return (
      <div className="fixed bottom-[4.5rem] left-0 right-0 z-50 flex justify-center px-4 sm:bottom-4">
        <div className="w-full max-w-xs animate-page-in overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
          <div className="flex items-start gap-2.5 p-3">
            {/* Ícone */}
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-purple-bg">
              <Download className="size-4 text-purple" />
            </div>

            {/* Texto */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-foreground">Instalar AutoHub</p>
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                {platform === "ios"
                    ? "Adicione à tela inicial."
                    : "Instale para acesso rápido."}
              </p>
            </div>

            {/* Fechar */}
            <button
                onClick={dismiss}
                className="shrink-0 text-faint-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Android — botão direto */}
          {platform === "android" && (
              <div className="border-t border-border px-3 py-2.5">
                <button
                    onClick={handleInstallAndroid}
                    className="w-full rounded-lg bg-purple py-1.5 text-[12px] font-medium text-white hover:opacity-90"
                >
                  Instalar
                </button>
              </div>
          )}

          {/* iOS — instruções */}
          {platform === "ios" && (
              <div className="border-t border-border px-3 py-2.5">
                {!iosExpanded ? (
                    <button
                        onClick={() => setIosExpanded(true)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple py-1.5 text-[12px] font-medium text-white hover:opacity-90"
                    >
                      <Share className="size-3.5" />
                      Ver como instalar
                    </button>
                ) : (
                    <ol className="flex flex-col gap-1.5">
                      <li className="flex items-center gap-1.5 text-[11px] text-foreground">
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-purple-bg text-[9px] font-bold text-purple">1</span>
                        Toque em <Share className="inline size-3 text-purple mx-0.5" /> <strong>Compartilhar</strong>
                      </li>
                      <li className="flex items-center gap-1.5 text-[11px] text-foreground">
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-purple-bg text-[9px] font-bold text-purple">2</span>
                        Role e toque em <strong>"Adicionar à Tela de Início"</strong>
                      </li>
                      <li className="flex items-center gap-1.5 text-[11px] text-foreground">
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-purple-bg text-[9px] font-bold text-purple">3</span>
                        Toque em <strong>Adicionar</strong>
                      </li>
                    </ol>
                )}
              </div>
          )}
        </div>
      </div>
  )
}
