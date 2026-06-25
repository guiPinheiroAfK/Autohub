import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export type Theme = "dark" | "light"

interface Settings {
  theme: Theme
  validarOrcamentoFase: boolean // popup quando itens ultrapassam o orçamento da fase
}

interface SettingsState extends Settings {
  setTheme: (t: Theme) => void
  setValidarOrcamentoFase: (v: boolean) => void
}

const STORAGE_KEY = "autohub_settings"

const DEFAULTS: Settings = {
  theme: "dark",
  validarOrcamentoFase: true,
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

function saveSettings(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

// Aplica o tema no <html>
function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === "light") {
    root.classList.add("light")
    root.classList.remove("dark")
  } else {
    root.classList.add("dark")
    root.classList.remove("light")
  }
}

const SettingsContext = createContext<SettingsState | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  // Aplica tema ao montar e sempre que mudar
  useEffect(() => {
    applyTheme(settings.theme)
    saveSettings(settings)
  }, [settings])

  function setTheme(theme: Theme) {
    setSettings(s => ({ ...s, theme }))
  }

  function setValidarOrcamentoFase(validarOrcamentoFase: boolean) {
    setSettings(s => ({ ...s, validarOrcamentoFase }))
  }

  return (
    <SettingsContext.Provider value={{ ...settings, setTheme, setValidarOrcamentoFase }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error("useSettings must be inside SettingsProvider")
  return ctx
}
