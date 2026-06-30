import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Store, Upload, ExternalLink, AtSign, MessageCircle, Globe, Save, Trash2 } from "lucide-react"
import { api } from "@/lib/api/client"
import { useAuth } from "@/context/AuthContext"

interface Loja {
  id: string
  nome: string
  descricao?: string | null
  logo_url?: string | null
  banner_url?: string | null
  instagram?: string | null
  whatsapp?: string | null
  website?: string | null
}

export default function MinhaLojaPage() {
  const { user } = useAuth()
  const [loja, setLoja] = useState<Loja | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [erro, setErro] = useState("")
  const [ok, setOk] = useState("")

  const [nome, setNome] = useState("")
  const [descricao, setDescricao] = useState("")
  const [instagram, setInstagram] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [website, setWebsite] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [bannerUrl, setBannerUrl] = useState("")

  useEffect(() => {
    api.get<{ loja: Loja | null }>("/api/lojas/minha")
      .then(r => {
        setLoja(r.loja)
        if (r.loja) {
          setNome(r.loja.nome ?? "")
          setDescricao(r.loja.descricao ?? "")
          setInstagram(r.loja.instagram ?? "")
          setWhatsapp(r.loja.whatsapp ?? "")
          setWebsite(r.loja.website ?? "")
          setLogoUrl(r.loja.logo_url ?? "")
          setBannerUrl(r.loja.banner_url ?? "")
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function uploadImagem(file: File, tipo: "logo" | "banner") {
    if (file.size > 2 * 1024 * 1024) {
      alert("A imagem não pode ultrapassar 2 MB.")
      return
    }
    const setUploading = tipo === "logo" ? setUploadingLogo : setUploadingBanner
    setUploading(true)
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
      const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
      const form = new FormData()
      form.append("file", file)
      form.append("upload_preset", preset)
      form.append("folder", `autohub/lojas/${tipo}`)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form })
      if (!res.ok) throw new Error("Falha no upload")
      const json = await res.json() as { secure_url: string }
      if (tipo === "logo") setLogoUrl(json.secure_url)
      else setBannerUrl(json.secure_url)
    } catch {
      alert("Erro ao enviar imagem")
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) { setErro("Nome é obrigatório."); return }
    setSaving(true); setErro(""); setOk("")
    try {
      const payload = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        instagram: instagram.trim() || null,
        whatsapp: whatsapp.trim() || null,
        website: website.trim() || null,
        logoUrl: logoUrl || null,
        bannerUrl: bannerUrl || null,
      }
      if (loja) {
        await api.patch<Loja>("/api/lojas", payload)
        setLoja({ ...loja, ...payload, logo_url: logoUrl || null, banner_url: bannerUrl || null })
      } else {
        const created = await api.post<Loja>("/api/lojas", payload)
        setLoja(created)
      }
      setOk(loja ? "Salvo!" : "Loja criada!")
      setTimeout(() => setOk(""), 2500)
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletar() {
    if (!confirm("Tem certeza? Esta ação não pode ser desfeita.")) return
    await api.delete("/api/lojas")
    setLoja(null)
    setNome(""); setDescricao(""); setInstagram(""); setWhatsapp(""); setWebsite("")
    setLogoUrl(""); setBannerUrl("")
  }

  if (loading) return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-8 w-40 rounded-lg bg-surface" />
      <div className="h-[400px] rounded-xl bg-surface" />
    </div>
  )

  const slug = user?.garagem?.slug

  return (
    <div className="flex flex-col gap-5">
      {/* Header compacto */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint-foreground">Marketplace</p>
          <h1 className="font-display text-[22px] font-semibold text-foreground">
            {loja ? "Minha Loja" : "Criar Loja"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {loja && slug && (
            <Link
              to={`/loja/${slug}`}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="size-3.5" />
              Ver pública
            </Link>
          )}
          {loja && (
            <button
              onClick={handleDeletar}
              className="flex items-center gap-1.5 rounded-lg border border-red/30 px-3 py-1.5 text-[12px] text-red hover:bg-red-bg transition-colors"
            >
              <Trash2 className="size-3.5" />
              Excluir
            </button>
          )}
        </div>
      </div>

      {/* Layout: form + preview */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">

        {/* ── Formulário compacto ─────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 lg:w-[380px] lg:shrink-0">

          {/* Banner + logo (logo fora do overflow-hidden para não ser clipado) */}
          <div className="relative">
            <div className="h-28 overflow-hidden rounded-xl border border-border">
              {bannerUrl ? (
                <>
                  <img src={bannerUrl} alt="banner" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-end justify-end gap-2 p-2">
                    <label className={`flex cursor-pointer items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[11px] text-white backdrop-blur-sm hover:bg-black/80 ${uploadingBanner ? "opacity-50 pointer-events-none" : ""}`}>
                      <Upload className="size-3" />
                      {uploadingBanner ? "Enviando..." : "Trocar"}
                      <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImagem(f, "banner") }} />
                    </label>
                    <button type="button" onClick={() => setBannerUrl("")} className="flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[11px] text-white backdrop-blur-sm hover:bg-red/80">
                      Remover
                    </button>
                  </div>
                </>
              ) : (
                <label className={`flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1.5 bg-surface text-faint-foreground hover:text-purple transition-colors ${uploadingBanner ? "opacity-50 pointer-events-none" : ""}`}>
                  <Upload className="size-5" />
                  <span className="text-[12px] font-medium">{uploadingBanner ? "Enviando..." : "Adicionar banner"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImagem(f, "banner") }} />
                </label>
              )}
            </div>

            {/* Logo sobreposta — fora do overflow-hidden para não ser clipada */}
            <div className="absolute -bottom-5 left-4">
              {logoUrl ? (
                <label className="relative flex size-10 cursor-pointer overflow-hidden rounded-lg border-2 border-background shadow-md">
                  <img src={logoUrl} alt="logo" className="size-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                    <Upload className="size-3 text-white" />
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImagem(f, "logo") }} />
                </label>
              ) : (
                <label className={`flex size-10 cursor-pointer items-center justify-center rounded-lg border-2 border-background bg-surface shadow-md hover:border-purple transition-colors ${uploadingLogo ? "opacity-50 pointer-events-none" : ""}`}>
                  <Store className="size-4 text-faint-foreground" />
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImagem(f, "logo") }} />
                </label>
              )}
            </div>
          </div>

          {/* Campos */}
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-foreground">Nome da loja *</label>
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Turbo Parts BR"
                maxLength={100}
                required
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-foreground">Descrição</label>
              <textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Especialidades, o que você vende..."
                className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-foreground">Instagram</label>
                <input
                  value={instagram}
                  onChange={e => setInstagram(e.target.value)}
                  placeholder="@loja"
                  maxLength={50}
                  className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-[12px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-foreground">WhatsApp</label>
                <input
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  placeholder="+55 11..."
                  maxLength={20}
                  className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-[12px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-foreground">Site</label>
                <input
                  type="url"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-[12px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {erro && <p className="rounded-lg bg-red-bg px-3 py-2 text-[12px] text-red">{erro}</p>}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-purple py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {ok ? (
              <span className="text-green-100">{ok}</span>
            ) : (
              <>
                <Save className="size-4" />
                {saving ? "Salvando..." : loja ? "Salvar alterações" : "Criar loja"}
              </>
            )}
          </button>
        </form>

        {/* ── Preview ao vivo ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
            Preview — como sua loja aparece
          </p>

          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {/* Banner preview */}
            <div className="relative">
              {bannerUrl ? (
                <img src={bannerUrl} alt="banner" className="h-32 w-full object-cover" />
              ) : (
                <div className="flex h-32 items-center justify-center bg-surface-2">
                  <Store className="size-8 text-faint-foreground/40" />
                </div>
              )}

              {/* Logo preview */}
              {logoUrl && (
                <div className="absolute -bottom-5 left-4">
                  <img src={logoUrl} alt="logo" className="size-12 rounded-xl border-2 border-surface object-cover shadow-lg" />
                </div>
              )}
            </div>

            {/* Info preview */}
            <div className={`flex flex-col gap-3 px-4 pb-4 ${logoUrl ? "pt-8" : "pt-4"}`}>
              <div>
                <h2 className="font-display text-[18px] font-semibold text-foreground">
                  {nome || <span className="text-faint-foreground">Nome da loja</span>}
                </h2>
                {slug && (
                  <p className="text-[11px] text-purple">autohub.app/loja/{slug}</p>
                )}
              </div>

              {descricao && (
                <p className="text-[12px] leading-relaxed text-muted-foreground line-clamp-3">{descricao}</p>
              )}

              {(instagram || whatsapp || website) && (
                <div className="flex flex-wrap gap-2">
                  {instagram && (
                    <span className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                      <AtSign className="size-3" />
                      {instagram.replace("@", "")}
                    </span>
                  )}
                  {whatsapp && (
                    <span className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                      <MessageCircle className="size-3" />
                      WhatsApp
                    </span>
                  )}
                  {website && (
                    <span className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                      <Globe className="size-3" />
                      Site
                    </span>
                  )}
                </div>
              )}

              {/* Placeholder de anúncios */}
              <div className="mt-1 flex flex-col gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
                  Anúncios ativos
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 rounded-lg border border-dashed border-border bg-surface-2 opacity-40" />
                  ))}
                </div>
                <p className="text-[11px] text-faint-foreground">
                  Seus anúncios ativos no marketplace aparecem aqui.
                </p>
              </div>
            </div>
          </div>

          {loja && slug && (
            <Link
              to={`/loja/${slug}`}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="size-3.5" />
              Ver loja pública completa
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
