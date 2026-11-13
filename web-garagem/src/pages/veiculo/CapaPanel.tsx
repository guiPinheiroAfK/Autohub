import { ImageIcon, Upload } from "lucide-react"

interface CapaPanelProps {
    capaUrl: string
    uploadingCapa: boolean
    onUpload: (file: File) => void
}

export function CapaPanel({ capaUrl, uploadingCapa, onUpload }: CapaPanelProps) {
    return (
                  <div className="rounded-xl border border-border bg-surface p-5">
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
                      <ImageIcon className="size-3.5" />
                      Imagem de capa (feed público)
                    </div>
                    {capaUrl ? (
                      <div className="relative mb-3">
                        <img src={capaUrl} alt="capa" className="h-40 w-full rounded-lg object-cover border border-border" />
                        <label className="absolute bottom-2 right-2 flex cursor-pointer items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm hover:bg-black/80">
                          <Upload className="size-3" />
                          Trocar
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f) }}
                          />
                        </label>
                        {uploadingCapa && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
                            <span className="text-[12px] text-white">Enviando...</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <label className={`mb-3 flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background text-faint-foreground transition-colors hover:border-purple hover:text-purple ${uploadingCapa ? "pointer-events-none opacity-60" : ""}`}>
                        <Upload className="size-5" />
                        <span className="text-[12px] font-medium">{uploadingCapa ? "Enviando..." : "Clique para enviar imagem"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f) }}
                        />
                      </label>
                    )}
                    <p className="text-[11px] text-faint-foreground">
                      Aparece no feed e na garagem pública. Formatos: JPG, PNG, WebP.
                    </p>
                  </div>
    )
}
