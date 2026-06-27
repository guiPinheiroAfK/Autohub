// Notificações no Discord via webhook.
//
// Desligado automaticamente se DISCORD_WEBHOOK_URL não estiver definida —
// assim o cadastro funciona normalmente em qualquer ambiente sem a chave.
// Nunca lança: uma falha do Discord jamais pode quebrar o registro do usuário.

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL

export async function notificarNovoUsuario(opts: {
  nome: string
  email: string
  via: "email" | "google"
}) {
  if (!WEBHOOK) return

  try {
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "AutoHub",
        embeds: [
          {
            title: "Novo usuário no AutoHub 🚗",
            color: 0x7f77dd,
            fields: [
              { name: "Nome", value: opts.nome || "—", inline: true },
              { name: "Via", value: opts.via === "google" ? "Google" : "E-mail", inline: true },
              { name: "E-mail", value: opts.email || "—" },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    })
  } catch (err) {
    console.error("[discord] falha ao notificar novo usuário:", err)
  }
}
