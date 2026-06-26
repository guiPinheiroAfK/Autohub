import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Store, Upload, ExternalLink, Save } from "lucide-react"
import { api } from "@/lib/api/client"
import { useAuth } from "@/context/AuthContext"

interface Loja {
  id: string
  garagem_id: string
  nome: string
  descricao?: string | null
  logo_url?: string | null
  banner_url?: string | null
  instagram?: string | null
  whatsapp?: string | null
  website?: string | null
  criada_em: string
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
    const setter = tipo === "logo" ? setUploadingLogo : setUploadingBanner
    setter(true)
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
      const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
      const form = new FormData()
      form.append("file", file)
      form.append("upload_preset", preset)
      form.append("folder", `autohub/lojas/${tipo}`)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: form,
      })
      if (!res.ok) throw new Error("Falha no upload")
      const json = await res.json() as { secure_url: string }
      if (tipo === "logo") setLogoUrl(json.secure_url)
      else setBannerUrl(json.secure_url)
    } catch {
      alert("Erro ao enviar imagem")
    } finally {
      setter(false)
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
        const updated = await api.patch<Loja>("/api/lojas", payload)
        setLoja(updated)
      } else {
        const created = await api.post<Loja>("/api/lojas", payload)
        setLoja(created)
      }
      setOk(loja ? "Loja atualizada com sucesso!" : "Loja criada com sucesso!")
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar loja")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-surface" />
      <div className="h-48 rounded-2xl bg-surface" />
      <div className="h-64 rounded-xl bg-surface" />
    </div>
  )

  const garagemSlug = user?.garagem?.slug

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-faint-foreground">
            Marketplace
          </div>
          <h1 className="font-display text-[28px] font-semibold leading-tight text-foreground">
            {loja ? "Minha Loja" : "Criar Loja"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loja ? "Gerencie o perfil público da sua loja" : "Configure sua presença no marketplace"}
          </p>
        </div>
        {loja && garagemSlug && (
          <Link
            to={`/loja/${garagemSlug}`}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="size-4" />
            Ver loja pública
          </Link>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Banner */}
        <div className="relative">
          {bannerUrl ? (
            <div className="relative h-40 rounded-xl overflow-hidden border border-border">
              <img src={bannerUrl} alt="banner" className="h-full w-full object-cover" />
              <label className="absolute bottom-2 right-2 flex cursor-pointer items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm hover:bg-black/80">
                <Upload className="size-3" /> Trocar banner
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImagem(f, "banner") }} />
              </label>
              {uploadingBanner && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="text-[12px] text-white">Enviando...</span>
                </div>
              )}
            </div>
          ) : (
            <label className={`flex h-40 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface text-faint-foreground transition-colors hover:border-purple hover:text-purple ${uploadingBanner ? "pointer-events-none opacity-60" : ""}`}>
              <Upload className="size-6" />
              <span className="text-[13px] font-medium">{uploadingBanner ? "Enviando..." : "Clique para adicionar banner"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImagem(f, "banner") }} />
            </label>
          )}

          {/* Logo */}
          <div className="absolute -bottom-8 left-5">
            {logoUrl ? (
              <label className="relative flex size-16 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-border bg-surface shadow-lg">
                <img src={logoUrl} alt="logo" className="size-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                  <Upload className="size-4 text-white" />
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImagem(f, "logo") }} />
              </label>
            ) : (
              <label className={`flex size-16 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface shadow-lg hover:border-purple transition-colors ${uploadingLogo ? "pointer-events-none opacity-60" : ""}`}>
                <Store className="size-6 text-faint-foreground" />
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImagem(f, "logo") }} />
              </label>
            )}
          </div>
        </div>

        {/* Fields card */}
        <div className="rounded-xl border border-border bg-surface p-6 mt-4 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Nome da loja *</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Turbo Parts BR"
              maxLength={100}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Descrição</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Descreva sua loja, especialidades, o que você vende..."
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Instagram</label>
              <input
                value={instagram}
                onChange={e => setInstagram(e.target.value)}
                placeholder="@minha_loja"
                maxLength={50}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">WhatsApp</label>
              <input
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="+55 11 99999-9999"
                maxLength={20}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Website</label>
              <input
                type="url"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://minha-loja.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
              />
            </div>
          </div>

          {erro && <p className="rounded-lg bg-red-bg px-3 py-2 text-[12px] text-red">{erro}</p>}
          {ok && <p className="rounded-lg bg-green-bg px-3 py-2 text-[12px] text-green">{ok}</p>}

          <div className="flex gap-3 pt-1">
            <Link
              to="/marketplace"
              className="rounded-lg border border-border px-4 py-2.5 text-[13px] text-muted-foreground hover:text-foreground"
            >
              Voltar ao marketplace
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-purple px-6 py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Save className="size-4" />
              {saving ? "Salvando..." : loja ? "Atualizar loja" : "Criar loja"}
            </button>
          </div>
        </div>
      </form>

      {/* Preview */}
      {loja && garagemSlug && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
            Link público da loja
          </p>
          <Link
            to={`/loja/${garagemSlug}`}
            className="flex items-center gap-2 text-[13px] text-purple hover:underline"
          >
            <ExternalLink className="size-3.5" />
            autohub.app/loja/{garagemSlug}
          </Link>
        </div>
      )}
    </div>
  )
}
