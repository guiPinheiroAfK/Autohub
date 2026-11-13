import { Play } from "lucide-react"

interface YoutubePanelProps {
    youtubeUrl: string
    setYoutubeUrl: (url: string) => void
    savingYoutube: boolean
    onSave: () => void
}

export function YoutubePanel({ youtubeUrl, setYoutubeUrl, savingYoutube, onSave }: YoutubePanelProps) {
    return (
                  <div className="rounded-xl border border-border bg-surface p-5">
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
                      <Play className="size-3.5 text-red" />
                      Vídeo do YouTube
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={youtubeUrl}
                        onChange={e => setYoutubeUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
                      />
                      <button
                        onClick={onSave}
                        disabled={savingYoutube}
                        className="shrink-0 rounded-lg bg-purple px-3 py-2 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {savingYoutube ? "Salvando..." : "Salvar"}
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-faint-foreground">
                      Cole o link do YouTube para exibir o vídeo na página pública do build.
                    </p>
                  </div>
    )
}
