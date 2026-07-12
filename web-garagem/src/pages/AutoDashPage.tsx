import { useEffect, useRef } from "react"
import { Link } from "react-router-dom"
import { AutoDashEngine } from "@/game/autodash/engine"

/** AutoDash — minigame de corrida (tela cheia imersiva, fora do Layout). */
export default function AutoDashPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new AutoDashEngine(canvas)
    return () => engine.destroy()
  }, [])

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <canvas
        ref={canvasRef}
        className="max-h-full max-w-full"
        style={{ aspectRatio: "16 / 9", width: "min(100vw, 177.8vh)" }}
      />
      <Link
        to="/"
        className="absolute left-3 top-3 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/70 backdrop-blur transition hover:bg-white/20 hover:text-white"
      >
        ← sair
      </Link>
    </div>
  )
}
