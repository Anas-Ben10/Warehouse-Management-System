import { Router } from "express";
import { PrismaClient, LocationKind } from "@prisma/client";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";

const prisma = new PrismaClient();
export const locationsRouter = Router();

/**
 * GET /api/locations
 * - ADMIN: all locations
 * - MANAGER: by default only their division; with ?scope=all returns all WAREHOUSE locations (read-only list)
 * - STAFF: only their division
 */
locationsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const scope = String(req.query.scope || "own").toLowerCase();
  const role = req.user!.role;
  const divisionId = req.user!.divisionId;

  const baseWhere: any = { isDeleted: false };

  if (role === "ADMIN") {
    const locations = await prisma.location.findMany({ where: baseWhere, orderBy: { updatedAt: "desc" } });
    return res.json(locations);
  }

  if (!divisionId) {
    const locations = await prisma.location.findMany({ where: baseWhere, orderBy: { updatedAt: "desc" } });
    return res.json(locations);
  }

  if (role === "MANAGER" && scope === "all") {
    const locations = await prisma.location.findMany({
      where: { ...baseWhere, kind: LocationKind.WAREHOUSE },
      orderBy: { updatedAt: "desc" },
    });
    return res.json(locations);
  }

  const locations = await prisma.location.findMany({
    where: { ...baseWhere, divisionId },
    orderBy: { updatedAt: "desc" },
  });
  return res.json(locations);
});

const locationSchema = z
  .object({
    code: z.string().min(1),
    name: z.string().min(1),
    kind: z.enum(["WAREHOUSE", "PROJECT"]).optional(),
    divisionId: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    lat: z.number().nullable().optional(),
    lng: z.number().nullable().optional(),
  })
  .superRefine((val, ctx) => {
    const kind = val.kind ?? "WAREHOUSE";
    if ((kind === "WAREHOUSE" || kind === "PROJECT") && !val.divisionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "divisionId is required for this location type",
        path: ["divisionId"],
      });
    }
  });


// Admin only: create locations
locationsRouter.post("/", requireAuth, requireRole(["ADMIN"]), async (req: AuthedRequest, res) => {
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data = parsed.data;
  const loc = await prisma.location.create({
    data: {
      code: data.code,
      name: data.name,
      kind: data.kind ?? LocationKind.WAREHOUSE,
      divisionId: data.divisionId ?? null,
      address: data.address ?? null,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
    },
  });

  res.status(201).json(loc);
});

// Admin only: update locations
locationsRouter.put("/:id", requireAuth, requireRole(["ADMIN"]), async (req: AuthedRequest, res) => {
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data = parsed.data;
  const loc = await prisma.location.update({
    where: { id: req.params.id },
    data: {
      code: data.code,
      name: data.name,
      kind: data.kind ?? undefined,
      divisionId: data.divisionId ?? null,
      address: data.address ?? null,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
    },
  });

  res.json(loc);
});

// Admin only: soft delete
locationsRouter.delete("/:id", requireAuth, requireRole(["ADMIN"]), async (req: AuthedRequest, res) => {
  const loc = await prisma.location.update({ where: { id: req.params.id }, data: { isDeleted: true } });
  res.json(loc);
});
