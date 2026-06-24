import { SignJWT, jwtVerify, type JWTPayload } from "jose"

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev_secret_change_in_prod_min32chars"
)
const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "60m"

export interface TokenPayload extends JWTPayload {
  sub: string   // userId
  email: string
}

export async function signToken(payload: { sub: string; email: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(secret)
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, secret)
  return payload as TokenPayload
}
