import { Router } from "express";
import { PrismaClient, TxnType, LocationKind } from "@prisma/client";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const prisma = new PrismaClient();
export const transactionsRouter = Router();

transactionsRouter.get("/", requireAuth, async (_req, res) => {
  const txns = await prisma.transaction.findMany({
    include: { item: true, srcLocation: true, dstLocation: true, createdBy: true, project: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(txns);
});

const txnSchema = z.object({
  offlineOpId: z.string().optional(),
  type: z.nativeEnum(TxnType),
  itemId: z.string().min(1),
  qty: z.number().int().positive(),
  srcLocationId: z.string().optional().nullable(),
  dstLocationId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  isFree: z.boolean().optional(),
  unitPrice: z.number().nonnegative().optional().nullable(),
});

async function bumpStock(itemId: string, locationId: string, delta: number) {
  await prisma.stock.upsert({
    where: { itemId_locationId: { itemId, locationId } },
    create: { itemId, locationId, qty: delta },
    update: { qty: { increment: delta } },
  });
}

type LocLite = { id: string; divisionId: string | null; kind: LocationKind };

async function getLocation(id: string): Promise<LocLite> {
  const loc = await prisma.location.findUnique({ where: { id }, select: { id: true, divisionId: true, kind: true } });
  if (!loc) throw new Error("Location not found");
  return loc;
}

function requireDivisionAssigned(loc: LocLite) {
  if (!loc.divisionId) throw new Error("Location is missing division assignment");
}

transactionsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = txnSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data = parsed.data;

  // Idempotency for offline sync
  if (data.offlineOpId) {
    const exists = await prisma.transaction.findUnique({ where: { offlineOpId: data.offlineOpId } });
    if (exists) return res.json(exists);
  }

  const role = req.user!.role;
  const myDivisionId = req.user!.divisionId;

  try {
    const txn = await prisma.$transaction(async (tx) => {
      let srcId = data.srcLocationId ?? null;
      let dstId = data.dstLocationId ?? null;
      let projectId = data.projectId ?? null;

      // ---- Normalize / compute src/dst for project flows ----
      if (data.type === "PROJECT_ISSUE" || data.type === "PROJECT_RETURN") {
        if (!projectId) throw new Error("projectId required");
        const project = await tx.project.findUnique({ where: { id: projectId }, include: { location: true } });
        if (!project) throw new Error("Project not found");

        if (data.type === "PROJECT_ISSUE") {
          if (!srcId) throw new Error("srcLocationId required");
          dstId = project.locationId;
        } else {
          if (!dstId) throw new Error("dstLocationId required");
          srcId = project.locationId;
        }
      }

      // ---- Permission checks (division scoping) ----
      if (role !== "ADMIN") {
        if (!myDivisionId) throw new Error("Your account is not assigned to a division");

        const assertOwn = (loc: LocLite) => {
          requireDivisionAssigned(loc);
          if (loc.divisionId !== myDivisionId) throw new Error("Forbidden: out of your division");
        };

        if (data.type === "DIVISION_TRANSFER" || data.type === "PROJECT_ISSUE" || data.type === "PROJECT_RETURN") {
          if (role !== "MANAGER") throw new Error("Forbidden");
        }

        if (data.type === "RECEIVE") {
          if (!dstId) throw new Error("dstLocationId required");
          const dst = await getLocation(dstId);
          assertOwn(dst);
        } else if (data.type === "SHIP") {
          if (!srcId) throw new Error("srcLocationId required");
          const src = await getLocation(srcId);
          assertOwn(src);
        } else if (data.type === "TRANSFER") {
          if (!srcId || !dstId) throw new Error("Both srcLocationId and dstLocationId required");
          const src = await getLocation(srcId);
          const dst = await getLocation(dstId);
          assertOwn(src);
          assertOwn(dst);
        } else if (data.type === "DIVISION_TRANSFER") {
          if (!srcId || !dstId) throw new Error("Both srcLocationId and dstLocationId required");
          const src = await getLocation(srcId);
          const dst = await getLocation(dstId);
          requireDivisionAssigned(src);
          requireDivisionAssigned(dst);
          if (src.divisionId !== myDivisionId) throw new Error("Forbidden: source must be in your division");
          if (dst.divisionId === myDivisionId) throw new Error("Destination must be in another division");
          if (dst.kind !== LocationKind.WAREHOUSE) throw new Error("Destination must be a warehouse location");
        } else if (data.type === "PROJECT_ISSUE") {
          if (!srcId || !dstId || !projectId) throw new Error("Invalid project issue request");
          const src = await getLocation(srcId);
          assertOwn(src);
        } else if (data.type === "PROJECT_RETURN") {
          if (!srcId || !dstId || !projectId) throw new Error("Invalid project return request");
          const dst = await getLocation(dstId);
          assertOwn(dst);
        }
      }

      // ---- Create transaction record ----
      const created = await tx.transaction.create({
        data: {
          offlineOpId: data.offlineOpId,
          type: data.type,
          itemId: data.itemId,
          qty: data.qty,
          srcLocationId: srcId,
          dstLocationId: dstId,
          projectId,
          note: data.note ?? null,
          isFree: data.isFree ?? false,
          unitPrice: data.unitPrice ?? null,
          createdById: req.user!.id,
        },
      });

      // ---- Apply stock movements ----
      if (data.type === "RECEIVE") {
        if (!dstId) throw new Error("dstLocationId required");
        await bumpStock(data.itemId, dstId, data.qty);
      } else if (data.type === "SHIP") {
        if (!srcId) throw new Error("srcLocationId required");
        await bumpStock(data.itemId, srcId, -data.qty);
      } else if (data.type === "TRANSFER" || data.type === "DIVISION_TRANSFER") {
        if (!srcId || !dstId) throw new Error("Both srcLocationId and dstLocationId required");
        await bumpStock(data.itemId, srcId, -data.qty);
        await bumpStock(data.itemId, dstId, data.qty);
      } else if (data.type === "PROJECT_ISSUE") {
        if (!srcId || !dstId) throw new Error("Invalid project issue");
        await bumpStock(data.itemId, srcId, -data.qty);
        await bumpStock(data.itemId, dstId, data.qty);
      } else if (data.type === "PROJECT_RETURN") {
        if (!srcId || !dstId) throw new Error("Invalid project return");
        await bumpStock(data.itemId, srcId, -data.qty);
        await bumpStock(data.itemId, dstId, data.qty);
      }

      return created;
    });

    res.json(txn);
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || "Transaction failed" });
  }
});
