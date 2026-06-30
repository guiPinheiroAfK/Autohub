import { Logo } from "@/components/shared/Logo"
import { useLang } from "@/context/LangContext"
import type { Lang } from "@/lib/i18n"
import {
  Wrench, TrendingUp, Users, ShoppingBag, Navigation, CalendarDays,
  Shield, Zap, Globe, Code2, Database, Server, Layers,
  CheckCircle, ArrowRight, Mail, ExternalLink, Target, Sparkles,
  Package, Cpu,
} from "lucide-react"

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

const FEATURES_ICONS = [Wrench, ShoppingBag, Users, Navigation, CalendarDays, Globe]

const STACK = [
  { icon: Code2,    name: "React 19 + Vite",           role_pt: "Frontend",           role_en: "Frontend",           role_es: "Frontend" },
  { icon: Server,   name: "Hono + Bun",                role_pt: "API — edge-ready",   role_en: "API — edge-ready",   role_es: "API — edge-ready" },
  { icon: Database, name: "Neon (Postgres serverless)", role_pt: "Banco de dados",     role_en: "Database",           role_es: "Base de datos" },
  { icon: Layers,   name: "Netlify Functions",          role_pt: "Deploy serverless",  role_en: "Serverless deploy",  role_es: "Deploy serverless" },
  { icon: Shield,   name: "JWT + OAuth Google",         role_pt: "Autenticação",       role_en: "Authentication",     role_es: "Autenticación" },
  { icon: Zap,      name: "Cloudinary",                role_pt: "CDN de imagens",     role_en: "Image CDN",          role_es: "CDN de imágenes" },
]

const PORTFOLIO_PROJECTS = [
  {
    icon: Wrench,
    name: "AutoHub",
    url: "https://autohubbr.netlify.app",
    repo: "https://github.com/guiPinheiroAfK/Autohub",
    tags: ["React 19", "Hono", "Neon", "Netlify"],
    desc_pt: "Plataforma completa para entusiastas automotivos — build tracker, marketplace, social e tracks GPS. MVP em produção.",
    desc_en: "Complete platform for car enthusiasts — build tracker, marketplace, social feed, and GPS tracks. MVP live in production.",
    desc_es: "Plataforma completa para entusiastas automotrices — build tracker, marketplace, social y tracks GPS. MVP en producción.",
  },
  {
    icon: Package,
    name: "FastFeet API",
    url: null,
    repo: "https://github.com/guiPinheiroAfK/FastFeet",
    tags: ["Node.js", "Prisma", "PostgreSQL", "RBAC"],
    desc_pt: "Backend de transportadora com RBAC completo, máquina de estados para encomendas e upload obrigatório de foto na entrega.",
    desc_en: "Courier backend with full RBAC, parcel state machine, and mandatory photo upload on delivery.",
    desc_es: "Backend de mensajería con RBAC completo, máquina de estados para paquetes y carga obligatoria de foto en entrega.",
  },
  {
    icon: Cpu,
    name: "ConnectNotify",
    url: null,
    repo: "https://github.com/guiPinheiroAfK/ConnectNotify-Performance-",
    tags: ["FastAPI", "Celery", "Redis", "React"],
    desc_pt: "Sistema de notificações assíncronas com filas Celery + Redis e dashboard React em tempo real para monitoramento de jobs.",
    desc_en: "Async notification system with Celery + Redis queues and a real-time React dashboard for job monitoring.",
    desc_es: "Sistema de notificaciones asíncronas con colas Celery + Redis y dashboard React en tiempo real para monitoreo de jobs.",
  },
]

const LANG_OPTIONS: { code: Lang; label: string; flag: string }[] = [
  { code: "pt", label: "PT", flag: "🇧🇷" },
  { code: "en", label: "EN", flag: "🇺🇸" },
  { code: "es", label: "ES", flag: "🇪🇸" },
]

function LangSwitcher() {
  const { lang, setLang } = useLang()
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
      {LANG_OPTIONS.map(({ code, label, flag }) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-colors ${
            lang === code
              ? "bg-purple text-white"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>{flag}</span>
          {label}
        </button>
      ))}
    </div>
  )
}

function PitchContent() {
  const { lang, t } = useLang()

  const features = [
    { title: "Build Tracker",   desc: t.product_label === "O Produto"
        ? "Fases, itens, orçamentos por moeda (BRL/USD/PYG) e progresso em tempo real."
        : t.product_label === "The Product"
        ? "Phases, items, multi-currency budgets (BRL/USD/PYG) and real-time progress tracking."
        : "Fases, ítems, presupuestos por moneda (BRL/USD/PYG) y progreso en tiempo real." },
    { title: "Marketplace",     desc: t.product_label === "O Produto"
        ? "Compra e venda de peças entre a comunidade com sistema de interesse e patrocínio de anúncios."
        : t.product_label === "The Product"
        ? "Community parts buying & selling with interest system and sponsored listings."
        : "Compra y venta de piezas en la comunidad con sistema de interés y anuncios patrocinados." },
    { title: "Feed & Social",   desc: t.product_label === "O Produto"
        ? "Follows, feed público de builds, notificações em tempo real para a comunidade."
        : t.product_label === "The Product"
        ? "Follows, public builds feed, and real-time notifications for the community."
        : "Follows, feed público de builds, notificaciones en tiempo real para la comunidad." },
    { title: "AutoHub Tracks",  desc: t.product_label === "O Produto"
        ? "GPS ao vivo, cronometragem de percursos e histórico de voltas por pista."
        : t.product_label === "The Product"
        ? "Live GPS, route timing, and lap history per track."
        : "GPS en vivo, cronometraje de recorridos e historial de vueltas por pista." },
    { title: t.product_label === "O Produto" ? "Eventos" : t.product_label === "The Product" ? "Events" : "Eventos",
      desc: t.product_label === "O Produto"
        ? "Calendário colaborativo de encontros, track days e eventos automotivos."
        : t.product_label === "The Product"
        ? "Collaborative calendar for meetups, track days, and automotive events."
        : "Calendario colaborativo de encuentros, track days y eventos automotrices." },
    { title: t.product_label === "O Produto" ? "Lojas Públicas" : t.product_label === "The Product" ? "Public Shops" : "Tiendas Públicas",
      desc: t.product_label === "O Produto"
        ? "Perfil público por garagem com vitrine de anúncios, bio e contatos."
        : t.product_label === "The Product"
        ? "Public garage profile with listings showcase, bio, and contacts."
        : "Perfil público por garaje con vitrina de anuncios, bio y contactos." },
  ]

  const stackRoleKey = lang === "pt" ? "role_pt" : lang === "en" ? "role_en" : "role_es"
  const roadmapItems = t.roadmap_items as Array<{ fase: string; items: string[] }>
  const bizItems = t.biz_items as Array<{ titulo: string; desc: string; badge: string }>
  const problemCards = t.problem_cards as Array<{ titulo: string; desc: string }>
  const marketStats = t.market_stats as Array<{ numero: string; label: string }>

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Lang bar ────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex justify-end border-b border-border bg-background/80 px-6 py-2 backdrop-blur-sm">
        <LangSwitcher />
      </div>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-purple/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-purple-bg text-purple shadow-lg">
              <Logo className="size-9" />
            </div>
          </div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber-bg px-3 py-1 text-[11px] font-semibold text-amber">
            <Sparkles className="size-3" />
            {t.badge}
          </div>
          <h1 className="font-display text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            Auto<span className="text-purple">Hub</span>
          </h1>
          <p className="mt-4 text-xl text-muted-foreground">{t.hero_tagline}</p>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {t.hero_desc}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="https://autohubbr.netlify.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-purple px-6 py-3 text-[14px] font-semibold text-white hover:opacity-90 transition-opacity"
            >
              {t.cta_live} <ArrowRight className="size-4" />
            </a>
            <a
              href="mailto:guivalen00@gmail.com"
              className="flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-[14px] font-medium text-foreground hover:bg-surface transition-colors"
            >
              <Mail className="size-4" /> {t.cta_email}
            </a>
          </div>
        </div>
      </section>

      {/* ── O Problema ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-purple">{t.problem_label}</div>
        <h2 className="font-display text-3xl font-bold text-foreground">{t.problem_title}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {problemCards.map(({ titulo, desc }) => (
            <div key={titulo} className="rounded-xl border border-border bg-surface p-5">
              <div className="mb-2 size-2 rounded-full bg-red" />
              <h3 className="font-semibold text-foreground">{titulo}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── O Mercado ──────────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-purple">{t.market_label}</div>
          <h2 className="font-display text-3xl font-bold text-foreground">{t.market_title}</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {marketStats.map(({ numero, label }, i) => {
              const Icon = [Target, TrendingUp, Globe][i]
              return (
                <div key={numero} className="flex flex-col gap-2">
                  <Icon className="size-6 text-purple" />
                  <span className="font-data text-4xl font-bold text-foreground">{numero}</span>
                  <span className="text-[13px] text-muted-foreground">{label}</span>
                </div>
              )
            })}
          </div>
          <p
            className="mt-8 text-[14px] leading-relaxed text-muted-foreground max-w-2xl"
            dangerouslySetInnerHTML={{ __html: t.market_desc as string }}
          />
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-purple">{t.product_label}</div>
        <h2 className="font-display text-3xl font-bold text-foreground">{t.product_title}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ title, desc }, i) => {
            const Icon = FEATURES_ICONS[i]
            return (
              <div key={title} className="rounded-xl border border-border bg-surface p-5 hover:border-purple/30 transition-colors">
                <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-purple-bg text-purple">
                  <Icon className="size-4" />
                </div>
                <h3 className="font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Modelo de negócio ──────────────────────────────────────────────── */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-purple">{t.biz_label}</div>
          <h2 className="font-display text-3xl font-bold text-foreground">{t.biz_title}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {bizItems.map(({ titulo, desc, badge }) => (
              <div key={titulo} className="flex gap-4 rounded-xl border border-border bg-background p-5">
                <CheckCircle className="mt-0.5 size-5 shrink-0 text-green" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{titulo}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge === "live" ? "bg-green-bg text-green" : "bg-purple-bg text-purple"}`}>
                      {badge === "live" ? t.biz_badge_live : t.biz_badge_roadmap}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stack técnica ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-purple">{t.tech_label}</div>
        <h2 className="font-display text-3xl font-bold text-foreground">{t.tech_title}</h2>
        <p className="mt-3 text-[14px] text-muted-foreground max-w-xl">{t.tech_desc}</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STACK.map(({ icon: Icon, name, ...roles }) => (
            <div key={name} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-purple-bg text-purple">
                <Icon className="size-4" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-foreground">{name}</p>
                <p className="text-[11px] text-faint-foreground">{roles[stackRoleKey as keyof typeof roles]}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
          <ExternalLink className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-[13px] font-semibold text-foreground">{t.tech_open_title}</p>
            <p className="text-[12px] text-muted-foreground">
              {t.tech_open_desc}{" "}
              <a
                href="https://github.com/guiPinheiroAfK/Autohub"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple hover:underline"
              >
                github.com/guiPinheiroAfK/Autohub
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ── Roadmap ────────────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-purple">{t.roadmap_label}</div>
          <h2 className="font-display text-3xl font-bold text-foreground">{t.roadmap_title}</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {roadmapItems.map(({ fase, items }, i) => (
              <div key={fase} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className={`size-2 rounded-full ${i === 0 ? "bg-green" : i === 1 ? "bg-purple" : "bg-faint-foreground"}`} />
                  <span className="text-[12px] font-semibold text-foreground">{fase}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map(item => (
                    <div key={item} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                      <CheckCircle className={`mt-0.5 size-3.5 shrink-0 ${i === 0 ? "text-green" : "text-faint-foreground"}`} />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Portfólio ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-purple">{t.portfolio_label}</div>
        <h2 className="font-display text-3xl font-bold text-foreground">{t.portfolio_title}</h2>
        <p className="mt-2 text-[14px] text-muted-foreground">{t.portfolio_desc}</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {PORTFOLIO_PROJECTS.map(({ icon: Icon, name, url, repo, tags, desc_pt, desc_en, desc_es }) => {
            const desc = lang === "pt" ? desc_pt : lang === "en" ? desc_en : desc_es
            return (
              <div key={name} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 hover:border-purple/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-purple-bg text-purple">
                    <Icon className="size-4" />
                  </div>
                  <div className="flex items-center gap-2">
                    {url && (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-purple transition-colors">
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                    <a href={repo} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-purple transition-colors">
                      <GithubIcon className="size-3.5" />
                    </a>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{name}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
                </div>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  {tags.map(tag => (
                    <span key={tag} className="rounded-md bg-purple-bg px-2 py-0.5 text-[10px] font-medium text-purple">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Fundador ───────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-purple">{t.founder_label}</div>
          <h2 className="font-display text-3xl font-bold text-foreground">{t.founder_name}</h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{t.founder_bio}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="mailto:guivalen00@gmail.com"
              className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-[13px] text-foreground hover:bg-background transition-colors"
            >
              <Mail className="size-4 text-purple" />
              guivalen00@gmail.com
            </a>
            <a
              href="https://github.com/guiPinheiroAfK"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-[13px] text-foreground hover:bg-background transition-colors"
            >
              <GithubIcon className="size-4" />
              github.com/guiPinheiroAfK
            </a>
          </div>
        </div>
      </section>

      {/* ── CTA final ──────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-purple/5">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="font-display text-3xl font-bold text-foreground">{t.cta_title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-muted-foreground">{t.cta_desc}</p>
          <a
            href="mailto:guivalen00@gmail.com?subject=AutoHub — Interesse em parceria"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-purple px-8 py-3.5 text-[15px] font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <Mail className="size-5" />
            {t.cta_btn}
          </a>
          <p className="mt-6 text-[11px] text-faint-foreground">{t.cta_fine}</p>
        </div>
      </section>

    </div>
  )
}

export default function PitchPage() {
  return <PitchContent />
}
