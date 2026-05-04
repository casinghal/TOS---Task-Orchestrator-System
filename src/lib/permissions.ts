// src/lib/permissions.ts
// Canonical role + action + permission map for PracticeIQ.
// Mirrors MASTER_PROJECT.md Section 10. See DECISION_LOG D-2026-04-30-15
// and AGENTS.md G6 for context.
//
// Code uses uppercase enum-style role codes.
// UI uses humanized labels via FIRM_ROLE_LABEL / PLATFORM_ROLE_LABEL.

export const PlatformRole = {
  PLATFORM_OWNER: "PLATFORM_OWNER",
  STANDARD: "STANDARD",
} as const;

export type PlatformRoleCode = typeof PlatformRole[keyof typeof PlatformRole];

export const FirmRole = {
  FIRM_ADMIN: "FIRM_ADMIN",
  PARTNER: "PARTNER",
  MANAGER: "MANAGER",
  ARTICLE_STAFF: "ARTICLE_STAFF",
} as const;

export type FirmRoleCode = typeof FirmRole[keyof typeof FirmRole];

// Action constants - derived from MASTER_PROJECT.md Section 10 permission matrix.
export const Action = {
  // Tasks
  TASK_CREATE: "TASK_CREATE",
  TASK_EDIT: "TASK_EDIT",
  TASK_ADD_NOTE: "TASK_ADD_NOTE",
  TASK_MOVE_TO_REVIEW: "TASK_MOVE_TO_REVIEW",
  TASK_CLOSE: "TASK_CLOSE",
  // ARTICLE_STAFF holds TASK_VIEW but the route layer enforces an
  // own-or-assigned scope (per Decision C1) for that role. FIRM_ADMIN /
  // PARTNER / MANAGER see firm-wide tasks within tenant.
  TASK_VIEW: "TASK_VIEW",
  // Lifecycle actions added in 3D-3 per Decision A1.
  // TASK_REOPEN: FIRM_ADMIN always; PARTNER / MANAGER if isReviewer.
  //   ARTICLE_STAFF never. Per Section 23.3 (only the original reviewer
  //   or FIRM_ADMIN can reopen a CLOSED task).
  // TASK_CANCEL: FIRM_ADMIN and PARTNER always; MANAGER if isCreator.
  //   ARTICLE_STAFF never. Per Section 23.3 + Section 23.5 (creator can
  //   cancel except when the creator is ARTICLE_STAFF, who cannot cancel
  //   any task per the role restriction).
  TASK_REOPEN: "TASK_REOPEN",
  TASK_CANCEL: "TASK_CANCEL",
  // Clients
  CLIENT_MANAGE: "CLIENT_MANAGE",
  CLIENT_VIEW: "CLIENT_VIEW",
  // Team
  TEAM_MANAGE: "TEAM_MANAGE",
  TEAM_VIEW: "TEAM_VIEW",
  // Reports
  REPORTS_VIEW_ALL: "REPORTS_VIEW_ALL",
  REPORTS_VIEW_OWN: "REPORTS_VIEW_OWN",
  // Modules
  MODULES_MANAGE: "MODULES_MANAGE",
  // Activity
  // ARTICLE_STAFF holds this action, but the route layer enforces an
  // own-actor scope (where.actorId = session.userId) for that role.
  // FIRM_ADMIN / PARTNER / MANAGER see firm-wide activity within tenant.
  ACTIVITY_VIEW: "ACTIVITY_VIEW",
  // Cross-firm (Platform Owner only, audited)
  CROSS_FIRM_IMPERSONATE: "CROSS_FIRM_IMPERSONATE",
} as const;

export type ActionCode = typeof Action[keyof typeof Action];

// Permission context carries facts the API route discovers about the
// target record (e.g. whether the caller is the task creator or reviewer).
// Used to evaluate Section 10's context-aware rules.
export type PermissionContext = {
  isCreator?: boolean;
  isReviewer?: boolean;
  isOwnTask?: boolean;
};

// Session user shape returned by requireSession() (defined in api-helpers.ts).
// Step 3A: requireSession() returns null. Step 4: real Supabase Auth populates this.
export type SessionUser = {
  userId: string;
  email: string;
  platformRole: PlatformRoleCode;
  firmRole?: FirmRoleCode;
  firmId?: string;
};

// Per-firm-role base permissions (non-context-aware).
const FIRM_ROLE_PERMISSIONS: Record<FirmRoleCode, ActionCode[]> = {
  FIRM_ADMIN: [
    Action.TASK_CREATE,
    Action.TASK_EDIT,
    Action.TASK_ADD_NOTE,
    Action.TASK_MOVE_TO_REVIEW,
    Action.TASK_CLOSE,
    Action.TASK_VIEW,
    Action.TASK_REOPEN,
    Action.TASK_CANCEL,
    Action.CLIENT_MANAGE,
    Action.CLIENT_VIEW,
    Action.TEAM_MANAGE,
    Action.REPORTS_VIEW_ALL,
    Action.ACTIVITY_VIEW,
  ],
  PARTNER: [
    Action.TASK_CREATE,
    Action.TASK_ADD_NOTE,
    Action.TASK_MOVE_TO_REVIEW,
    Action.TASK_VIEW,
    Action.TASK_CANCEL,
    Action.CLIENT_MANAGE,
    Action.CLIENT_VIEW,
    Action.TEAM_VIEW,
    Action.REPORTS_VIEW_ALL,
    Action.ACTIVITY_VIEW,
  ],
  MANAGER: [
    Action.TASK_CREATE,
    Action.TASK_ADD_NOTE,
    Action.TASK_MOVE_TO_REVIEW,
    Action.TASK_VIEW,
    Action.CLIENT_MANAGE,
    Action.CLIENT_VIEW,
    Action.TEAM_VIEW,
    Action.REPORTS_VIEW_ALL,
    Action.ACTIVITY_VIEW,
  ],
  ARTICLE_STAFF: [
    Action.TASK_ADD_NOTE,
    Action.TASK_VIEW,
    Action.CLIENT_VIEW,
    Action.TEAM_VIEW,
    Action.REPORTS_VIEW_OWN,
    Action.ACTIVITY_VIEW,
  ],
};

export function hasPermission(
  user: SessionUser | null,
  action: ActionCode,
  context: PermissionContext = {},
): boolean {
  if (!user) return false;

  // Platform Owner: full access in any firm context, plus the platform-only actions.
  if (user.platformRole === PlatformRole.PLATFORM_OWNER) {
    return true;
  }

  // Standard user must have a firm role.
  if (!user.firmRole) return false;

  const allowed = FIRM_ROLE_PERMISSIONS[user.firmRole] ?? [];
  if (allowed.includes(action)) return true;

  // Context-aware rules per MASTER Section 10.
  if (
    action === Action.TASK_EDIT &&
    (user.firmRole === FirmRole.PARTNER || user.firmRole === FirmRole.MANAGER) &&
    (context.isCreator || context.isReviewer)
  ) {
    return true;
  }

  if (
    action === Action.TASK_CLOSE &&
    (user.firmRole === FirmRole.PARTNER || user.firmRole === FirmRole.MANAGER) &&
    context.isReviewer
  ) {
    return true;
  }

  if (
    action === Action.TASK_MOVE_TO_REVIEW &&
    user.firmRole === FirmRole.ARTICLE_STAFF &&
    context.isOwnTask
  ) {
    return true;
  }

  // Lifecycle context-aware rules added in 3D-3 (Section 23.3).
  // TASK_REOPEN: PARTNER and MANAGER may reopen if they are the original
  // reviewer of the task. ARTICLE_STAFF never (no base, no context grant).
  if (
    action === Action.TASK_REOPEN &&
    (user.firmRole === FirmRole.PARTNER || user.firmRole === FirmRole.MANAGER) &&
    context.isReviewer
  ) {
    return true;
  }

  // TASK_CANCEL: MANAGER may cancel if they are the task creator.
  // ARTICLE_STAFF never, even when creator (Section 23.5 restriction).
  if (
    action === Action.TASK_CANCEL &&
    user.firmRole === FirmRole.MANAGER &&
    context.isCreator
  ) {
    return true;
  }

  return false;
}

export type PermissionCheckResult =
  | { ok: true }
  | { ok: false; status: 401 | 403; message: string };

export function requirePermission(
  user: SessionUser | null,
  action: ActionCode,
  context: PermissionContext = {},
): PermissionCheckResult {
  if (!user) {
    return { ok: false, status: 401, message: "Authentication required." };
  }
  if (!hasPermission(user, action, context)) {
    return { ok: false, status: 403, message: "You do not have permission for this action." };
  }
  return { ok: true };
}

// UI label maps. Use these when rendering role names in user-visible copy.
export const FIRM_ROLE_LABEL: Record<FirmRoleCode, string> = {
  FIRM_ADMIN: "Firm Admin",
  PARTNER: "Partner",
  MANAGER: "Manager",
  ARTICLE_STAFF: "Article / Staff",
};

export const PLATFORM_ROLE_LABEL: Record<PlatformRoleCode, string> = {
  PLATFORM_OWNER: "Platform Owner",
  STANDARD: "Standard",
};

// Accept either humanized ("Article / Staff") or code ("ARTICLE_STAFF") form.
// Returns null if the input does not match a known firm role.
export function normalizeFirmRole(input: string): FirmRoleCode | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase().replace(/[\s/-]+/g, "_");
  if (upper in FirmRole) return upper as FirmRoleCode;
  return null;
}

export function normalizePlatformRole(input: string): PlatformRoleCode | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase().replace(/[\s/-]+/g, "_");
  if (upper in PlatformRole) return upper as PlatformRoleCode;
  return null;
}
