import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";

const prisma = new PrismaClient();
export const itemsRouter = Router();

itemsRouter.get("/", requireAuth, async (_req, res) => {
  const items = await prisma.item.findMany({ where: { isDeleted: false }, orderBy: { updatedAt: "desc" } });
  res.json(items);
});

const itemSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  barcode: z.string().optional().nullable(),
  reorderLevel: z.number().int().min(0).default(0),
});

itemsRouter.post("/", requireAuth, requireRole(["ADMIN", "MANAGER"]), async (req: AuthedRequest, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.item.create({ data: parsed.data });
  res.json(item);
});

itemsRouter.put("/:id", requireAuth, requireRole(["ADMIN", "MANAGER"]), async (req: AuthedRequest, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const item = await prisma.item.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(item);
});

itemsRouter.delete("/:id", requireAuth, requireRole(["ADMIN", "MANAGER"]), async (req: AuthedRequest, res) => {
  const item = await prisma.item.update({ where: { id: req.params.id }, data: { isDeleted: true } });
  res.json(item);
});
