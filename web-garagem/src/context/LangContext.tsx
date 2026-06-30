import { createContext, useContext, useState, type ReactNode } from "react"
import { translations, type Lang, type Translations } from "@/lib/i18n"

interface LangState { lang: Lang; t: Translations; setLang: (l: Lang) => void }
const LangContext = createContext<LangState | null>(null)

function detectLang(): Lang {
  const stored = localStorage.getItem("autohub_lang") as Lang | null
  if (stored === "pt" || stored === "en" || stored === "es") return stored
  const browser = navigator.language.slice(0, 2)
  if (browser === "en") return "en"
  if (browser === "es") return "es"
  return "pt"
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)

  function setLang(l: Lang) {
    localStorage.setItem("autohub_lang", l)
    setLangState(l)
  }

  return (
    <LangContext.Provider value={{ lang, t: translations[lang] as Translations, setLang }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang(): LangState {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error("useLang must be inside LangProvider")
  return ctx
}
