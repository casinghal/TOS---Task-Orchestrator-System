// src/app/api/clients/route.ts
// PracticeIQ Section 14 Step 3B - Clients API (collection routes).
// GET  /api/clients          - paginated list, scoped to caller's firmId.
// POST /api/clients          - create a client under caller's firmId.
// Both routes are auth-gated via requireAuth() and therefore return 401 in
// Step 3A/3B until Step 4 wires real Supabase Auth into requireSession().
// Soft-delete is handled by PATCH /api/clients/[id] setting status="INACTIVE".
// There is no DELETE method by design.
//
// References: MASTER_PROJECT.md Section 14 Step 3B; DECISION_LOG D-2026-04-30-15;
// CHANGE_LOG C-2026-04-30-18.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  databaseUnavailable,
  err,
  ok,
  parseJson,
  requireAuth,
  writeActivityLog,
} from "@/lib/api-helpers";
import { Action } from "@/lib/permissions";

// --- Validation -----------------------------------------------------------
//
// Empty optional fields (pan, gstin, email, mobile) must NOT reach Prisma as
// "" - per Pankaj's 3B refinement, blanks are absent data, not stored data.
// We coerce "" -> undefined inside the schema so .data carries undefined,
// then the route maps undefined -> null on the Prisma write. Trim happens
// before the empty-check.

const optionalTrimmedString = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const CreateClientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required."),
  pan: optionalTrimmedString,
  gstin: optionalTrimmedString,
  email: optionalTrimmedString.refine(
    (v) => v === undefined || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    { message: "Invalid email format." },
  ),
  mobile: optionalTrimmedString,
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
}).strict();

// Pagination query schema.
const PAGE_DEFAULT = 1;
const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

// --- GET /api/clients -----------------------------------------------------

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  const auth = await requireAuth(request, Action.CLIENT_VIEW);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  // Platform Owner outside a firm context cannot list clients without a
  // firmId. Standard users always have a firmId per session.
  if (!session.firmId) {
    return err("No firm context for this session.", 400);
  }

  const url = new URL(request.url);
  const pageRaw = Number(url.searchParams.get("page") ?? PAGE_DEFAULT);
  const pageSizeRaw = Number(url.searchParams.get("pageSize") ?? PAGE_SIZE_DEFAULT);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : PAGE_DEFAULT;
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1
      ? Math.min(Math.floor(pageSizeRaw), PAGE_SIZE_MAX)
      : PAGE_SIZE_DEFAULT;

  try {
    const [items, total] = await Promise.all([
      prisma.client.findMany({
        where: { firmId: session.firmId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.client.count({ where: { firmId: session.firmId } }),
    ]);

    return ok({
      items,
      pagination: { page, pageSize, total },
    });
  } catch {
    return err("Unable to list clients.", 500);
  }
}

// --- POST /api/clients ----------------------------------------------------

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  const auth = await requireAuth(request, Action.CLIENT_MANAGE);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  if (!session.firmId) {
    return err("No firm context for this session.", 400);
  }

  const parsed = await parseJson(request, CreateClientSchema);
  if (!parsed.ok) return parsed.response;
  const payload = parsed.data;

  try {
    const created = await prisma.client.create({
      data: {
        firmId: session.firmId,
        name: payload.name,
        pan: payload.pan ?? null,
        gstin: payload.gstin ?? null,
        email: payload.email ?? null,
        mobile: payload.mobile ?? null,
        status: payload.status ?? "ACTIVE",
      },
    });

    // Deferred no-op per D-2026-04-30-15 Decision 4. Call site preserved so
    // Step 4 can light up the audit trail without route churn.
    await writeActivityLog({
      firmId: session.firmId,
      actorId: session.userId,
      entityType: "Client",
      entityId: created.id,
      action: "CLIENT_CREATE",
    });

    return ok(created, 201);
  } catch {
    return err("Unable to create client.", 500);
  }
}
