// Donos do sistema — podem criar rotas oficiais.
// Configurável via ADMIN_EMAILS (lista separada por vírgula);
// padrão: a conta do criador do AutoHub.

const ADMINS = (process.env.ADMIN_EMAILS ?? "guivalen00@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export function isAdmin(email?: string | null): boolean {
  return !!email && ADMINS.includes(email.toLowerCase())
}
