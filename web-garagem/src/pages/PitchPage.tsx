import { Logo } from "@/components/shared/Logo"
import {
  Wrench, TrendingUp, Users, ShoppingBag, Navigation, CalendarDays,
  Shield, Zap, Globe, Code2, Database, Server, Layers,
  CheckCircle, ArrowRight, Mail, ExternalLink, Target, Sparkles
} from "lucide-react"

const FEATURES = [
  { icon: Wrench,       title: "Build Tracker",    desc: "Fases, itens, orçamentos por moeda (BRL/USD/PYG) e progresso em tempo real." },
  { icon: ShoppingBag, title: "Marketplace",       desc: "Compra e venda de peças entre a comunidade com sistema de interesse e patrocínio de anúncios." },
  { icon: Users,        title: "Feed & Social",     desc: "Follows, feed público de builds, notificações em tempo real para a comunidade." },
  { icon: Navigation,   title: "AutoHub Tracks",    desc: "GPS ao vivo, cronometragem de percursos e histórico de voltas por pista." },
  { icon: CalendarDays, title: "Eventos",           desc: "Calendário colaborativo de encontros, track days e eventos automotivos." },
  { icon: Globe,        title: "Lojas Públicas",    desc: "Perfil público por garagem com vitrine de anúncios, bio e contatos." },
]

const STACK = [
  { icon: Code2,    name: "React 19 + Vite",          role: "Frontend" },
  { icon: Server,   name: "Hono + Bun",               role: "API — edge-ready" },
  { icon: Database, name: "Neon (Postgres serverless)",role: "Banco de dados" },
  { icon: Layers,   name: "Netlify Functions",         role: "Deploy serverless" },
  { icon: Shield,   name: "JWT + OAuth Google",        role: "Autenticação" },
  { icon: Zap,      name: "Cloudinary",               role: "CDN de imagens" },
]

const ROADMAP = [
  { fase: "Agora",        items: ["MVP funcional completo", "Marketplace + Lojas", "Tracks GPS", "Feed social"] },
  { fase: "3–6 meses",   items: ["App mobile nativo (React Native)", "Pagamentos no marketplace", "Recomendações por IA (peças e builds similares)", "API pública para integrações"] },
  { fase: "6–12 meses",  items: ["Expansão LATAM (PT + ES)", "Parcerias com lojas e distribuidoras", "Planos premium para lojas", "AutoHub Pro para mecânicos"] },
]

export default function PitchPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">

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
            Oportunidade Early Stage · MVP funcional
          </div>
          <h1 className="font-display text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            Auto<span className="text-purple">Hub</span>
          </h1>
          <p className="mt-4 text-xl text-muted-foreground">
            A plataforma definitiva para quem vive de modificar carros.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Tracker de builds, marketplace de peças, comunidade social e cronometragem de pistas —
            tudo em um ecossistema construído especificamente para o mercado automotivo.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="https://autohubbr.netlify.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-purple px-6 py-3 text-[14px] font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Ver o produto ao vivo <ArrowRight className="size-4" />
            </a>
            <a
              href="mailto:guivalen00@gmail.com"
              className="flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-[14px] font-medium text-foreground hover:bg-surface transition-colors"
            >
              <Mail className="size-4" /> Falar com o fundador
            </a>
          </div>
        </div>
      </section>

      {/* ── O Problema ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-purple">O Problema</div>
        <h2 className="font-display text-3xl font-bold text-foreground">
          Entusiastas automotivos não têm onde se organizar.
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { titulo: "Builds em planilhas", desc: "Mecânicos e entusiastas controlam projetos de R$ 50k+ em Excel ou cadernos, sem visibilidade de custo real." },
            { titulo: "Marketplace fragmentado", desc: "Compra e venda de peças espalhada em grupos de WhatsApp, Facebook e OLX — sem reputação, sem histórico, sem segurança." },
            { titulo: "Comunidade sem identidade", desc: "Nenhuma plataforma une builds, peças e eventos em um só lugar focado nesse nicho específico." },
          ].map(({ titulo, desc }) => (
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
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-purple">O Mercado</div>
          <h2 className="font-display text-3xl font-bold text-foreground">
            Um mercado enorme, sem um líder claro.
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { numero: "42M+",    label: "veículos registrados no Brasil", icon: Target },
              { numero: "R$ 28bi", label: "mercado de acessórios e peças (2023)", icon: TrendingUp },
              { numero: "0",       label: "plataforma dominante nesse nicho", icon: Globe },
            ].map(({ numero, label, icon: Icon }) => (
              <div key={numero} className="flex flex-col gap-2">
                <Icon className="size-6 text-purple" />
                <span className="font-data text-4xl font-bold text-foreground">{numero}</span>
                <span className="text-[13px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-8 text-[14px] leading-relaxed text-muted-foreground max-w-2xl">
            O Brasil é o <strong className="text-foreground">7º maior mercado automotivo do mundo</strong>.
            O público de modificação — street builds, track days, restomods — é apaixonado, gasta bem acima da média e
            consome conteúdo automotivo diariamente. Nenhuma plataforma vertical serve esse público hoje.
          </p>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-purple">O Produto</div>
        <h2 className="font-display text-3xl font-bold text-foreground">
          Um ecossistema completo, não só mais um app.
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-border bg-surface p-5 hover:border-purple/30 transition-colors">
              <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-purple-bg text-purple">
                <Icon className="size-4" />
              </div>
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Modelo de negócio ──────────────────────────────────────────────── */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-purple">Modelo de Negócio</div>
          <h2 className="font-display text-3xl font-bold text-foreground">
            Múltiplas fontes de receita naturais ao produto.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { titulo: "Anúncios patrocinados",    desc: "Vendedores pagam para destacar peças no marketplace. Já implementado no MVP.", badge: "Ao vivo" },
              { titulo: "AutoHub Pro",              desc: "Plano premium para mecânicos e lojas: analytics, destaque, integrações.", badge: "Roadmap" },
              { titulo: "Comissão marketplace",     desc: "Percentual sobre transações realizadas dentro da plataforma.", badge: "Roadmap" },
              { titulo: "Parcerias e B2B",          desc: "Lojas de peças e distribuidoras pagam por visibilidade e dados de demanda.", badge: "Roadmap" },
            ].map(({ titulo, desc, badge }) => (
              <div key={titulo} className="flex gap-4 rounded-xl border border-border bg-background p-5">
                <CheckCircle className="mt-0.5 size-5 shrink-0 text-green" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{titulo}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge === "Ao vivo" ? "bg-green-bg text-green" : "bg-purple-bg text-purple"}`}>
                      {badge}
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
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-purple">Tecnologia</div>
        <h2 className="font-display text-3xl font-bold text-foreground">
          Stack moderna, custo quase zero, escala para milhões.
        </h2>
        <p className="mt-3 text-[14px] text-muted-foreground max-w-xl">
          Toda a infraestrutura é serverless — sem servidores para gerenciar, custo proporcional ao uso,
          e capacidade de escalar automaticamente.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STACK.map(({ icon: Icon, name, role }) => (
            <div key={name} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-purple-bg text-purple">
                <Icon className="size-4" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-foreground">{name}</p>
                <p className="text-[11px] text-faint-foreground">{role}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
          <ExternalLink className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-[13px] font-semibold text-foreground">Código aberto e auditável</p>
            <p className="text-[12px] text-muted-foreground">
              Todo o código-fonte está disponível no GitHub para due diligence técnica.
              Repositório: <span className="text-purple">github.com/guiPinheiroAfK/Autohub</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── Roadmap ────────────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-purple">Roadmap</div>
          <h2 className="font-display text-3xl font-bold text-foreground">
            Produto funcional hoje. Visão clara para amanhã.
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {ROADMAP.map(({ fase, items }, i) => (
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

      {/* ── Fundador ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-purple">O Fundador</div>
        <h2 className="font-display text-3xl font-bold text-foreground">Guilherme Pinheiro</h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Desenvolvedor full-stack e entusiasta automotivo. Construiu o AutoHub do zero —
          da concepção ao MVP funcional em produção — com stack moderna e custo de infraestrutura
          próximo de zero. Produto, código e visão de negócio na mesma pessoa.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="mailto:guivalen00@gmail.com"
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-[13px] text-foreground hover:bg-surface transition-colors"
          >
            <Mail className="size-4 text-purple" />
            guivalen00@gmail.com
          </a>
          <a
            href="https://github.com/guiPinheiroAfK"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-[13px] text-foreground hover:bg-surface transition-colors"
          >
            <ExternalLink className="size-4" />
            github.com/guiPinheiroAfK
          </a>
        </div>
      </section>

      {/* ── CTA final ──────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-purple/5">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="font-display text-3xl font-bold text-foreground">
            Vamos construir isso juntos?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-muted-foreground">
            O MVP está no ar, o código está limpo e a visão é clara.
            Buscamos um parceiro que some network, experiência e/ou capital para acelerar.
          </p>
          <a
            href="mailto:guivalen00@gmail.com?subject=AutoHub — Interesse em parceria"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-purple px-8 py-3.5 text-[15px] font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <Mail className="size-5" />
            Entrar em contato
          </a>
          <p className="mt-6 text-[11px] text-faint-foreground">
            Esta página é confidencial e compartilhada por convite direto.
          </p>
        </div>
      </section>

    </div>
  )
}
