// src/lib/api-client.ts
// Section 14 Step 5B-0: thin typed browser data-access layer.
//
// SCAFFOLDING ONLY. This module is NOT yet wired into the UI. The
// source-of-truth cutover (the UI reading/writing through these functions
// instead of seed data + localStorage) happens in 5B-1 onward, one domain at
// a time. Exact route response DTOs and list pagination shapes are pinned
// per-domain during 5B-1 contract pinning; the interfaces below are
// PROVISIONAL and may be refined when each domain is cut over.
//
// Response envelope (from src/lib/api-helpers.ts):
//   success -> { ok: true, data }
//   error   -> { ok: false, message }
//
// Status semantics (centralised here so the UI never has to guess):
//   401 -> session/login issue        (kind: "session")
//   403 -> authorization/role issue   (kind: "authorization")
//   400 / 422 -> validation           (kind: "validation")
//   404 -> not found                  (kind: "not_found")
//   503 -> database unavailable       (kind: "db_unavailable")
//   500 / other 5xx -> defect         (kind: "server")  <- must block progression
//   fetch threw -> network            (kind: "network")

export type ApiErrorKind =
  | "session"
  | "authorization"
  | "validation"
  | "not_found"
  | "db_unavailable"
  | "server"
  | "network";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;

  constructor(kind: ApiErrorKind, status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

function classifyStatus(status: number, message: string): ApiError {
  switch (status) {
    case 401:
      return new ApiError("session", status, message || "Authentication required.");
    case 403:
      return new ApiError("authorization", status, message || "You do not have access to this action.");
    case 400:
    case 422:
      return new ApiError("validation", status, message || "The request was invalid.");
    case 404:
      return new ApiError("not_found", status, message || "Not found.");
    case 503:
      return new ApiError("db_unavailable", status, message || "The database is currently unavailable.");
    default:
      // 500 and any other non-2xx without a specific mapping are treated as
      // defects. Callers must surface these and stop, not silently fall back.
      return new ApiError("server", status, message || "Unexpected server error.");
  }
}

type SuccessEnvelope<T> = { ok: true; data?: T };
type ErrorEnvelope = { ok: false; message?: string; details?: unknown };
type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

async function doFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError("network", 0, "Network request failed. Check your connection and try again.");
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await doFetch(path, init);

  let envelope: Envelope<T> | null = null;
  try {
    envelope = (await response.json()) as Envelope<T>;
  } catch {
    envelope = null;
  }

  if (!response.ok || !envelope || envelope.ok === false) {
    const message =
      envelope && envelope.ok === false && typeof envelope.message === "string" ? envelope.message : "";
    throw classifyStatus(response.status, message);
  }

  return envelope.data as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// --- Provisional API DTOs (confirm exact shapes during 5B-1 contract pinning) ---

export interface ClientDTO {
  id: string;
  firmId: string;
  name: string;
  pan: string | null;
  gstin: string | null;
  email: string | null;
  mobile: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDTO {
  id: string;
  firmId: string;
  clientId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string;
  reviewerId: string;
  createdById: string;
  closedById: string | null;
  closureRemarks: string | null;
  closedAt: string | null;
  assignees: { userId: string }[];
  createdAt: string;
  updatedAt: string;
}

// Section 14 Step 5B-4d-2a: a task progress note as returned by
// GET /api/tasks/[id]/notes. authorId is a PlatformUser userId (resolve names
// with the userId-based lookup). oldStatus/newStatus are non-null only on
// lifecycle-attached notes; status-less notes carry null.
export interface TaskNoteDTO {
  id: string;
  taskId: string;
  authorId: string;
  note: string;
  oldStatus: string | null;
  newStatus: string | null;
  createdAt: string;
}

export interface TeamMemberDTO {
  firmMemberId: string;
  userId: string;
  name: string;
  email: string;
  firmRole: string;
  isActive: boolean;
  joinedAt: string;
}

export interface TeamListResult {
  items: TeamMemberDTO[];
  pagination: { page: number; pageSize: number; total: number };
}

// Section 14 Step 5B-3a-pre: current-user identity (GET /api/me). Minimal,
// current-user-only shape. No email / passwordHash / tokens; see route comment.
export interface MeDTO {
  userId: string;
  firmMemberId: string;
  name: string;
  firmRole: string;
  platformRole: string;
  firmId: string;
}

export interface ModuleDTO {
  key: string;
  name: string;
  // description and defaultEnabled are returned by GET /api/modules (list) only.
  // PATCH /api/modules/[key] returns { key, name, isEnabled } — these fields are absent.
  description?: string;
  defaultEnabled?: boolean;
  isEnabled: boolean;
}

export interface ActivityDTO {
  id: string;
  firmId: string | null;
  actorId: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  createdAt: string;
}

export interface FirmDTO {
  id: string;
  name: string;
  emailDomain: string | null;
  city: string | null;
  status: string;
}

// --- Per-domain endpoints (paths fixed; response shapes provisional) ---
// Out of scope (no API route, deferred per 5B controls):
//   - task resequencing  (UI-only ordering; not persisted; disabled in 5B-4)
//   - member password reset (Supabase Auth flow; disabled in 5B-3)
//   - firm directory / multi-firm list (parked; single active firm only)

export interface ClientListResult {
  items: ClientDTO[];
  pagination: { page: number; pageSize: number; total: number };
}

export const clientsApi = {
  // GET /api/clients returns { items, pagination } (confirmed in 5B-1). Single
  // page sized for the POC; add pagination if total exceeds pageSize later.
  list: () => apiGet<ClientListResult>("/api/clients?page=1&pageSize=200"),
  get: (id: string) => apiGet<ClientDTO>(`/api/clients/${id}`),
  create: (input: { name: string; pan?: string; gstin?: string; email?: string; mobile?: string }) =>
    apiPost<ClientDTO>("/api/clients", input),
  update: (
    id: string,
    input: Partial<{ name: string; pan: string; gstin: string; email: string; mobile: string; status: string }>,
  ) => apiPatch<ClientDTO>(`/api/clients/${id}`, input),
};

export const teamApi = {
  // GET /api/team returns { items, pagination } (3E-1). status=all includes
  // inactive members for read-only display; pageSize within MAX_TEAM_PAGE_SIZE (200).
  list: () => apiGet<TeamListResult>("/api/team?status=all&page=1&pageSize=200"),
  get: (id: string) => apiGet<TeamMemberDTO>(`/api/team/${id}`),
  create: (input: { name: string; email: string; firmRole: string }) =>
    apiPost<TeamMemberDTO>("/api/team", input),
  update: (id: string, input: Partial<{ firmRole: string }>) =>
    apiPatch<TeamMemberDTO>(`/api/team/${id}`, input),
  // Section 14 Step 5B-3b defect fix: the server schemas at
  // /api/team/[id]/deactivate and /api/team/[id]/reactivate Zod-validate the
  // request body as `{ reason: string }` (required). The wrappers therefore
  // require a `reason` argument and always send a JSON body. No-body POST
  // previously caused 400 "Invalid JSON payload." in 5B-3b UAT.
  deactivate: (id: string, reason: string) =>
    apiPost<TeamMemberDTO>(`/api/team/${id}/deactivate`, { reason }),
  reactivate: (id: string, reason: string) =>
    apiPost<TeamMemberDTO>(`/api/team/${id}/reactivate`, { reason }),
  // Section 14 Step 5B-3c-2: trigger an email-based password reset for a team
  // member. Backend POST /api/team/[id]/password-reset Zod-requires a non-empty
  // { reason } body and returns { sent: true }. Recovery email only (Option A);
  // no service-role, no admin auth APIs.
  resetPassword: (id: string, reason: string) =>
    apiPost<{ sent: boolean }>(`/api/team/${id}/password-reset`, { reason }),
};

// Section 14 Step 5B-3a-pre: current-user identity (server-authoritative).
// GET /api/me returns the signed-in principal's own minimal identity; the UI's
// current-user/role binding reads this (separate from the teamApi list). Not
// wired into the UI yet - page.tsx consumption is 5B-3a.
export const meApi = {
  get: () => apiGet<MeDTO>("/api/me"),
};

export interface TaskListResult {
  items: TaskDTO[];
  pagination: { page: number; pageSize: number; total: number };
}

export const tasksApi = {
  // Section 14 Step 5B-4a: GET /api/tasks returns { items, pagination } (3D-1);
  // pageSize within MAX_TASK_PAGE_SIZE (200).
  list: () => apiGet<TaskListResult>("/api/tasks?page=1&pageSize=200"),
  get: (id: string) => apiGet<TaskDTO>(`/api/tasks/${id}`),
  create: (input: {
    clientId: string;
    title: string;
    description?: string;
    priority?: string;
    dueDate: string;
    reviewerId: string;
    assigneeIds?: string[];
  }) => apiPost<TaskDTO>("/api/tasks", input),
  update: (
    id: string,
    input: Partial<{ title: string; description: string; priority: string; dueDate: string; status: string; note: string; reviewerId: string }>,
  ) => apiPatch<TaskDTO>(`/api/tasks/${id}`, input),
  addNote: (id: string, note: string) => apiPost<unknown>(`/api/tasks/${id}/notes`, { note }),
  // Section 14 Step 5B-4d-2a: notes-read API. GET /api/tasks/[id]/notes returns
  // the task's notes newest-first as `{ items }`. Read-only; not audited.
  listNotes: (id: string) => apiGet<{ items: TaskNoteDTO[] }>(`/api/tasks/${id}/notes`),
  // Section 14 Step 5B-4d-1: the assignees route schema is strict set semantics
  // `{ add?: string[], remove?: string[] }` (at least one required; final count
  // must stay in [1, MAX_ASSIGNEES_PER_TASK]). The previous `{ assigneeIds }`
  // body would have been rejected by the `.strict()` schema.
  setAssignees: (id: string, input: { add?: string[]; remove?: string[] }) =>
    apiPatch<TaskDTO>(`/api/tasks/${id}/assignees`, input),
  close: (id: string, closureRemarks?: string) =>
    apiPost<TaskDTO>(`/api/tasks/${id}/close`, closureRemarks ? { closureRemarks } : undefined),
  // Section 14 Step 5B-4c-2: the reopen/cancel routes Zod-require a non-empty
  // `{ reason }` body (min1, "... reason is required."); the previous optional
  // `{ note }` shape would have been rejected with 422. Reason is required at
  // the wrapper signature so call sites cannot omit it.
  reopen: (id: string, reason: string) =>
    apiPost<TaskDTO>(`/api/tasks/${id}/reopen`, { reason }),
  cancel: (id: string, reason: string) =>
    apiPost<TaskDTO>(`/api/tasks/${id}/cancel`, { reason }),
};

export const activityApi = {
  list: (params?: { entityType?: string; action?: string; from?: string; to?: string }) => {
    const search = new URLSearchParams();
    if (params?.entityType) search.set("entityType", params.entityType);
    if (params?.action) search.set("action", params.action);
    if (params?.from) search.set("from", params.from);
    if (params?.to) search.set("to", params.to);
    const qs = search.toString();
    // Section 14 Step 5B-5a: GET /api/activity returns ok({ items, pagination }),
    // not a bare array. Typed to match the route shape.
    return apiGet<{ items: ActivityDTO[]; pagination: { page: number; pageSize: number; total: number } }>(
      `/api/activity${qs ? `?${qs}` : ""}`,
    );
  },
};

export const modulesApi = {
  // GET /api/modules returns { ok: true, data: { items: [...] } }; apiGet unwraps data.
  list: () => apiGet<{ items: ModuleDTO[] }>("/api/modules"),
  // PATCH success requires a PLATFORM_OWNER session; non-PO roles get 403 (5B-5b UAT).
  // Returns { key, name, isEnabled } — description/defaultEnabled absent (optional on DTO).
  setEnabled: (key: string, isEnabled: boolean) => apiPatch<ModuleDTO>(`/api/modules/${key}`, { isEnabled }),
};

export const firmApi = {
  // Firm profile is read via the session's firm context. The exact endpoint
  // (GET /api/firms/[firmId] vs a dedicated session endpoint) is confirmed in 5B-1.
  get: (firmId: string) => apiGet<FirmDTO>(`/api/firms/${firmId}`),
  update: (firmId: string, input: Partial<{ name: string; city: string; status: string; emailDomain: string }>) =>
    apiPatch<FirmDTO>(`/api/firms/${firmId}`, input),
};
