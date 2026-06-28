const CACHE = "autohub-v2"
const STATIC = ["/", "/index.html"]

// Instala e pré-cacheia shell estático
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  )
})

// Limpa caches antigos na ativação
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url)

  // Cross-origin (mapas/tiles vetoriais, glyphs, sprites, fontes externas):
  // NÃO intercepta — deixa o browser cuidar. O MapLibre cancela requisições de
  // tile ao mover o mapa; envolvê-las no SW quebra esse cancelamento e os tiles
  // nunca carregam (mapa preto).
  if (url.origin !== self.location.origin) return

  // API: sempre network-first — não cacheamos dados
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/auth")) {
    e.respondWith(fetch(e.request))
    return
  }

  // Assets estáticos same-origin (JS/CSS/imagens): cache-first
  if (url.pathname.match(/\.(js|css|woff2?|png|jpg|jpeg|webp|svg|ico)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(e.request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // SPA: network-first, fallback para index.html (permite navegação offline)
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match("/index.html").then(r => r ?? new Response("Offline"))
    )
  )
})

// Web Push: exibe notificação quando chega um push
self.addEventListener("push", (e) => {
  const data = e.data?.json() ?? { title: "AutoHub", body: "" }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      data: { url: data.url ?? "/" },
    })
  )
})

// Clique na notificação — abre a URL
self.addEventListener("notificationclick", (e) => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(all => {
      const existing = all.find(c => c.url === e.notification.data.url)
      if (existing) return existing.focus()
      return clients.openWindow(e.notification.data.url)
    })
  )
})
