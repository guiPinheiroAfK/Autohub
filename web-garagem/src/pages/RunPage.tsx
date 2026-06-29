/**
 * RunPage — corrida GPS (largada livre → 1 chegada).
 *
 * Mapa: MapLibre GL (vetorial, nítido, com inclinação/bearing nativos).
 * Rota: OSRM público (segue as ruas, sem chave).
 * Fluxo: loading → staging (preview + semáforo) → running → finished.
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useSearchParams, useNavigate } from "react-router-dom"
import { Flag, MapPin, X, CheckCircle, Ghost as GhostIcon, Navigation, LocateFixed } from "lucide-react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { api } from "@/lib/api/client"
import type { Rota, Ghost, GhostPonto } from "@/types/tracks"
import type { VeiculoComMetricas } from "@/types"

// ── Tipos internos ────────────────────────────────────────────────────────────

interface Ponto { lat: number; lng: number; velocidade_kmh: number; ts: number; offset_ms: number }
type LngLat = { lat: number; lng: number }

// ── Constantes ──────────────────────────────────────────────────────────────────

const CARTO_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
const OSRM = "https://router.project-osrm.org/route/v1/driving"
const GHOST_COLORS = ["#a855f7", "#ec4899", "#f97316"]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuracao(ms: number) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDist(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

function ghostPosAt(pontos: GhostPonto[], elapsed_ms: number): [number, number] | null {
  if (pontos.length === 0) return null
  const last = pontos[pontos.length - 1]
  if (elapsed_ms >= last.offset_ms) return [Number(last.lat), Number(last.lng)]
  for (let i = 1; i < pontos.length; i++) {
    if (pontos[i].offset_ms >= elapsed_ms) {
      const prev = pontos[i - 1]; const curr = pontos[i]
      const t = (elapsed_ms - prev.offset_ms) / (curr.offset_ms - prev.offset_ms)
      return [
        Number(prev.lat) + (Number(curr.lat) - Number(prev.lat)) * t,
        Number(prev.lng) + (Number(curr.lng) - Number(prev.lng)) * t,
      ]
    }
  }
  return [Number(pontos[0].lat), Number(pontos[0].lng)]
}

// GeoJSON LineString a partir de coords [lng,lat]
function lineFeature(coords: [number, number][]) {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } } as GeoJSON.Feature
}

function boundsOf(coords: [number, number][]): maplibregl.LngLatBoundsLike | null {
  if (coords.length === 0) return null
  let w = coords[0][0], e = coords[0][0], s = coords[0][1], n = coords[0][1]
  for (const [lng, lat] of coords) { w = Math.min(w, lng); e = Math.max(e, lng); s = Math.min(s, lat); n = Math.max(n, lat) }
  return [[w, s], [e, n]]
}

// Marcadores (elementos DOM)
function carEl() {
  const d = document.createElement("div")
  d.innerHTML = `<div style="width:20px;height:20px;border-radius:50%;background:#e879f9;border:3px solid #fff;box-shadow:0 0 0 4px rgba(232,121,249,.3),0 0 14px #e879f9"></div>`
  return d.firstElementChild as HTMLElement
}
function flagEl() {
  const d = document.createElement("div")
  d.innerHTML = `<div style="width:30px;height:30px;border-radius:50%;background:#7f77dd;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 6px rgba(127,119,221,.25)">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
  </div>`
  return d.firstElementChild as HTMLElement
}
function ghostEl(color: string) {
  const d = document.createElement("div")
  d.innerHTML = `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 8px ${color}aa"></div>`
  return d.firstElementChild as HTMLElement
}

// Rota pelas ruas (OSRM). Retorna coords [lng,lat] ou null.
async function fetchRoute(from: LngLat, to: LngLat): Promise<[number, number][] | null> {
  try {
    const url = `${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const d = await r.json()
    const coords = d?.routes?.[0]?.geometry?.coordinates
    return Array.isArray(coords) && coords.length > 1 ? coords : null
  } catch { return null }
}

// ── Componente ──────────────────────────────────────────────────────────────────

type RunPhase = "loading" | "gps_error" | "staging" | "running" | "finished"

export default function RunPage() {
  const { rotaId } = useParams<{ rotaId: string }>()
  const [params] = useSearchParams()
  const veiculoId = params.get("veiculo") ?? ""
  const navigate = useNavigate()

  const [phase, setPhase] = useState<RunPhase>("loading")
  const [erroMsg, setErroMsg] = useState("")

  const [rota, setRota] = useState<Rota | null>(null)
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const [veiculo, setVeiculo] = useState<VeiculoComMetricas | null>(null)
  const [, setRunId] = useState<string | null>(null)

  const [elapsed, setElapsed] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [maxSpeed, setMaxSpeed] = useState(0)
  const [distancia, setDistancia] = useState(0)
  const [distFalta, setDistFalta] = useState<number | null>(null)
  const [perto, setPerto] = useState(false)
  const [nav, setNav] = useState(true) // visão inclinada (navegação) vs topo

  const [userStart, setUserStart] = useState<LngLat | null>(null)
  const [beat, setBeat] = useState(-1)

  const [resultado, setResultado] = useState<{ duracao_s: number; vel_media_kmh: number; vel_max_kmh: number; badges: string[] } | null>(null)

  // Refs
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInst = useRef<maplibregl.Map | null>(null)
  const userMarker = useRef<maplibregl.Marker | null>(null)
  const ghostMarkers = useRef<maplibregl.Marker[]>([])
  const watchId = useRef<number | null>(null)
  const startedAt = useRef<number>(0)
  const pontosBuffer = useRef<Ponto[]>([])
  const allPontos = useRef<Ponto[]>([])
  const lastPos = useRef<LngLat | null>(null)
  const headingRef = useRef<number | null>(null)
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const syncTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const routeTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const runIdRef = useRef<string | null>(null)
  const finalizando = useRef(false)
  const centralizou = useRef(false)
  const rotaRef = useRef<Rota | null>(null)
  const following = useRef(true)
  const navRef = useRef(true)
  const initStarted = useRef(false)

  // ── Inicialização ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!rotaId || !veiculoId) { navigate("/tracks"); return }

    if (!initStarted.current) {
      initStarted.current = true
      Promise.all([
        api.get<{ rota: Rota }>(`/api/tracks/rotas/${rotaId}`).then((r) => r.rota),
        api.get<{ ghosts: Ghost[] }>(`/api/tracks/rotas/${rotaId}/ghosts`).then((r) => r.ghosts),
        api.get<VeiculoComMetricas[]>("/api/veiculos").then((vs) => vs.find((v) => v.id === veiculoId) ?? null),
        api.post<{ run: { id: string } }>("/api/tracks/runs", { rota_id: rotaId, veiculo_id: veiculoId }).then((r) => r.run.id),
      ]).then(([r, g, v, rid]) => {
        setRota(r); rotaRef.current = r
        setGhosts(g); setVeiculo(v)
        setRunId(rid); runIdRef.current = rid
        iniciarGPS()
      }).catch((err) => { setErroMsg(String(err)); setPhase("gps_error") })
    }

    return () => cleanup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Mapa (MapLibre) — monta em staging/running ────────────────────────────

  useEffect(() => {
    if ((phase !== "staging" && phase !== "running") || !mapRef.current || !rota) return
    if (mapInst.current) return

    const container = mapRef.current
    let cancelled = false

    // rAF garante que o browser pintou o container antes do MapLibre medir.
    // Sem isso, clientWidth/clientHeight podem ser 0 → canvas 0×0 → tela preta.
    const rafId = requestAnimationFrame(() => {
      if (cancelled || !container) return

      const { clientWidth: w, clientHeight: h } = container
      console.log(`[RunPage] container: ${w}×${h}`)

      const chegada: LngLat = { lat: rota.ponto_b_lat, lng: rota.ponto_b_lng }
      const inicio: LngLat = userStart ?? chegada

      const map = new maplibregl.Map({
        container,
        style: CARTO_DARK,
        center: [inicio.lng, inicio.lat],
        zoom: 14,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
      })
      mapInst.current = map

      map.on("dragstart", () => { following.current = false })
      map.on("error", (ev) => console.error("[maplibre error]", ev.error))
      map.on("style.load", () => console.log("[maplibre] style carregado OK"))

      // Se o container ainda era 0 no rAF (raro), resize força nova medição
      setTimeout(() => { if (!cancelled) map.resize() }, 150)

      map.on("load", () => {
        map.resize()
        const cv = map.getCanvas()
        console.log(`[maplibre] load — canvas: ${cv.width}×${cv.height}`)

        new maplibregl.Marker({ element: flagEl(), anchor: "center" }).setLngLat([chegada.lng, chegada.lat]).addTo(map)
        userMarker.current = new maplibregl.Marker({ element: carEl(), anchor: "center" }).setLngLat([inicio.lng, inicio.lat]).addTo(map)
        ghostMarkers.current = ghosts.map((g, i) => {
          const s = g.pontos[0]
          const ll: [number, number] = s ? [Number(s.lng), Number(s.lat)] : [chegada.lng, chegada.lat]
          return new maplibregl.Marker({ element: ghostEl(GHOST_COLORS[i] ?? "#888"), anchor: "center" }).setLngLat(ll).addTo(map)
        })

        map.addSource("route", { type: "geojson", data: lineFeature([[inicio.lng, inicio.lat], [chegada.lng, chegada.lat]]) })
        map.addLayer({ id: "route-glow", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#7f77dd", "line-width": 11, "line-opacity": 0.25 } })
        map.addLayer({ id: "route", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#a78bfa", "line-width": 5, "line-opacity": 0.95 } })

        atualizarRota(inicio, chegada, true)
      })
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, rota, ghosts, userStart])

  // Recalcula a rota pelas ruas e desenha
  async function atualizarRota(from: LngLat, to: LngLat, fit = false) {
    const coords = (await fetchRoute(from, to)) ?? [[from.lng, from.lat], [to.lng, to.lat]]
    const map = mapInst.current
    if (!map) return
    const src = map.getSource("route") as maplibregl.GeoJSONSource | undefined
    src?.setData(lineFeature(coords))
    if (fit) {
      const b = boundsOf(coords)
      if (b) map.fitBounds(b, { padding: 70, maxZoom: 16, duration: 0 })
    }
  }

  // ── GPS ───────────────────────────────────────────────────────────────────

  const iniciarGPS = useCallback(() => {
    if (!navigator.geolocation) { setErroMsg("Geolocalização não suportada neste dispositivo."); setPhase("gps_error"); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        lastPos.current = p
        setUserStart(p)
        const r = rotaRef.current
        if (r) setDistFalta(haversine(p.lat, p.lng, r.ponto_b_lat, r.ponto_b_lng))
        setPhase("staging")
      },
      (err) => {
        setErroMsg(err.code === 1
          ? "Permissão de localização negada. Habilite o GPS nas configurações do navegador."
          : "Não foi possível obter sua localização. Verifique o GPS.")
        setPhase("gps_error")
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }, [])

  function startRun() {
    startedAt.current = Date.now()
    following.current = true

    elapsedTimer.current = setInterval(() => setElapsed(Date.now() - startedAt.current), 500)

    syncTimer.current = setInterval(async () => {
      if (pontosBuffer.current.length === 0 || !runIdRef.current) return
      const lote = [...pontosBuffer.current]; pontosBuffer.current = []
      try { await api.post(`/api/tracks/runs/${runIdRef.current}/pontos`, { pontos: lote }) } catch { /* re-tenta */ }
    }, 5000)

    // Recalcula a rota pelas ruas periodicamente (da posição atual até a chegada)
    routeTimer.current = setInterval(() => {
      const r = rotaRef.current
      if (lastPos.current && r) atualizarRota(lastPos.current, { lat: r.ponto_b_lat, lng: r.ponto_b_lng })
    }, 15000)

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => onPosicao(pos),
      (err) => console.warn("GPS:", err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    )
    setPhase("running")
  }

  function largar() {
    if (beat >= 0) return
    setBeat(0)
    setTimeout(() => setBeat(1), 800)
    setTimeout(() => setBeat(2), 1500)
    setTimeout(() => setBeat(3), 2200)
    setTimeout(() => { setBeat(-1); startRun() }, 3000)
  }

  function onPosicao(pos: GeolocationPosition) {
    if (!startedAt.current) return
    const lat = pos.coords.latitude, lng = pos.coords.longitude
    const spd = pos.coords.speed != null ? pos.coords.speed * 3.6 : 0
    const offset_ms = Date.now() - startedAt.current

    const ponto: Ponto = { lat, lng, velocidade_kmh: spd, ts: Date.now(), offset_ms }
    pontosBuffer.current.push(ponto); allPontos.current.push(ponto)

    if (lastPos.current) setDistancia((prev) => prev + haversine(lastPos.current!.lat, lastPos.current!.lng, lat, lng))
    lastPos.current = { lat, lng }
    if (pos.coords.heading != null && !Number.isNaN(pos.coords.heading)) headingRef.current = pos.coords.heading

    setSpeed(Math.round(spd))
    setMaxSpeed((prev) => Math.max(prev, spd))

    userMarker.current?.setLngLat([lng, lat])

    const r = rotaRef.current
    if (r) {
      const distB = haversine(lat, lng, r.ponto_b_lat, r.ponto_b_lng)
      setDistFalta(distB)
      setPerto(distB < 0.3)
    }

    if (mapInst.current && following.current) {
      mapInst.current.easeTo({
        center: [lng, lat],
        zoom: centralizou.current ? mapInst.current.getZoom() : 16,
        bearing: navRef.current ? (headingRef.current ?? mapInst.current.getBearing()) : 0,
        pitch: navRef.current ? 55 : 0,
        duration: 700,
      })
      centralizou.current = true
    }
  }

  function recentralizar() {
    following.current = true
    const map = mapInst.current, p = lastPos.current
    if (map && p) map.easeTo({ center: [p.lng, p.lat], zoom: 16, bearing: navRef.current ? (headingRef.current ?? 0) : 0, pitch: navRef.current ? 55 : 0, duration: 600 })
  }

  function toggleNav() {
    const v = !navRef.current
    navRef.current = v; setNav(v)
    following.current = true
    const map = mapInst.current, p = lastPos.current
    if (map) map.easeTo({ center: p ? [p.lng, p.lat] : map.getCenter(), bearing: v ? (headingRef.current ?? 0) : 0, pitch: v ? 55 : 0, duration: 600 })
  }

  // ── Fantasmas no mapa ──────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "running") return
    const interval = setInterval(() => {
      const el = Date.now() - startedAt.current
      ghosts.forEach((g, i) => {
        const pos = ghostPosAt(g.pontos, el)
        if (pos && ghostMarkers.current[i]) ghostMarkers.current[i].setLngLat([pos[1], pos[0]])
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [phase, ghosts])

  // ── Finalizar ─────────────────────────────────────────────────────────────

  async function finalizar() {
    if (finalizando.current || !runIdRef.current) return
    finalizando.current = true

    const duracao_s = Math.round((Date.now() - startedAt.current) / 1000)
    const vel_max = maxSpeed
    const vel_media = allPontos.current.length > 0
      ? allPontos.current.reduce((s, p) => s + p.velocidade_kmh, 0) / allPontos.current.length : 0

    cleanup()

    if (pontosBuffer.current.length > 0) {
      await api.post(`/api/tracks/runs/${runIdRef.current}/pontos`, { pontos: pontosBuffer.current }).catch(() => {})
    }

    const last = allPontos.current[allPontos.current.length - 1]
    const res = await api.post<{ run: unknown; badges: string[] }>(
      `/api/tracks/runs/${runIdRef.current}/finalizar`,
      {
        duracao_s, distancia_km: distancia,
        vel_media_kmh: Math.round(vel_media * 10) / 10,
        vel_max_kmh: Math.round(vel_max * 10) / 10,
        lat_final: last?.lat ?? rota?.ponto_b_lat,
        lng_final: last?.lng ?? rota?.ponto_b_lng,
      }
    )

    setResultado({ duracao_s, vel_media_kmh: vel_media, vel_max_kmh: vel_max, badges: res.badges })
    setPhase("finished")
  }

  function cleanup() {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
    if (elapsedTimer.current) clearInterval(elapsedTimer.current)
    if (syncTimer.current) clearInterval(syncTimer.current)
    if (routeTimer.current) clearInterval(routeTimer.current)
    if (mapInst.current) { mapInst.current.remove(); mapInst.current = null }
  }

  async function cancelar() {
    cleanup()
    if (runIdRef.current) await api.post(`/api/tracks/runs/${runIdRef.current}/pontos`, { pontos: [] }).catch(() => {})
    navigate(`/tracks/${rotaId}`)
  }

  // ── Renders ───────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-[#0b0b10]">
        <div className="size-10 animate-spin rounded-full border-2 border-white/20 border-t-purple" />
        <p className="text-sm text-white/60">Carregando rota e fantasmas...</p>
      </div>
    )
  }

  if (phase === "gps_error") {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-[#0b0b10] px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-red-bg text-red"><MapPin className="size-6" /></div>
        <div>
          <p className="font-medium text-white">GPS indisponível</p>
          <p className="mt-1 max-w-[360px] text-sm text-white/60">{erroMsg}</p>
        </div>
        <button onClick={() => navigate(`/tracks/${rotaId}`)} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/10">Voltar</button>
      </div>
    )
  }

  if (phase === "finished" && resultado) {
    const diff = rota?.tempo_ideal_s ? resultado.duracao_s - rota.tempo_ideal_s : null
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 overflow-y-auto bg-[#0b0b10] px-6 py-10 text-center">
        <CheckCircle className="size-16 text-green" />
        <div>
          <p className="font-display text-[40px] font-bold leading-none text-white">{formatDuracao(resultado.duracao_s * 1000)}</p>
          <p className="mt-2 text-sm text-white/60">{rota?.nome}{veiculo ? ` · ${veiculo.apelido}` : ""}</p>
        </div>
        <div className="grid w-full max-w-[360px] grid-cols-3 gap-3">
          {[
            { v: `${distancia.toFixed(1)}`, l: "km" },
            { v: resultado.vel_media_kmh.toFixed(0), l: "km/h média" },
            { v: resultado.vel_max_kmh.toFixed(0), l: "km/h máx" },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-data text-lg font-bold text-white">{s.v}</p>
              <p className="text-[10px] text-white/40">{s.l}</p>
            </div>
          ))}
        </div>
        {diff != null && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-[13px]">
            <span className="text-white/50">Diferença do ideal: </span>
            <span className={`font-medium ${diff <= 0 ? "text-green" : "text-amber"}`}>{diff > 0 ? "+" : ""}{diff}s</span>
          </div>
        )}
        {resultado.badges.length > 0 && (
          <div className="flex w-full max-w-[360px] flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Conquistas desbloqueadas</p>
            {resultado.badges.map((b) => (
              <div key={b} className="flex items-center gap-2 rounded-xl border border-green/30 bg-green-bg px-4 py-2 text-[13px] text-green">🏆 {b}</div>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={() => navigate(`/tracks/${rotaId}`)} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/10">Ver leaderboard</button>
          <button onClick={() => navigate("/tracks")} className="rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90">Outras rotas</button>
        </div>
      </div>
    )
  }

  // staging / running
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0b0b10]">
      <div ref={mapRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }} />

      {/* Top overlay */}
      <div className="relative z-10 flex items-start justify-between gap-2 bg-gradient-to-b from-black/80 to-transparent px-4 pb-8 pt-[max(14px,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-white">{rota?.nome}</p>
          <p className="truncate text-[11px] text-purple-300">chegada · {rota?.ponto_b_nome}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={toggleNav} aria-label="Alternar visão" className="flex h-9 items-center gap-1 rounded-full bg-black/40 px-3 text-[11px] font-bold text-white/80 backdrop-blur-sm hover:text-white">
            {nav ? "3D" : "2D"}
          </button>
          <button onClick={() => { if (window.confirm("Cancelar a corrida? O progresso será descartado.")) cancelar() }} className="flex size-9 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur-sm hover:bg-black/60 hover:text-white">
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* faltam (flutuante) */}
      {distFalta != null && (
        <div className="relative z-10 mx-auto -mt-2 flex items-center gap-1.5 rounded-full bg-purple/90 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-lg backdrop-blur-sm">
          <Navigation className="size-3.5" /> faltam {formatDist(distFalta)}
        </div>
      )}

      <div className="flex-1" />

      {/* HUD (correndo) */}
      {phase === "running" && (
        <div className="relative z-10 bg-gradient-to-t from-[#0b0b10] via-[#0b0b10]/95 to-transparent px-5 pt-10 pb-[max(20px,env(safe-area-inset-bottom))]">
          <button onClick={recentralizar} aria-label="Recentralizar" className="absolute -top-14 right-4 flex size-11 items-center justify-center rounded-full bg-[#16121f]/90 text-purple-200 shadow-lg ring-1 ring-white/10 backdrop-blur-sm hover:text-white">
            <LocateFixed className="size-5" />
          </button>

          <div className="flex items-end justify-center gap-2">
            <span className="font-data text-[68px] font-bold leading-[0.85] tracking-tight text-white tabular-nums">{speed}</span>
            <span className="mb-3 text-sm font-medium text-white/40">km/h</span>
          </div>

          <div className="mt-4 flex items-stretch justify-between gap-2">
            {[
              { v: formatDuracao(elapsed), l: "tempo" },
              { v: distFalta != null ? formatDist(distFalta) : "—", l: "faltam" },
              { v: `${Math.round(maxSpeed)}`, l: "máx km/h" },
            ].map((s) => (
              <div key={s.l} className="flex-1 text-center">
                <p className="font-data text-[17px] font-bold leading-none text-white">{s.v}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-white/40">{s.l}</p>
              </div>
            ))}
          </div>

          {ghosts.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1">
              {ghosts.map((g, i) => (
                <span key={g.id} className="flex items-center gap-1 text-[10px] text-white/50">
                  <span className="inline-block size-2 rounded-full" style={{ background: GHOST_COLORS[i] ?? "#888" }} />
                  <GhostIcon className="size-2.5" /> {g.usuario_nome}
                </span>
              ))}
            </div>
          )}

          <button onClick={finalizar} className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-semibold transition-all ${perto ? "animate-pulse bg-green text-white shadow-lg shadow-green/30" : "border border-white/15 bg-white/5 text-white/70"}`}>
            <Flag className="size-4" /> {perto ? "Você chegou! Finalizar" : "Finalizar run"}
          </button>
          <button onClick={() => { if (window.confirm("Cancelar a corrida? O progresso será descartado.")) cancelar() }} className="mt-2 w-full py-2 text-[12px] font-medium text-white/40 hover:text-red">
            Cancelar corrida
          </button>
        </div>
      )}

      {/* Largada (staging) */}
      {phase === "staging" && (
        <div className="relative z-10 bg-gradient-to-t from-[#0b0b10] via-[#0b0b10]/95 to-transparent px-5 pt-10 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="mb-4 text-center">
            <p className="text-[12px] uppercase tracking-wider text-white/40">Trajeto até</p>
            <p className="font-display text-lg font-bold text-white">{rota?.ponto_b_nome}</p>
            {distFalta != null && <p className="mt-1 text-[12px] text-purple-200">{formatDist(distFalta)} em linha reta</p>}
          </div>
          <button onClick={largar} disabled={beat >= 0} className="flex w-full items-center justify-center gap-2 rounded-xl bg-green py-4 text-[15px] font-bold text-white shadow-lg shadow-green/30 transition-opacity hover:opacity-90 disabled:opacity-60">
            <Flag className="size-5" /> Largar
          </button>
          <p className="mt-2 text-center text-[11px] text-white/40">Confira o trajeto no mapa e largue quando estiver pronto.</p>
        </div>
      )}

      {/* Semáforo */}
      {beat >= 0 && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col gap-3 rounded-3xl bg-black/60 p-5 ring-1 ring-white/10">
            {[
              { on: beat === 0, color: "#e24b4a" },
              { on: beat === 1 || beat === 2, color: "#ef9f27" },
              { on: beat === 3, color: "#1d9e75" },
            ].map((b, i) => (
              <div key={i} className="size-16 rounded-full transition-all duration-150" style={{ background: b.on ? b.color : "#1c1c1c", boxShadow: b.on ? `0 0 32px ${b.color}` : "none", opacity: b.on ? 1 : 0.3 }} />
            ))}
          </div>
          <p className="font-display text-2xl font-bold text-white">{beat === 3 ? "VAI! 🏁" : "Prepare-se…"}</p>
        </div>
      )}
    </div>
  )
}
