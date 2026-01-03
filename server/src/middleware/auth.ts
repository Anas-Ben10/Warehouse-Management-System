import type { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyAccessToken } from "../utils/jwt.js";

const prisma = new PrismaClient();


export type AuthedRequest = Request & { user?: { id: string; email: string; role: string; divisionId: string | null } };

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const [, token] = header.split(" ");

  if (!token) return res.status(401).json({ error: "Missing Bearer token" });

  try {
    const payload = verifyAccessToken(token);
    const dbUser = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true, role: true, isActive: true, divisionId: true } });
    if (!dbUser) return res.status(401).json({ error: "Unauthorized" });
    if (!dbUser.isActive) return res.status(403).json({ error: "Pending approval", code: "PENDING_APPROVAL" });
    req.user = { id: dbUser.id, email: dbUser.email, role: dbUser.role, divisionId: dbUser.divisionId ?? null };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
