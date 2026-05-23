// src/app/api/modules/route.ts
// PracticeIQ Section 14 Step 3F-1 - Modules collection route.
// GET /api/modules - list the firm's module catalog with effective enablement.
//
// Auth: requireAuth(Action.MODULES_VIEW). All firm roles hold MODULES_VIEW;
// PLATFORM_OWNER via the short-circuit. Module management is a separate,
// PLATFORM_OWNER-only action (MODULES_MANAGE) on PATCH /api/modules/[key].
//
// Tenant + impersonation: optional ?impersonateFirmId=<firmId> resolved via
// resolveCrossFirmContext() (4F-1 collection pattern). Same-firm needs no
// param; cross-firm is PLATFORM_OWNER-only and writes a fail-closed
// CROSS_FIRM_IMPERSONATE audit row inside the helper. Non-PLATFORM_OWNER
// cross-firm returns 404.
//
// Effective enablement per module = FirmModuleAccess.isEnabled (if a row
// exists for the firm) else ModuleFlag.defaultEnabled. The persisted catalog
// is the ModuleFlag table; if it has no rows (catalog not yet seeded) this
// route returns an empty items list. It never auto-seeds.
//
// Response: { ok: true, data: { items: [{ key, name, description,
//   defaultEnabled, isEnabled }] } }. No routine read audit.
//
// References: MASTER_PROJECT.md Section 14 Step 3F; src/lib/cross-firm.ts;
// src/lib/module-constants.ts.

import { prisma } from "@/lib/prisma";
import { databaseUnavailable, err, ok, requireAuth } from "@/lib/api-helpers";
import { resolveCrossFirmContext } from "@/lib/cross-firm";
import { Action } from "@/lib/permissions";
import { getModuleByKey } from "@/lib/module-constants";

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  const auth = await requireAuth(request, Action.MODULES_VIEW);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const url = new URL(request.url);
  const impersonateFirmId = url.searchParams.get("impersonateFirmId");
  const ctx = await resolveCrossFirmContext({
    request,
    session,
    candidateFirmId: impersonateFirmId,
    entityType: "ModuleFlag",
    routeLabel: "GET /api/modules",
  });
  if (!ctx.ok) return ctx.response;
  const { effectiveFirmId } = ctx;

  try {
    const [flags, access] = await Promise.all([
      prisma.moduleFlag.findMany({
        orderBy: { key: "asc" },
        select: {
          id: true,
          key: true,
          name: true,
          description: true,
          defaultEnabled: true,
        },
      }),
      prisma.firmModuleAccess.findMany({
        where: { firmId: effectiveFirmId },
        select: { moduleFlagId: true, isEnabled: true },
      }),
    ]);

    const overrideByFlagId = new Map(
      access.map((a): [string, boolean] => [a.moduleFlagId, a.isEnabled]),
    );

    const items = flags.map((flag) => {
      const override = overrideByFlagId.get(flag.id);
      return {
        key: flag.key,
        name: flag.name,
        description: flag.description ?? getModuleByKey(flag.key)?.description ?? "",
        defaultEnabled: flag.defaultEnabled,
        isEnabled: override === undefined ? flag.defaultEnabled : override,
      };
    });

    return ok({ items });
  } catch {
    return err("Unable to list modules.", 500);
  }
}
