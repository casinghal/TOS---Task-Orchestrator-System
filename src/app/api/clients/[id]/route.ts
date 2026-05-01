// src/app/api/clients/[id]/route.ts
// PracticeIQ Section 14 Step 3B - Clients API (item routes).
// GET   /api/clients/[id]   - read one client; 404 if missing or cross-firm.
// PATCH /api/clients/[id]   - partial update; soft-delete via status="INACTIVE".
// Both routes are auth-gated via requireAuth() and therefore return 401 in
// Step 3A/3B until Step 4 wires real Supabase Auth into requireSession().
// There is no DELETE method by design; soft-delete only.
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
// PATCH semantics per Pankaj's 3B refinement: blanks are not stored data.
// - key absent from JSON body  -> field stays untouched on Prisma update
// - key present + ""           -> field is explicitly cleared (set to null)
// - key present + value        -> field is set to value
//
// We achieve this by collapsing whitespace-only / empty strings to null
// inside the transform. The schema then carries `string | null | undefined`
// for each optional contact field, which maps directly to Prisma update
// semantics (undefined = skip, null = clear, string = set).

const nullableContactField = z
  .string()
  .transform((v) => {
    const t = v.trim();
    return t === "" ? null : t;
  })
  .optional();

const nullableEmailField = z
  .string()
  .transform((v, ctx) => {
    const t = v.trim();
    if (t === "") return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid email format.",
      });
      return z.NEVER;
    }
    return t;
  })
  .optional();

const UpdateClientSchema = z
  .object({
    name: z.string().trim().min(1, "Client name cannot be empty.").optional(),
    pan: nullableContactField,
    gstin: nullableContactField,
    email: nullableEmailField,
    mobile: nullableContactField,
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.pan !== undefined ||
      data.gstin !== undefined ||
      data.email !== undefined ||
      data.mobile !== undefined ||
      data.status !== undefined,
    { message: "At least one field is required." },
  );

// --- GET /api/clients/[id] ------------------------------------------------

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  const auth = await requireAuth(request, Action.CLIENT_VIEW);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  if (!session.firmId) {
    return err("No firm context for this session.", 400);
  }

  const { id } = await context.params;

  try {
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client || client.firmId !== session.firmId) {
      // Treat cross-firm hits as 404 to avoid leaking that the id exists.
      return err("Client not found.", 404);
    }
    return ok(client);
  } catch {
    return err("Unable to read client.", 500);
  }
}

// --- PATCH /api/clients/[id] ---------------------------------------------

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  const auth = await requireAuth(request, Action.CLIENT_MANAGE);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  if (!session.firmId) {
    return err("No firm context for this session.", 400);
  }

  const { id } = await context.params;

  const parsed = await parseJson(request, UpdateClientSchema);
  if (!parsed.ok) return parsed.response;
  const payload = parsed.data;

  try {
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing || existing.firmId !== session.firmId) {
      return err("Client not found.", 404);
    }

    // Build update payload. Undefined = skip; null = clear; string = set.
    // This maps cleanly to Prisma's update semantics.
    const updated = await prisma.client.update({
      where: { id },
      data: {
        name: payload.name,
        pan: payload.pan,
        gstin: payload.gstin,
        email: payload.email,
        mobile: payload.mobile,
        status: payload.status,
      },
    });

    // Deferred no-op per D-2026-04-30-15 Decision 4. Call preserved so
    // Step 4 can light up the audit trail without route churn.
    const isSoftDelete =
      payload.status === "INACTIVE" && existing.status !== "INACTIVE";
    await writeActivityLog({
      firmId: session.firmId,
      actorId: session.userId,
      entityType: "Client",
      entityId: updated.id,
      action: isSoftDelete ? "CLIENT_SOFT_DELETE" : "CLIENT_UPDATE",
    });

    return ok(updated);
  } catch {
    return err("Unable to update client.", 500);
  }
}
