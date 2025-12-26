import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";

const prisma = new PrismaClient();
export const locationsRouter = Router();

locationsRouter.get("/", requireAuth, async (_req, res) => {
  const locations = await prisma.location.findMany({ where: { isDeleted: false }, orderBy: { updatedAt: "desc" } });
  res.json(locations);
});

const locationSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});

locationsRouter.post("/", requireAuth, requireRole(["ADMIN", "MANAGER"]), async (req: AuthedRequest, res) => {
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const loc = await prisma.location.create({ data: parsed.data });
  res.json(loc);
});

locationsRouter.put("/:id", requireAuth, requireRole(["ADMIN", "MANAGER"]), async (req: AuthedRequest, res) => {
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const loc = await prisma.location.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(loc);
});

locationsRouter.delete("/:id", requireAuth, requireRole(["ADMIN", "MANAGER"]), async (req: AuthedRequest, res) => {
  const loc = await prisma.location.update({ where: { id: req.params.id }, data: { isDeleted: true } });
  res.json(loc);
});
