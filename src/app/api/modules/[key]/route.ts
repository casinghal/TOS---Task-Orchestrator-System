// src/app/api/modules/[key]/route.ts
// PracticeIQ Section 14 Step 3F-1 - Module access toggle route.
// PATCH /api/modules/[key] - enable/disable one module for the firm.
//
// Auth: requireAuth(Action.MODULES_MANAGE). MODULES_MANAGE is PLATFORM_OWNER-
// only (decision D2): it is in no firm-role base array, so only PLATFORM_OWNER
// passes (via the hasPermission short-circuit). Firm roles get 403.
//
// Tenant + impersonation: optional ?impersonateFirmId=<firmId> resolved via
// resolveCrossFirmContext() (4F-1 collection pattern). Cross-firm is
// PLATFORM_OWNER-only and writes a fail-closed CROSS_FIRM_IMPERSONATE audit row
// inside the helper. (Non-PLATFORM_OWNER never reaches the helper here because
// MODULES_MANAGE already returns 403.)
//
// Body (strict): { isEnabled: boolean }. Unknown module key -> 404.
// Upserts FirmModuleAccess(effectiveFirmId, moduleFlagId) and emits a routine
// fail-open MODULE_ACCESS_CHANGE audit row.
//
// Response: { ok: true, data: { key, name, isEnabled } }.
//
// References: MASTER_PROJECT.md Section 14 Step 3F; src/lib/cross-firm.ts;
// src/lib/module-constants.ts.

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
import { resolveCrossFirmContext } from "@/lib/cross-firm";
import { Action } from "@/lib/permissions";
import { isKnownModuleKey } from "@/lib/module-constants";

const ToggleSchema = z
  .object({
    isEnabled: z.boolean(),
  })
  .strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ key: string }> },
) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  const auth = await requireAuth(request, Action.MODULES_MANAGE);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { key } = await context.params;

  const url = new URL(request.url);
  const impersonateFirmId = url.searchParams.get("impersonateFirmId");
  const ctx = await resolveCrossFirmContext({
    request,
    session,
    candidateFirmId: impersonateFirmId,
    entityType: "ModuleFlag",
    entityId: key,
    routeLabel: "PATCH /api/modules/[key]",
  });
  if (!ctx.ok) return ctx.response;
  const { effectiveFirmId } = ctx;

  const parsed = await parseJson(request, ToggleSchema);
  if (!parsed.ok) return parsed.response;
  const { isEnabled } = parsed.data;

  // Reject keys outside the canonical catalog before touching the DB.
  if (!isKnownModuleKey(key)) {
    return err("Module not found.", 404);
  }

  try {
    // The persisted catalog is the ModuleFlag table. A canonical key with no
    // ModuleFlag row means the catalog has not been seeded yet; treat as 404
    // (handle safely; never auto-seed from the route).
    const flag = await prisma.moduleFlag.findUnique({
      where: { key },
      select: { id: true, name: true, defaultEnabled: true },
    });
    if (!flag) {
      return err("Module not found.", 404);
    }

    const existing = await prisma.firmModuleAccess.findUnique({
      where: {
        firmId_moduleFlagId: { firmId: effectiveFirmId, moduleFlagId: flag.id },
      },
      select: { isEnabled: true },
    });
    const previousIsEnabled = existing ? existing.isEnabled : flag.defaultEnabled;

    await prisma.firmModuleAccess.upsert({
      where: {
        firmId_moduleFlagId: { firmId: effectiveFirmId, moduleFlagId: flag.id },
      },
      create: { firmId: effectiveFirmId, moduleFlagId: flag.id, isEnabled },
      update: { isEnabled },
    });

    // Routine post-mutation audit (fail-open per Step 4E). firmId reflects the
    // effective tenant scope; actorId remains the operator's userId. Metadata
    // carries only the module key and the boolean states - no PII, no secrets.
    await writeActivityLog({
      firmId: effectiveFirmId,
      actorId: session.userId,
      entityType: "ModuleFlag",
      entityId: flag.id,
      action: "MODULE_ACCESS_CHANGE",
      metadataJson: JSON.stringify({ key, isEnabled, previousIsEnabled }),
    });

    return ok({ key, name: flag.name, isEnabled });
  } catch {
    return err("Unable to update module access.", 500);
  }
}
