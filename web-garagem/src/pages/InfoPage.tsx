import { Link } from "react-router-dom"
import { ArrowLeft, Wrench, Users, ShoppingBag, Map, MessageCircle, Trophy } from "lucide-react"

const FEATURES = [
  {
    icon: Wrench,
    title: "Documente seu build",
    desc: "Registre cada fase do projeto — motor, suspensão, estética. Tudo num só lugar, com fotos e anotações.",
  },
  {
    icon: Users,
    title: "Siga outros builders",
    desc: "Acompanhe quem está construindo o mesmo perfil que você: street, track, show car ou off-road.",
  },
  {
    icon: MessageCircle,
    title: "Comente e troque experiência",
    desc: "Opine nos builds da comunidade, tire dúvidas e compartilhe o que aprendeu na garagem.",
  },
  {
    icon: ShoppingBag,
    title: "Marketplace de peças",
    desc: "Compre e venda peças diretamente na plataforma, com contexto real de quem já usou em build.",
  },
  {
    icon: Map,
    title: "Tracks e eventos",
    desc: "Descubra pistas, cronômetros e eventos perto de você. Do arrancão ao track day.",
  },
  {
    icon: Trophy,
    title: "Orçamentos e cotações",
    desc: "Peça cotações para serviços e peças, compare preços e mantenha o controle do custo do seu build.",
  },
]

export default function InfoPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header mínimo */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <span className="font-display text-sm font-semibold text-foreground">Sobre o AutoHub</span>
        </div>
      </div>

      <div className="mx-auto max-w-[680px] px-4 py-12 sm:px-6 sm:py-16 animate-page-in">

        {/* Hero */}
        <div className="flex flex-col items-center text-center gap-5 mb-14">
          {/* Logo grande com gradiente */}
          <div className="relative">
            <div className="size-20 rounded-2xl bg-purple-bg flex items-center justify-center shadow-lg ring-1 ring-purple/20">
              <svg viewBox="0 0 100 100" fill="none" className="size-10" aria-hidden="true">
                <defs>
                  <linearGradient id="lg" x1="15%" y1="5%" x2="85%" y2="95%" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#e879f9" />
                    <stop offset="100%" stopColor="#6d28d9" />
                  </linearGradient>
                </defs>
                {/* Aro */}
                <circle cx="50" cy="50" r="43.5" stroke="url(#lg)" strokeWidth="5" />
                {/* 5 raios hollow GTI */}
                <g fill="url(#lg)" fillRule="evenodd" transform="rotate(-90,50,50)">
                  {[0, 72, 144, 216, 288].map((a) => (
                    <path
                      key={a}
                      d="M 63 50 Q 70 27 77.96 20.01 A 41 41 0 0 1 90.94 47.85 Q 82 57 63 50 Z M 66 50 Q 72 35 77.07 24.77 A 37 37 0 0 1 86.86 46.78 Q 80 55 66 50 Z"
                      transform={a ? `rotate(${a},50,50)` : undefined}
                    />
                  ))}
                </g>
                {/* Hub */}
                <circle cx="50" cy="50" r="13.5" stroke="url(#lg)" strokeWidth="4.5" />
                <circle cx="50" cy="50" r="4" fill="url(#lg)" />
              </svg>
            </div>
          </div>

          <div>
            <h1 className="font-display text-4xl font-bold text-foreground sm:text-5xl">AutoHub</h1>
            <p className="mt-2 text-lg font-medium text-purple">A rede social dos builders</p>
          </div>

          <p className="max-w-md text-base text-muted-foreground leading-relaxed">
            Uma plataforma para quem leva o próprio carro a sério. Documente seu projeto, acompanhe builds da comunidade e conecte-se com outros entusiastas que entendem o que é viver de garagem.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Ir para minha garagem
            </Link>
            <Link
              to="/feed"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-6 py-3 text-sm font-semibold text-foreground hover:bg-surface/80 transition-colors"
            >
              Explorar feed
            </Link>
          </div>
        </div>

        {/* Divisor */}
        <div className="border-t border-border mb-12" />

        {/* Features */}
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground mb-8 text-center">O que você encontra aqui</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl border border-border bg-surface p-5 flex gap-4 items-start"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple-bg text-purple">
                  <Icon className="size-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{title}</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-14 text-center">
          <p className="text-xs text-faint-foreground">
            AutoHub · Feito por builders, para builders.
          </p>
        </div>
      </div>
    </div>
  )
}
