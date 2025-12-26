import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { PrismaClient, Role } from "@prisma/client";
import rateLimit from "express-rate-limit";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const prisma = new PrismaClient();

export const authRouter = Router();

const authLimiter = rateLimit({ windowMs: 60_000, max: 20 });
authRouter.use(authLimiter);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await argon2.verify(user.passwordHash, password);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const payload = { sub: user.id, email: user.email, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const cookieSecure = (process.env.COOKIE_SECURE || "false") === "true";
  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure,
    path: "/api/auth/refresh",
  });

  res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("refresh_token", { path: "/api/auth/refresh" });
  res.json({ ok: true });
});

authRouter.post("/refresh", async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: "Missing refresh token" });

  try {
    const payload = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) return res.status(401).json({ error: "Unauthorized" });

    const newPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(newPayload);
    const refreshToken = signRefreshToken(newPayload);

    const cookieSecure = (process.env.COOKIE_SECURE || "false") === "true";
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure,
      path: "/api/auth/refresh",
    });

    res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, isActive: user.isActive });
});

/**
 * Admin creates users (no public registration).
 */
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.nativeEnum(Role),
  password: z.string().min(8),
});

authRouter.post("/users", requireAuth, async (req: AuthedRequest, res) => {
  if (req.user?.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, name, role, password } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "Email already exists" });

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await prisma.user.create({ data: { email, name, role, passwordHash } });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, isActive: user.isActive });
});

authRouter.get("/users", requireAuth, async (req: AuthedRequest, res) => {
  if (req.user?.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  res.json(users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, isActive: u.isActive, createdAt: u.createdAt })));
});

const patchUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
  resetPassword: z.string().min(8).optional(),
});

authRouter.patch("/users/:id", requireAuth, async (req: AuthedRequest, res) => {
  if (req.user?.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

  const parsed = patchUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const id = req.params.id;
  const data: any = { ...parsed.data };
  if (data.resetPassword) {
    data.passwordHash = await argon2.hash(data.resetPassword, { type: argon2.argon2id });
    delete data.resetPassword;
  }
  const user = await prisma.user.update({ where: { id }, data });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, isActive: user.isActive });
});
