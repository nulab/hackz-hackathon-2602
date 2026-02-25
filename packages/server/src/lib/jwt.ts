import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "hackz-dev-secret");

export const signToken = async (userId: string): Promise<string> =>
  new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(SECRET);

export const verifyToken = async (token: string): Promise<{ sub: string } | null> => {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { sub: string };
  } catch {
    return null;
  }
};
