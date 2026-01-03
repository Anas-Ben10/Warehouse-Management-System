import { Router } from "express";
import { PrismaClient, LocationKind } from "@prisma/client";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const prisma = new PrismaClient();
export const projectsRouter = Router();

projectsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const role = req.user!.role;
  const divisionId = req.user!.divisionId;

  const where: any = {};
  if (role === "STAFF" && divisionId) where.divisionId = divisionId;
  // MANAGER + ADMIN can see all projects (needed for cross-division project usage)

  const projects = await prisma.project.findMany({
    where,
    include: { division: true, location: true },
    orderBy: { updatedAt: "desc" },
  });

  res.json(
    projects.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      divisionId: p.divisionId,
      division: p.division ? { id: p.division.id, name: p.division.name } : null,
      locationId: p.locationId,
      location: p.location ? { id: p.location.id, code: p.location.code, name: p.location.name } : null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
  );
});

const projectSchema = z.object({
  code: z.string().min(2).max(30).optional(),
  name: z.string().min(2).max(120),
  divisionId: z.string().optional(), // ADMIN can set; MANAGER uses own
});

/**
 * Create a project:
 * - ADMIN: can create under any division (divisionId required)
 * - MANAGER: can create only under their own division
 */
projectsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const role = req.user!.role;
  const meDivisionId = req.user!.divisionId;

  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { code, name, divisionId } = parsed.data;

  let targetDivisionId: string | null = null;

  if (role === "ADMIN") {
    targetDivisionId = divisionId ?? null;
    if (!targetDivisionId) return res.status(400).json({ error: "divisionId is required for admin-created projects" });
  } else {
    if (!meDivisionId) return res.status(400).json({ error: "Your account is not assigned to a division" });
    targetDivisionId = meDivisionId;
    if (role === "STAFF") return res.status(403).json({ error: "Forbidden" });
  }

  const projectCode = (code || `PRJ${Math.random().toString(36).slice(2, 7).toUpperCase()}`).toUpperCase();

  const loc = await prisma.location.create({
    data: {
      code: `PROJECT-${projectCode}`,
      name: `Project: ${name}`,
      kind: LocationKind.PROJECT,
      divisionId: targetDivisionId,
    },
  });

  const project = await prisma.project.create({
    data: { code: projectCode, name, divisionId: targetDivisionId, locationId: loc.id },
    include: { division: true, location: true },
  });

  return res.status(201).json(project);
});

projectsRouter.get("/:id/stock", requireAuth, async (req: AuthedRequest, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id }, include: { location: true } });
  if (!project) return res.status(404).json({ error: "Project not found" });

  const stocks = await prisma.stock.findMany({
    where: { locationId: project.locationId },
    include: { item: true },
    orderBy: { updatedAt: "desc" },
  });

  return res.json(
    stocks.map((s) => ({
      id: s.id,
      itemId: s.itemId,
      locationId: s.locationId,
      qty: s.qty,
      updatedAt: s.updatedAt,
      item: { id: s.item.id, sku: s.item.sku, name: s.item.name, barcode: s.item.barcode, reorderLevel: s.item.reorderLevel },
    }))
  );
});
