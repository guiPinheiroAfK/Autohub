export type Lang = "pt" | "en" | "es"

export const LANG_OPTIONS: { value: Lang; label: string; flag: string }[] = [
  { value: "pt", label: "Português", flag: "🇧🇷" },
  { value: "en", label: "English",   flag: "🇺🇸" },
  { value: "es", label: "Español",   flag: "🇪🇸" },
]

export const translations = {
  pt: {
    /* ── App shell ──────────────────────────────────────────────────────── */
    nav_garage:      "Garagem",
    nav_feed:        "Feed",
    nav_marketplace: "Marketplace",
    nav_my_store:    "Minha Loja",
    nav_tracks:      "Tracks",
    nav_events:      "Eventos",
    nav_settings:    "Configurações",
    nav_logout:      "Sair",

    notif_title:    "Notificações",
    notif_empty:    "Nenhuma notificação",
    notif_mark_all: "Marcar todas como lidas",

    upload_sending:    "Enviando...",
    upload_click:      "Clique para enviar imagem",
    upload_error:      "Erro ao enviar imagem",
    upload_size_error: "A imagem não pode ultrapassar 2 MB.",

    lang_label: "Idioma",
    badge: "Oportunidade Early Stage · MVP funcional",
    hero_tagline: "A plataforma definitiva para quem vive de modificar carros.",
    hero_desc: "Tracker de builds, marketplace de peças, comunidade social e cronometragem de pistas — tudo em um ecossistema construído especificamente para o mercado automotivo.",
    cta_live: "Ver o produto ao vivo",
    cta_email: "Falar com o fundador",

    problem_label: "O Problema",
    problem_title: "Entusiastas automotivos não têm onde se organizar.",
    problem_cards: [
      { titulo: "Builds em planilhas", desc: "Mecânicos e entusiastas controlam projetos de R$ 50k+ em Excel ou cadernos, sem visibilidade de custo real." },
      { titulo: "Marketplace fragmentado", desc: "Compra e venda de peças espalhada em grupos de WhatsApp, Facebook e OLX — sem reputação, sem histórico, sem segurança." },
      { titulo: "Comunidade sem identidade", desc: "Nenhuma plataforma une builds, peças e eventos em um só lugar focado nesse nicho específico." },
    ],

    market_label: "O Mercado",
    market_title: "Um mercado enorme, sem um líder claro.",
    market_stats: [
      { numero: "42M+", label: "veículos registrados no Brasil" },
      { numero: "R$ 28bi", label: "mercado de acessórios e peças (2023)" },
      { numero: "0", label: "plataforma dominante nesse nicho" },
    ],
    market_desc: "O Brasil é o <strong>7º maior mercado automotivo do mundo</strong>. O público de modificação — street builds, track days, restomods — é apaixonado, gasta bem acima da média e consome conteúdo automotivo diariamente. Nenhuma plataforma vertical serve esse público hoje.",

    product_label: "O Produto",
    product_title: "Um ecossistema completo, não só mais um app.",

    biz_label: "Modelo de Negócio",
    biz_title: "Múltiplas fontes de receita naturais ao produto.",
    biz_badge_live: "Ao vivo",
    biz_badge_roadmap: "Roadmap",
    biz_items: [
      { titulo: "Anúncios patrocinados", desc: "Vendedores pagam para destacar peças no marketplace. Já implementado no MVP.", badge: "live" },
      { titulo: "AutoHub Pro", desc: "Plano premium para mecânicos e lojas: analytics, destaque, integrações.", badge: "roadmap" },
      { titulo: "Comissão marketplace", desc: "Percentual sobre transações realizadas dentro da plataforma.", badge: "roadmap" },
      { titulo: "Parcerias e B2B", desc: "Lojas de peças e distribuidoras pagam por visibilidade e dados de demanda.", badge: "roadmap" },
    ],

    tech_label: "Tecnologia",
    tech_title: "Stack moderna, custo quase zero, escala para milhões.",
    tech_desc: "Toda a infraestrutura é serverless — sem servidores para gerenciar, custo proporcional ao uso, e capacidade de escalar automaticamente.",
    tech_open_title: "Código aberto e auditável",
    tech_open_desc: "Todo o código-fonte está disponível no GitHub para due diligence técnica. Repositório:",

    roadmap_label: "Roadmap",
    roadmap_title: "Produto funcional hoje. Visão clara para amanhã.",
    roadmap_items: [
      { fase: "Agora", items: ["MVP funcional completo", "Marketplace + Lojas", "Tracks GPS", "Feed social"] },
      { fase: "3–6 meses", items: ["App mobile nativo (React Native)", "Pagamentos no marketplace", "Recomendações por IA (peças e builds similares)", "API pública para integrações"] },
      { fase: "6–12 meses", items: ["Expansão LATAM (PT + ES)", "Parcerias com lojas e distribuidoras", "Planos premium para lojas", "AutoHub Pro para mecânicos"] },
    ],

    portfolio_label: "Portfólio do Fundador",
    portfolio_title: "Outros projetos, mesma dedicação.",
    portfolio_desc: "Projetos construídos do zero com foco em produto real, não só em código.",

    founder_label: "O Fundador",
    founder_name: "Guilherme Pinheiro",
    founder_bio: "Desenvolvedor full-stack e entusiasta automotivo. Construiu o AutoHub do zero — da concepção ao MVP funcional em produção — com stack moderna e custo de infraestrutura próximo de zero. Produto, código e visão de negócio na mesma pessoa.",

    cta_title: "Vamos construir isso juntos?",
    cta_desc: "O MVP está no ar, o código está limpo e a visão é clara. Buscamos um parceiro que some network, experiência e/ou capital para acelerar.",
    cta_btn: "Entrar em contato",
    cta_fine: "Esta página é confidencial e compartilhada por convite direto.",
  },

  en: {
    /* ── App shell ──────────────────────────────────────────────────────── */
    nav_garage:      "Garage",
    nav_feed:        "Feed",
    nav_marketplace: "Marketplace",
    nav_my_store:    "My Store",
    nav_tracks:      "Tracks",
    nav_events:      "Events",
    nav_settings:    "Settings",
    nav_logout:      "Sign Out",

    notif_title:    "Notifications",
    notif_empty:    "No notifications",
    notif_mark_all: "Mark all as read",

    upload_sending:    "Uploading...",
    upload_click:      "Click to upload image",
    upload_error:      "Error uploading image",
    upload_size_error: "Image cannot exceed 2 MB.",

    lang_label: "Language",
    badge: "Early Stage Opportunity · Working MVP",
    hero_tagline: "The definitive platform for car modification enthusiasts.",
    hero_desc: "Build tracker, parts marketplace, social community, and track timing — all in one ecosystem built specifically for the automotive market.",
    cta_live: "See the live product",
    cta_email: "Talk to the founder",

    problem_label: "The Problem",
    problem_title: "Car enthusiasts have nowhere to stay organized.",
    problem_cards: [
      { titulo: "Builds tracked in spreadsheets", desc: "Mechanics and enthusiasts manage $10k+ projects in Excel or notebooks, with no real cost visibility." },
      { titulo: "Fragmented marketplace", desc: "Parts buying and selling scattered across WhatsApp groups, Facebook, and classifieds — no reputation, no history, no safety." },
      { titulo: "Community without identity", desc: "No platform brings builds, parts, and events together in one place focused on this specific niche." },
    ],

    market_label: "The Market",
    market_title: "A massive market with no clear leader.",
    market_stats: [
      { numero: "42M+", label: "registered vehicles in Brazil" },
      { numero: "$5bi+", label: "accessories & parts market (2023)" },
      { numero: "0", label: "dominant platform in this niche" },
    ],
    market_desc: "Brazil is the <strong>7th largest automotive market in the world</strong>. The modification crowd — street builds, track days, restomods — is passionate, spends well above average, and consumes automotive content daily. No vertical platform serves this audience today.",

    product_label: "The Product",
    product_title: "A complete ecosystem, not just another app.",

    biz_label: "Business Model",
    biz_title: "Multiple revenue streams native to the product.",
    biz_badge_live: "Live",
    biz_badge_roadmap: "Roadmap",
    biz_items: [
      { titulo: "Sponsored listings", desc: "Sellers pay to feature parts in the marketplace. Already implemented in the MVP.", badge: "live" },
      { titulo: "AutoHub Pro", desc: "Premium plan for mechanics and shops: analytics, highlighting, integrations.", badge: "roadmap" },
      { titulo: "Marketplace commission", desc: "Percentage on transactions completed within the platform.", badge: "roadmap" },
      { titulo: "Partnerships & B2B", desc: "Parts shops and distributors pay for visibility and demand data.", badge: "roadmap" },
    ],

    tech_label: "Technology",
    tech_title: "Modern stack, near-zero cost, scales to millions.",
    tech_desc: "All infrastructure is serverless — no servers to manage, cost proportional to usage, and ability to scale automatically.",
    tech_open_title: "Open source and auditable",
    tech_open_desc: "All source code is available on GitHub for technical due diligence. Repository:",

    roadmap_label: "Roadmap",
    roadmap_title: "Working product today. Clear vision for tomorrow.",
    roadmap_items: [
      { fase: "Now", items: ["Fully working MVP", "Marketplace + Shops", "GPS Tracks", "Social Feed"] },
      { fase: "3–6 months", items: ["Native mobile app (React Native)", "Marketplace payments", "AI recommendations (similar parts & builds)", "Public API for integrations"] },
      { fase: "6–12 months", items: ["LATAM expansion (PT + ES)", "Partnerships with shops & distributors", "Premium plans for shops", "AutoHub Pro for mechanics"] },
    ],

    portfolio_label: "Founder's Portfolio",
    portfolio_title: "Other projects, same dedication.",
    portfolio_desc: "Projects built from scratch focused on real product, not just code.",

    founder_label: "The Founder",
    founder_name: "Guilherme Pinheiro",
    founder_bio: "Full-stack developer and car enthusiast. Built AutoHub from scratch — from concept to working MVP in production — with a modern stack and near-zero infrastructure cost. Product, code, and business vision in one person.",

    cta_title: "Let's build this together?",
    cta_desc: "The MVP is live, the code is clean, and the vision is clear. We're looking for a partner who brings network, experience, and/or capital to accelerate.",
    cta_btn: "Get in touch",
    cta_fine: "This page is confidential and shared by direct invitation.",
  },

  es: {
    /* ── App shell ──────────────────────────────────────────────────────── */
    nav_garage:      "Garaje",
    nav_feed:        "Feed",
    nav_marketplace: "Marketplace",
    nav_my_store:    "Mi Tienda",
    nav_tracks:      "Tracks",
    nav_events:      "Eventos",
    nav_settings:    "Configuraciones",
    nav_logout:      "Salir",

    notif_title:    "Notificaciones",
    notif_empty:    "Sin notificaciones",
    notif_mark_all: "Marcar todas como leídas",

    upload_sending:    "Enviando...",
    upload_click:      "Haz clic para subir imagen",
    upload_error:      "Error al subir imagen",
    upload_size_error: "La imagen no puede superar 2 MB.",

    lang_label: "Idioma",
    badge: "Oportunidad Early Stage · MVP funcional",
    hero_tagline: "La plataforma definitiva para quienes viven de modificar autos.",
    hero_desc: "Tracker de builds, marketplace de piezas, comunidad social y cronometraje de pistas — todo en un ecosistema construido específicamente para el mercado automotriz.",
    cta_live: "Ver el producto en vivo",
    cta_email: "Hablar con el fundador",

    problem_label: "El Problema",
    problem_title: "Los entusiastas automotrices no tienen dónde organizarse.",
    problem_cards: [
      { titulo: "Builds en planillas", desc: "Mecánicos y entusiastas controlan proyectos de $10k+ en Excel o cuadernos, sin visibilidad real de costos." },
      { titulo: "Marketplace fragmentado", desc: "Compra y venta de piezas esparcida en grupos de WhatsApp, Facebook y clasificados — sin reputación, sin historial, sin seguridad." },
      { titulo: "Comunidad sin identidad", desc: "Ninguna plataforma une builds, piezas y eventos en un solo lugar enfocado en este nicho específico." },
    ],

    market_label: "El Mercado",
    market_title: "Un mercado enorme, sin un líder claro.",
    market_stats: [
      { numero: "42M+", label: "vehículos registrados en Brasil" },
      { numero: "$5bi+", label: "mercado de accesorios y piezas (2023)" },
      { numero: "0", label: "plataforma dominante en este nicho" },
    ],
    market_desc: "Brasil es el <strong>7° mercado automotriz más grande del mundo</strong>. El público de modificación — street builds, track days, restomods — es apasionado, gasta muy por encima del promedio y consume contenido automotriz a diario. Ninguna plataforma vertical sirve a este público hoy.",

    product_label: "El Producto",
    product_title: "Un ecosistema completo, no solo otra app.",

    biz_label: "Modelo de Negocio",
    biz_title: "Múltiples fuentes de ingresos naturales al producto.",
    biz_badge_live: "En vivo",
    biz_badge_roadmap: "Roadmap",
    biz_items: [
      { titulo: "Anuncios patrocinados", desc: "Vendedores pagan para destacar piezas en el marketplace. Ya implementado en el MVP.", badge: "live" },
      { titulo: "AutoHub Pro", desc: "Plan premium para mecánicos y tiendas: analytics, destacado, integraciones.", badge: "roadmap" },
      { titulo: "Comisión marketplace", desc: "Porcentaje sobre transacciones realizadas dentro de la plataforma.", badge: "roadmap" },
      { titulo: "Alianzas y B2B", desc: "Tiendas de piezas y distribuidoras pagan por visibilidad y datos de demanda.", badge: "roadmap" },
    ],

    tech_label: "Tecnología",
    tech_title: "Stack moderno, costo casi cero, escala para millones.",
    tech_desc: "Toda la infraestructura es serverless — sin servidores que gestionar, costo proporcional al uso y capacidad de escalar automáticamente.",
    tech_open_title: "Código abierto y auditable",
    tech_open_desc: "Todo el código fuente está disponible en GitHub para due diligence técnica. Repositorio:",

    roadmap_label: "Roadmap",
    roadmap_title: "Producto funcional hoy. Visión clara para mañana.",
    roadmap_items: [
      { fase: "Ahora", items: ["MVP completo y funcional", "Marketplace + Tiendas", "Tracks GPS", "Feed social"] },
      { fase: "3–6 meses", items: ["App móvil nativa (React Native)", "Pagos en el marketplace", "Recomendaciones por IA (piezas y builds similares)", "API pública para integraciones"] },
      { fase: "6–12 meses", items: ["Expansión LATAM (PT + ES)", "Alianzas con tiendas y distribuidoras", "Planes premium para tiendas", "AutoHub Pro para mecánicos"] },
    ],

    portfolio_label: "Portafolio del Fundador",
    portfolio_title: "Otros proyectos, misma dedicación.",
    portfolio_desc: "Proyectos construidos desde cero con foco en producto real, no solo en código.",

    founder_label: "El Fundador",
    founder_name: "Guilherme Pinheiro",
    founder_bio: "Desarrollador full-stack y entusiasta automotriz. Construyó AutoHub desde cero — desde la concepción hasta el MVP funcional en producción — con stack moderno y costo de infraestructura casi cero. Producto, código y visión de negocio en una sola persona.",

    cta_title: "¿Construimos esto juntos?",
    cta_desc: "El MVP está en línea, el código es limpio y la visión es clara. Buscamos un socio que aporte network, experiencia y/o capital para acelerar.",
    cta_btn: "Ponerse en contacto",
    cta_fine: "Esta página es confidencial y compartida por invitación directa.",
  },
} satisfies Record<Lang, Record<string, unknown>>

export type Translations = typeof translations.pt
