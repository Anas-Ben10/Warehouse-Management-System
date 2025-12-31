import { Router } from "express";
import argon2 from "argon2";
import crypto from "crypto";
import { z } from "zod";
import { PrismaClient, Role } from "@prisma/client";
import rateLimit from "express-rate-limit";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const prisma = new PrismaClient();

export const authRouter = Router();

const authLimiter = rateLimit({ windowMs: 60_000, max: 30 });

function requireRoles(roles: Role[]) {
  return (req: AuthedRequest, res: any, next: any) => {
    const role = req.user?.role as Role | undefined;
    if (!role || !roles.includes(role)) return res.status(403).json({ error: "forbidden" });
    next();
  };
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Login (email + password) – blocks pending users
 */
authRouter.post(
  "/login",
  authLimiter,
  async (req, res) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    });

    const { email, password } = schema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { division: true },
    });

    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    // Pending users cannot login until approved
    if (!user.isActive) {
      return res.status(403).json({
        error: "Pending approval",
        code: "PENDING_APPROVAL",
      });
    }

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id, email: user.email, role: user.role });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/api/auth/refresh",
    });

    return res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        division: user.division ? { id: user.division.id, name: user.division.name } : null,
      },
    });
  }
);

/**
 * Open signup (creates a PENDING user)
 * - role defaults to STAFF
 * - isActive=false (admin must approve)
 */
authRouter.post(
  "/register",
  authLimiter,
  async (req, res) => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(2).max(80),
      password: z.string().min(6).max(200),
    });

    const { email, name, password } = schema.parse(req.body);
    const lower = email.toLowerCase();

    const exists = await prisma.user.findUnique({ where: { email: lower } });
    if (exists) return res.status(409).json({ error: "Email already exists" });

    const passwordHash = await argon2.hash(password);

    const user = await prisma.user.create({
      data: {
        email: lower,
        name,
        passwordHash,
        role: Role.STAFF,
        isActive: false,
      },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    return res.status(201).json({
      message: "Registered. Waiting for admin approval.",
      user,
    });
  }
);

/**
 * Set password using an invite token (admin-created users)
 */
authRouter.post(
  "/set-password",
  authLimiter,
  async (req, res) => {
    const schema = z.object({
      email: z.string().email(),
      token: z.string().min(10),
      password: z.string().min(6).max(200),
    });

    const { email, token, password } = schema.parse(req.body);
    const lower = email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: lower } });
    if (!user || !user.inviteTokenHash || !user.inviteExpiresAt) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    if (user.inviteExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    if (sha256(token) !== user.inviteTokenHash) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const passwordHash = await argon2.hash(password);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        inviteTokenHash: null,
        inviteExpiresAt: null,
        isActive: true, // admin-created users are approved; keep active
      },
    });

    return res.json({ message: "Password set. You can now login." });
  }
);

/**
 * Get current user
 */
authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { division: true },
  });
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  return res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    division: user.division ? { id: user.division.id, name: user.division.name } : null,
  });
});

/**
 * Refresh access token
 */
authRouter.post("/refresh", async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: "No refresh token" });

  try {
    const payload = verifyRefreshToken(token);
    const accessToken = signAccessToken({ sub: payload.sub, email: payload.email, role: payload.role });
    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

/**
 * Logout
 */
authRouter.post("/logout", async (_req, res) => {
  res.clearCookie("refresh_token", { path: "/api/auth/refresh" });
  return res.json({ ok: true });
});

/**
 * Admin: list all users (including pending) + divisions
 * NOTE: We never return passwords; only safe metadata.
 */
authRouter.get(
  "/users",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (_req: AuthedRequest, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { division: true },
    });

    return res.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        division: u.division ? { id: u.division.id, name: u.division.name } : null,
        createdAt: u.createdAt,
      }))
    );
  }
);

/**
 * Admin: update user (approve, change role, assign division)
 */
authRouter.patch(
  "/users/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      name: z.string().min(2).max(80).optional(),
      role: z.nativeEnum(Role).optional(),
      isActive: z.boolean().optional(),
      divisionId: z.string().nullable().optional(),
    });

    const body = schema.parse(req.body);

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.role ? { role: body.role } : {}),
        ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
        ...(body.divisionId !== undefined ? { divisionId: body.divisionId } : {}),
      },
      include: { division: true },
    });

    return res.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      isActive: updated.isActive,
      division: updated.division ? { id: updated.division.id, name: updated.division.name } : null,
    });
  }
);

/**
 * Admin: create an invite (creates an approved user + returns a password-setup link)
 * - If you want it emailed automatically later, add SMTP + a mailer.
 */
authRouter.post(
  "/invite",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(2).max(80),
      role: z.nativeEnum(Role).optional(), // default STAFF
      divisionId: z.string().nullable().optional(),
      expiresHours: z.number().int().min(1).max(168).optional(), // default 48h
    });

    const { email, name, role, divisionId, expiresHours } = schema.parse(req.body);
    const lower = email.toLowerCase();

    const exists = await prisma.user.findUnique({ where: { email: lower } });
    if (exists) return res.status(409).json({ error: "Email already exists" });

    const token = crypto.randomBytes(24).toString("hex");
    const tokenHash = sha256(token);
    const exp = new Date(Date.now() + (expiresHours ?? 48) * 60 * 60 * 1000);

    // random password hash so user cannot login before setting password
    const randomPw = crypto.randomBytes(24).toString("hex");
    const passwordHash = await argon2.hash(randomPw);

    const created = await prisma.user.create({
      data: {
        email: lower,
        name,
        role: role ?? Role.STAFF,
        isActive: true,
        divisionId: divisionId ?? null,
        passwordHash,
        inviteTokenHash: tokenHash,
        inviteExpiresAt: exp,
      },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    const publicAppUrl = process.env.PUBLIC_APP_URL || "";
    const inviteLink = publicAppUrl
      ? `${publicAppUrl.replace(/\/$/, "")}/set-password?email=${encodeURIComponent(lower)}&token=${encodeURIComponent(token)}`
      : `Set PUBLIC_APP_URL to generate a clickable link. Token=${token}`;

    return res.status(201).json({
      user: created,
      inviteLink,
      expiresAt: exp,
      note:
        publicAppUrl
          ? "Send this link to the user to set their password."
          : "Set PUBLIC_APP_URL in your backend env to generate a usable link.",
    });
  }
);

/**
 * Manager: list STAFF in manager's division
 */
authRouter.get(
  "/team",
  requireAuth,
  requireRoles([Role.MANAGER]),
  async (req: AuthedRequest, res) => {
    const me = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!me?.divisionId) return res.json([]);

    const staff = await prisma.user.findMany({
      where: { role: Role.STAFF, divisionId: me.divisionId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });

    return res.json(staff);
  }
);

/**
 * Divisions
 */
authRouter.get("/divisions", requireAuth, async (_req: AuthedRequest, res) => {
  const divisions = await prisma.division.findMany({ orderBy: { name: "asc" } });
  return res.json(divisions);
});

authRouter.post(
  "/divisions",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (req: AuthedRequest, res) => {
    const schema = z.object({ name: z.string().min(2).max(60) });
    const { name } = schema.parse(req.body);

    const div = await prisma.division.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    return res.status(201).json(div);
  }
);
