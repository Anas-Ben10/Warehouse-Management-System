import { Router } from "express";
import { PrismaClient, TxnType } from "@prisma/client";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const prisma = new PrismaClient();
export const transactionsRouter = Router();

transactionsRouter.get("/", requireAuth, async (_req, res) => {
  const txns = await prisma.transaction.findMany({
    include: { item: true, srcLocation: true, dstLocation: true, createdBy: true },
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

transactionsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = txnSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data = parsed.data;

  // idempotency for offline sync
  if (data.offlineOpId) {
    const exists = await prisma.transaction.findUnique({ where: { offlineOpId: data.offlineOpId } });
    if (exists) return res.json(exists);
  }

  const txn = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        offlineOpId: data.offlineOpId,
        type: data.type,
        itemId: data.itemId,
        qty: data.qty,
        srcLocationId: data.srcLocationId ?? null,
        dstLocationId: data.dstLocationId ?? null,
        note: data.note ?? null,
        createdById: req.user!.id,
      },
    });

    if (data.type === "RECEIVE") {
      if (!data.dstLocationId) throw new Error("dstLocationId required");
      await bumpStock(data.itemId, data.dstLocationId, data.qty);
    } else if (data.type === "SHIP") {
      if (!data.srcLocationId) throw new Error("srcLocationId required");
      await bumpStock(data.itemId, data.srcLocationId, -data.qty);
    } else if (data.type === "TRANSFER") {
      if (!data.srcLocationId || !data.dstLocationId) throw new Error("Both srcLocationId and dstLocationId required");
      await bumpStock(data.itemId, data.srcLocationId, -data.qty);
      await bumpStock(data.itemId, data.dstLocationId, data.qty);
    }

    return created;
  });

  res.json(txn);
});
