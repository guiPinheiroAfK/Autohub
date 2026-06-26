/**
 * RunPage — HUD de corrida ativo.
 *
 * Fluxo:
 * 1. Monta → cria run no backend → carrega ghosts + rota.
 * 2. Pede permissão de GPS. Se negado, mostra erro.
 * 3. watchPosition registra posição continuamente.
 * 4. A cada 5s envia lote de pontos para o backend.
 * 5. Mapa Leaflet mostra usuário (azul) + ghosts (roxo).
 * 6. Ao clicar "Finalizar" (ou chegar perto do ponto B), salva run.
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useSearchParams, useNavigate } from "react-router-dom"
import { Flag, MapPin, Timer, Gauge, TrendingUp, X, CheckCircle } from "lucide-react"
import { api } from "@/lib/api/client"
import type { Rota, Ghost, GhostPonto } from "@/types/tracks"
import type { VeiculoComMetricas } from "@/types"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// ── Tipos internos ────────────────────────────────────────────────────────────

interface Ponto {
  lat: number
  lng: number
  velocidade_kmh: number
  ts: number        // Date.now() quando capturado
  offset_ms: number // ms desde início da run
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuracao(ms: number) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`
  return `${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`
}

/** Haversine distance em km */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

/** Interpola posição do fantasma no tempo elapsed_ms */
function ghostPosAt(pontos: GhostPonto[], elapsed_ms: number): [number, number] | null {
  if (pontos.length === 0) return null
  const last = pontos[pontos.length - 1]
  if (elapsed_ms >= last.offset_ms) return [Number(last.lat), Number(last.lng)]
  for (let i = 1; i < pontos.length; i++) {
    if (pontos[i].offset_ms >= elapsed_ms) {
      const prev = pontos[i-1]
      const curr = pontos[i]
      const t = (elapsed_ms - prev.offset_ms) / (curr.offset_ms - prev.offset_ms)
      return [
        Number(prev.lat) + (Number(curr.lat) - Number(prev.lat)) * t,
        Number(prev.lng) + (Number(curr.lng) - Number(prev.lng)) * t,
      ]
    }
  }
  return [Number(pontos[0].lat), Number(pontos[0].lng)]
}

// Ícones customizados para Leaflet (evita o problema do default icon path no Vite)
function makeIcon(color: string, size = 14) {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 6px ${color}66"></div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  })
}

const GHOST_COLORS = ["#a855f7", "#ec4899", "#f97316"]

// ── Componente principal ──────────────────────────────────────────────────────

type RunPhase = "loading" | "gps_error" | "running" | "finished"

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

  // Telemetria ao vivo
  const [elapsed, setElapsed] = useState(0)          // ms
  const [speed, setSpeed] = useState(0)              // km/h
  const [maxSpeed, setMaxSpeed] = useState(0)
  const [distancia, setDistancia] = useState(0)      // km
  const [perto, setPerto] = useState(false)           // perto do ponto B

  // Resultado final
  const [resultado, setResultado] = useState<{ duracao_s: number; vel_media_kmh: number; vel_max_kmh: number; badges: string[] } | null>(null)

  // Refs (não causam re-render)
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<L.Map | null>(null)
  const userMarker = useRef<L.Marker | null>(null)
  const ghostMarkers = useRef<L.Marker[]>([])
  const watchId = useRef<number | null>(null)
  const startedAt = useRef<number>(0)
  const pontosBuffer = useRef<Ponto[]>([])
  const allPontos = useRef<Ponto[]>([])
  const lastPos = useRef<{ lat: number; lng: number } | null>(null)
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const syncTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const runIdRef = useRef<string | null>(null)
  const finalizando = useRef(false)

  // ── Inicialização ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!rotaId || !veiculoId) { navigate("/tracks"); return }

    // Carrega dados em paralelo
    Promise.all([
      api.get<{ rota: Rota }>(`/api/tracks/rotas/${rotaId}`).then(r => r.rota),
      api.get<{ ghosts: Ghost[] }>(`/api/tracks/rotas/${rotaId}/ghosts`).then(r => r.ghosts),
      api.get<VeiculoComMetricas[]>("/api/veiculos").then(vs => vs.find(v => v.id === veiculoId) ?? null),
      api.post<{ run: { id: string } }>("/api/tracks/runs", { rota_id: rotaId, veiculo_id: veiculoId })
        .then(r => r.run.id),
    ]).then(([r, g, v, rid]) => {
      setRota(r)
      setGhosts(g)
      setVeiculo(v)
      setRunId(rid)
      runIdRef.current = rid
      iniciarGPS()
    }).catch(err => {
      setErroMsg(String(err))
      setPhase("gps_error")
    })

    return () => cleanup()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Leaflet: monta o mapa após entrar em "running" ────────────────────────

  useEffect(() => {
    if (phase !== "running" || !mapRef.current || !rota) return
    if (leafletMap.current) return // já montado

    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false })
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(map)

    // Ponto A (verde) e Ponto B (vermelho)
    L.marker([rota.ponto_a_lat, rota.ponto_a_lng], { icon: makeIcon("#22c55e", 16) })
      .bindPopup(`<b>Início</b><br>${rota.ponto_a_nome}`).addTo(map)
    L.marker([rota.ponto_b_lat, rota.ponto_b_lng], { icon: makeIcon("#ef4444", 16) })
      .bindPopup(`<b>Chegada</b><br>${rota.ponto_b_nome}`).addTo(map)

    // Marcadores dos fantasmas
    ghostMarkers.current = ghosts.map((g, i) => {
      const m = L.marker([rota.ponto_a_lat, rota.ponto_a_lng], {
        icon: makeIcon(GHOST_COLORS[i] ?? "#888"),
      })
        .bindPopup(`<b>👻 ${g.usuario_nome}</b><br>${g.veiculo_apelido}`)
        .addTo(map)
      return m
    })

    // Marcador do usuário
    userMarker.current = L.marker([rota.ponto_a_lat, rota.ponto_a_lng], {
      icon: makeIcon("#3b82f6", 18),
      zIndexOffset: 1000,
    }).bindPopup("Você").addTo(map)

    map.setView([rota.ponto_a_lat, rota.ponto_a_lng], 14)
    leafletMap.current = map
  }, [phase, rota, ghosts])

  // ── GPS ───────────────────────────────────────────────────────────────────

  const iniciarGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setErroMsg("Geolocalização não suportada neste dispositivo.")
      setPhase("gps_error")
      return
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        startedAt.current = Date.now()

        // Timer de elapsed
        elapsedTimer.current = setInterval(() => {
          setElapsed(Date.now() - startedAt.current)
        }, 500)

        // Sync para o backend a cada 5s
        syncTimer.current = setInterval(async () => {
          if (pontosBuffer.current.length === 0 || !runIdRef.current) return
          const lote = [...pontosBuffer.current]
          pontosBuffer.current = []
          try {
            await api.post(`/api/tracks/runs/${runIdRef.current}/pontos`, { pontos: lote })
          } catch { /* silencioso, re-tenta no próximo ciclo */ }
        }, 5000)

        // Tracking contínuo
        watchId.current = navigator.geolocation.watchPosition(
          pos => onPosicao(pos),
          err => console.warn("GPS:", err),
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
        )

        setPhase("running")
      },
      err => {
        setErroMsg(
          err.code === 1
            ? "Permissão de localização negada. Habilite o GPS nas configurações do browser."
            : "Não foi possível obter sua localização. Verifique o GPS."
        )
        setPhase("gps_error")
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }, [])

  function onPosicao(pos: GeolocationPosition) {
    if (!startedAt.current) return
    const lat = pos.coords.latitude
    const lng = pos.coords.longitude
    const spd = pos.coords.speed != null ? pos.coords.speed * 3.6 : 0
    const offset_ms = Date.now() - startedAt.current

    const ponto: Ponto = { lat, lng, velocidade_kmh: spd, ts: Date.now(), offset_ms }
    pontosBuffer.current.push(ponto)
    allPontos.current.push(ponto)

    // Distância acumulada
    if (lastPos.current) {
      const d = haversine(lastPos.current.lat, lastPos.current.lng, lat, lng)
      setDistancia(prev => prev + d)
    }
    lastPos.current = { lat, lng }

    setSpeed(Math.round(spd))
    setMaxSpeed(prev => Math.max(prev, spd))

    // Atualiza marcador do usuário no mapa
    if (userMarker.current) {
      userMarker.current.setLatLng([lat, lng])
    }
    if (leafletMap.current) {
      leafletMap.current.setView([lat, lng], leafletMap.current.getZoom(), { animate: true })
    }

    // Verifica proximidade do ponto B
    if (rota) {
      const distB = haversine(lat, lng, rota.ponto_b_lat, rota.ponto_b_lng)
      setPerto(distB < 0.3) // 300 metros
    }
  }

  // ── Atualiza fantasmas no mapa ────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "running") return
    const interval = setInterval(() => {
      const el = Date.now() - startedAt.current
      ghosts.forEach((g, i) => {
        const pos = ghostPosAt(g.pontos, el)
        if (pos && ghostMarkers.current[i]) {
          ghostMarkers.current[i].setLatLng(pos)
        }
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
      ? allPontos.current.reduce((s, p) => s + p.velocidade_kmh, 0) / allPontos.current.length
      : 0

    cleanup()

    // Envia pontos restantes
    if (pontosBuffer.current.length > 0) {
      await api.post(`/api/tracks/runs/${runIdRef.current}/pontos`, { pontos: pontosBuffer.current }).catch(() => {})
    }

    const last = allPontos.current[allPontos.current.length - 1]
    const res = await api.post<{ run: unknown; badges: string[] }>(
      `/api/tracks/runs/${runIdRef.current}/finalizar`,
      {
        duracao_s,
        distancia_km: distancia,
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
    if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null }
  }

  async function cancelar() {
    cleanup()
    if (runIdRef.current) {
      await api.post(`/api/tracks/runs/${runIdRef.current}/pontos`, { pontos: [] }).catch(() => {})
    }
    navigate(`/tracks/${rotaId}`)
  }

  // ── Renders ───────────────────────────────────────────────────────────────

  // Loading
  if (phase === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="size-10 animate-spin rounded-full border-2 border-border border-t-purple" />
        <p className="text-sm text-muted-foreground">Carregando rota e fantasmas...</p>
      </div>
    )
  }

  // Erro GPS
  if (phase === "gps_error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-red-bg text-red">
          <MapPin className="size-6" />
        </div>
        <div>
          <p className="font-medium text-foreground">GPS indisponível</p>
          <p className="mt-1 max-w-[360px] text-sm text-muted-foreground">{erroMsg}</p>
        </div>
        <button
          onClick={() => navigate(`/tracks/${rotaId}`)}
          className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface"
        >
          Voltar
        </button>
      </div>
    )
  }

  // Resultado final
  if (phase === "finished" && resultado) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
        <CheckCircle className="size-16 text-green" />
        <div>
          <p className="font-display text-[28px] font-bold text-foreground">
            {formatDuracao(resultado.duracao_s * 1000)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {rota?.nome}
            {veiculo ? ` · ${veiculo.apelido}` : ""}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full max-w-[360px]">
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="font-data text-lg font-bold text-foreground">{resultado.duracao_s}s</p>
            <p className="text-[10px] text-faint-foreground">duração</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="font-data text-lg font-bold text-foreground">
              {resultado.vel_media_kmh.toFixed(0)}
            </p>
            <p className="text-[10px] text-faint-foreground">km/h média</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="font-data text-lg font-bold text-foreground">
              {resultado.vel_max_kmh.toFixed(0)}
            </p>
            <p className="text-[10px] text-faint-foreground">km/h max</p>
          </div>
        </div>

        {rota?.tempo_ideal_s && (
          <div className="rounded-xl border border-border bg-surface px-5 py-3 text-[13px]">
            <span className="text-muted-foreground">Diff do ideal: </span>
            <span className="font-medium text-foreground">
              {resultado.duracao_s > rota.tempo_ideal_s ? "+" : "-"}
              {Math.abs(resultado.duracao_s - rota.tempo_ideal_s)}s
            </span>
          </div>
        )}

        {resultado.badges.length > 0 && (
          <div className="flex flex-col gap-2 w-full max-w-[360px]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-faint-foreground">
              Conquistas desbloqueadas
            </p>
            {resultado.badges.map(b => (
              <div key={b} className="flex items-center gap-2 rounded-xl border border-green/30 bg-green-bg px-4 py-2 text-[13px] text-green">
                🏆 {b}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/tracks/${rotaId}`)}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface"
          >
            Ver leaderboard
          </button>
          <button
            onClick={() => navigate("/tracks")}
            className="rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Outras rotas
          </button>
        </div>
      </div>
    )
  }

  // ── HUD de corrida ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-0 -mx-6 -mt-6" style={{ height: "calc(100dvh - 64px)" }}>

      {/* Mapa (preenche tela) */}
      <div ref={mapRef} className="flex-1 z-0" />

      {/* HUD flutuante (bottom sheet) */}
      <div className="relative z-10 border-t border-border bg-background/95 backdrop-blur-md px-5 py-4">

        {/* Barra de rota */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <MapPin className="size-3 text-green" />
            <span className="truncate max-w-[140px]">{rota?.ponto_a_nome}</span>
            <span className="text-faint-foreground">→</span>
            <Flag className="size-3 text-purple" />
            <span className="truncate max-w-[140px]">{rota?.ponto_b_nome}</span>
          </div>
          <button onClick={cancelar} className="flex size-7 items-center justify-center rounded-lg text-faint-foreground hover:bg-surface hover:text-red">
            <X className="size-4" />
          </button>
        </div>

        {/* Stats principais */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-faint-foreground mb-0.5">
              <Timer className="size-3" />
            </div>
            <p className="font-data text-[20px] font-bold text-foreground leading-none">{formatDuracao(elapsed)}</p>
            <p className="text-[9px] text-faint-foreground mt-0.5">tempo</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-faint-foreground mb-0.5">
              <Gauge className="size-3" />
            </div>
            <p className="font-data text-[20px] font-bold text-foreground leading-none">{speed}</p>
            <p className="text-[9px] text-faint-foreground mt-0.5">km/h</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-faint-foreground mb-0.5">
              <TrendingUp className="size-3" />
            </div>
            <p className="font-data text-[20px] font-bold text-foreground leading-none">{Math.round(maxSpeed)}</p>
            <p className="text-[9px] text-faint-foreground mt-0.5">max km/h</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-faint-foreground mb-0.5">
              <Flag className="size-3" />
            </div>
            <p className="font-data text-[20px] font-bold text-foreground leading-none">
              {distancia.toFixed(1)}
            </p>
            <p className="text-[9px] text-faint-foreground mt-0.5">km</p>
          </div>
        </div>

        {/* Legenda dos fantasmas */}
        {ghosts.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {ghosts.map((g, i) => (
              <span key={g.id} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ background: GHOST_COLORS[i] ?? "#888" }}
                />
                👻 {g.usuario_nome} · {g.veiculo_apelido}
              </span>
            ))}
          </div>
        )}

        {/* Botão finalizar */}
        <button
          onClick={finalizar}
          className={`w-full rounded-xl py-3 text-[14px] font-semibold transition-all ${
            perto
              ? "bg-green text-white shadow-lg shadow-green/30 animate-pulse"
              : "bg-surface border border-border text-muted-foreground"
          }`}
        >
          {perto ? "🏁 Você está chegando! Finalizar run" : "Finalizar run"}
        </button>
      </div>
    </div>
  )
}
