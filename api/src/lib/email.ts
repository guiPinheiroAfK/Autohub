import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = "AutoHub <onboarding@resend.dev>"

export async function enviarVerificacaoEmail(para: string, nome: string, token: string) {
  const link = `${process.env.APP_URL ?? "https://autohubbr.netlify.app"}/verificar-email?token=${token}`
  await resend.emails.send({
    from: FROM,
    to: para,
    subject: "Confirme seu e-mail no AutoHub",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px;font-size:20px">Olá, ${nome} 👋</h2>
        <p style="color:#71717a;margin:0 0 24px">Clique no botão abaixo para confirmar seu e-mail e ativar sua conta no AutoHub.</p>
        <a href="${link}" style="display:inline-block;background:#a855f7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Confirmar e-mail
        </a>
        <p style="color:#a1a1aa;font-size:12px;margin-top:24px">Link válido por 24 horas. Se não foi você, ignore este e-mail.</p>
      </div>
    `,
  })
}

export async function enviarResetSenha(para: string, nome: string, token: string) {
  const link = `${process.env.APP_URL ?? "https://autohubbr.netlify.app"}/resetar-senha?token=${token}`
  await resend.emails.send({
    from: FROM,
    to: para,
    subject: "Redefinição de senha — AutoHub",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px;font-size:20px">Redefinir senha</h2>
        <p style="color:#71717a;margin:0 0 24px">Recebemos uma solicitação para redefinir a senha da conta <strong>${para}</strong>.</p>
        <a href="${link}" style="display:inline-block;background:#a855f7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Redefinir senha
        </a>
        <p style="color:#a1a1aa;font-size:12px;margin-top:24px">Link válido por 1 hora. Se não foi você, ignore este e-mail.</p>
      </div>
    `,
  })
}

export async function enviarConviteColaboracao(
  para: string, nomeConvidador: string, nomeVeiculo: string,
  papel: string, token: string
) {
  const link = `${process.env.APP_URL ?? "https://autohubbr.netlify.app"}/convite?token=${token}`
  const papelLabel = papel === "mecanico" ? "Mecânico" : papel === "editor" ? "Editor" : "Visualizador"
  await resend.emails.send({
    from: FROM,
    to: para,
    subject: `${nomeConvidador} te convidou para colaborar no AutoHub`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px;font-size:20px">Convite de colaboração 🔧</h2>
        <p style="color:#71717a;margin:0 0 8px"><strong>${nomeConvidador}</strong> te convidou para colaborar no build:</p>
        <p style="font-size:18px;font-weight:700;margin:0 0 8px">${nomeVeiculo}</p>
        <p style="color:#71717a;margin:0 0 24px">Seu papel: <strong>${papelLabel}</strong></p>
        <a href="${link}" style="display:inline-block;background:#a855f7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Aceitar convite
        </a>
        <p style="color:#a1a1aa;font-size:12px;margin-top:24px">Se não conhece ${nomeConvidador}, ignore este e-mail.</p>
      </div>
    `,
  })
}
