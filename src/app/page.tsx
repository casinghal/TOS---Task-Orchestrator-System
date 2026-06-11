"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Crown,
  Eye,
  FileDown,
  Gauge,
  KeyRound,
  LayoutGrid,
  List,
  LockKeyhole,
  LogOut,
  Mail,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  UserCog,
  UserPlus,
  Users,
  Zap,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  plans,
  statuses,
  type Assignment,
  type Client,
  type FirmProfile,
  type FirmRole,
  type ModuleFlag,
  type Task,
  type TaskStatus,
  type TeamMember,
} from "@/lib/workspace-data";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { clientsApi, teamApi, meApi, tasksApi, activityApi, modulesApi, ApiError, type ClientDTO, type TeamMemberDTO, type MeDTO, type TaskDTO, type TaskNoteDTO, type ActivityDTO } from "@/lib/api-client";
// Section 14 Step 5B-4c-1a: reuse the server transition matrix for transition-aware
// UI gating (no drift). Pure constants module; client-safe. Code-vocabulary type
// aliased to avoid colliding with the UI-label TaskStatus from workspace-data.
import { isAllowedTransition, type TaskStatus as TaskStatusCode } from "@/lib/task-constants";

type Section = "dashboard" | "tasks" | "assignments" | "projectReview" | "clients" | "team" | "reports" | "firmSetup" | "admin";
type ViewMode = "list" | "kanban";
type Modal = "task" | "assignment" | "client" | "team" | null;
type MemberActions = {
  resetPassword: (memberId: string) => void;
  resettingId: string | null;
  setActive: (memberId: string, isActive: boolean) => void;
  updateRole: (memberId: string, firmRole: FirmRole) => void;
};
type WorkMapActions = {
  reassignTask: (taskId: string, assigneeId: string) => void;
  updateReviewer: (taskId: string, reviewerId: string) => void;
  // Section 14 Step 5B-4d-1: task id of the people update currently in flight
  // (null when idle). Row selects disable while a people update is pending.
  peoplePendingTaskId: string | null;
};

const todayIso = "2026-04-27";
const workspaceStorageKey = "practiceiq-live-v1";
const legacyStorageKeys = ["tos-tams-tkg-live-v1", "tos-tams-tkg-live-v2", "tos-tams-tkg-live-v3"];
// Section 14 Step 5B-final (F1): platformOwnerEmail removed with the pre-login gate.
const creatorRoles: FirmRole[] = ["Firm Admin", "Partner", "Manager"];
const firmRoles: FirmRole[] = ["Firm Admin", "Partner", "Manager", "Article/Staff"];

// Section 14 Step 5B-2: client CREATE writes through the API (POST /api/clients),
// then the list refetches from GET /api/clients. Client edit/soft-delete remain out
// of scope (no UI exists for them).
const CLIENT_WRITES_ENABLED = true;

// Maps the API client DTO to the UI Client shape (null -> undefined; status case).
function mapClientDtoToUi(dto: ClientDTO): Client {
  return {
    id: dto.id,
    name: dto.name,
    pan: dto.pan ?? undefined,
    gstin: dto.gstin ?? undefined,
    email: dto.email ?? undefined,
    mobile: dto.mobile ?? undefined,
    status: dto.status === "INACTIVE" ? "Inactive" : "Active",
  };
}

// Section 14 Step 5B-3b: team WRITE cutover for add / role change / deactivate /
// reactivate. Writes go through the existing 3E routes; the UI refetches the
// team list on success. No optimistic UI; no client-side ActivityLog (the
// server already writes ActivityLog rows for each write).
const TEAM_WRITES_ENABLED = true;
// Section 14 Step 5B-3c-2: the backend route (POST /api/team/[id]/password-reset)
// and the recovery page shipped in 5B-3c-1; this flag now enables the Team UI
// reset button and the wired resetMemberPassword call path.
const TEAM_PASSWORD_RESET_ENABLED = true;

// Section 14 Step 5B-4b: task CREATE cutover only. Create is enabled via this flag;
// move/status, notes, assignees, reviewer update, and resequence stay parked on
// TASK_WRITES_ENABLED (false).
const TASK_CREATE_ENABLED = true;

// Section 14 Step 5B-4c-1: task STATUS MOVE + CLOSE cutover. Lifecycle workflow
// buttons (status transitions) and the Close-after-review flow are enabled via
// this flag and write through the API (source of truth). The progress-note form,
// assignee update, reviewer update, and resequence stay parked on
// TASK_WRITES_ENABLED (false). Reopen and Cancel are deferred to 5B-4c-2.
const TASK_LIFECYCLE_ENABLED = true;

// Section 14 Step 5B-4d-1: task PEOPLE update cutover (assignee swap + reviewer
// change). The row selects write through PATCH /api/tasks/[id]/assignees and
// PATCH /api/tasks/[id] { reviewerId } and refetch from the API. Notes (no read
// API yet; 5B-4d-2) and resequence (no API; 5B-4e) stay parked on
// TASK_WRITES_ENABLED (false).
const TASK_PEOPLE_ENABLED = true;

// Section 14 Step 5B-4d-2b: task NOTES UI cutover. The drawer renders notes from
// GET /api/tasks/[id]/notes (5B-4d-2a) and adds notes via POST /api/tasks/[id]/notes
// then refetches (no local echo). TASK_WRITES_ENABLED stays false (resequence parked).
const TASK_NOTES_ENABLED = true;

// Section 14 Step 5B-5b: modules READ cutover. The modules list reads from
// GET /api/modules (API is source of truth). MODULES_READ_ENABLED gates the fetch
// effect. MODULE_TOGGLE_ENABLED gates the async PATCH toggle path. Both are true
// because the domain is small enough to cut reads and writes in a single wave.
// PLATFORM_OWNER only for PATCH; all roles can read (MODULES_VIEW permission).
const MODULES_READ_ENABLED = true;
const MODULE_TOGGLE_ENABLED = true;

// Section 14 Step 5B-final-F3: Assignments + Project Review are parked. There is no
// Assignment backend (no model, no /api/assignments, no Task.assignmentId), so the
// feature is gated off the pilot nav and its write paths. Flip to true only when a
// real Assignment backend ships.
const ASSIGNMENTS_ENABLED = false;

// FirmRole code (API) -> UI display string.
function firmRoleCodeToUi(code: string): FirmRole {
  switch (code) {
    case "FIRM_ADMIN": return "Firm Admin";
    case "PARTNER": return "Partner";
    case "MANAGER": return "Manager";
    case "ARTICLE_STAFF": return "Article/Staff";
    default: return "Article/Staff";
  }
}

// FirmRole UI display string -> API code. Section 14 Step 5B-3b: write
// cutover converts the form value to the FirmRole enum the server expects.
function firmRoleUiToCode(role: FirmRole): string {
  switch (role) {
    case "Firm Admin": return "FIRM_ADMIN";
    case "Partner": return "PARTNER";
    case "Manager": return "MANAGER";
    case "Article/Staff": return "ARTICLE_STAFF";
  }
}

// PlatformRole code (API) -> UI display string.
function platformRoleCodeToUi(code: string): TeamMember["platformRole"] {
  return code === "PLATFORM_OWNER" ? "Platform Owner" : "Standard";
}

// Maps an API team member (GET /api/team) to the UI TeamMember shape. id binds to
// firmMemberId. platformRole is NOT returned by /api/team, so it defaults to
// "Standard" for list display only (it never drives current-user role decisions).
function mapTeamDtoToUi(dto: TeamMemberDTO): TeamMember {
  const role = firmRoleCodeToUi(dto.firmRole);
  return {
    id: dto.firmMemberId,
    userId: dto.userId,
    name: dto.name,
    email: dto.email,
    firmRole: role,
    role,
    platformRole: "Standard",
    lastActive: dto.isActive ? "Active" : "Inactive",
    isActive: dto.isActive,
  };
}

// Section 14 Step 5B-4a: task status/priority code -> UI label maps. Faithful to
// the server vocabulary (workspace-data unions were extended with "Cancelled" /
// "Critical"). Unknown codes fall back safely (warn + Open / Normal).
const TASK_STATUS_CODE_TO_UI: Record<string, TaskStatus> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  PENDING_CLIENT: "Pending Client",
  PENDING_INTERNAL: "Pending Internal",
  UNDER_REVIEW: "Under Review",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const TASK_PRIORITY_CODE_TO_UI: Record<string, Task["priority"]> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  CRITICAL: "Critical",
};

function taskStatusCodeToUi(code: string): TaskStatus {
  const mapped = TASK_STATUS_CODE_TO_UI[code];
  if (!mapped) {
    console.warn("Unknown task status code from API; defaulting to Open:", code);
    return "Open";
  }
  return mapped;
}

function taskPriorityCodeToUi(code: string): Task["priority"] {
  const mapped = TASK_PRIORITY_CODE_TO_UI[code];
  if (!mapped) {
    console.warn("Unknown task priority code from API; defaulting to Normal:", code);
    return "Normal";
  }
  return mapped;
}

// Section 14 Step 5B-4b: UI priority label -> server code for task create. Visible
// create options are Low/Normal/High/Critical; "Urgent" remains only as a
// backward-compat fallback (-> CRITICAL) and is not offered in the create modal.
function priorityUiToCode(label: string): string {
  switch (label) {
    case "Low": return "LOW";
    case "Normal": return "NORMAL";
    case "High": return "HIGH";
    case "Critical": return "CRITICAL";
    case "Urgent": return "CRITICAL";
    default:
      console.warn("Unknown task priority label; defaulting to NORMAL:", label);
      return "NORMAL";
  }
}

// Section 14 Step 5B-4c-1: UI status label -> server code for lifecycle moves.
// Mirrors TASK_STATUS_CODE_TO_UI. Closed routes through the dedicated /close API
// (not PATCH). Cancelled / closed-task reopen are not enabled in this wave
// (deferred to 5B-4c-2); moveTask guards Cancelled before this map is used.
function statusUiToCode(status: TaskStatus): string {
  switch (status) {
    case "Open": return "OPEN";
    case "In Progress": return "IN_PROGRESS";
    case "Pending Client": return "PENDING_CLIENT";
    case "Pending Internal": return "PENDING_INTERNAL";
    case "Under Review": return "UNDER_REVIEW";
    case "Closed": return "CLOSED";
    case "Cancelled": return "CANCELLED";
    default:
      console.warn("Unknown task status label; defaulting to OPEN:", status);
      return "OPEN";
  }
}

// Section 14 Step 5B-4c-1a: transition-aware UI gating. Mirrors the server
// transition matrix (task-constants) so workflow buttons only offer legal next
// states. Closed/Cancelled are treated as terminal here because reopen/cancel
// are parked for 5B-4c-2 (CLOSED -> IN_PROGRESS is a /reopen action, not a PATCH).
function lifecycleCanMoveTo(currentUi: TaskStatus, targetUi: TaskStatus): boolean {
  if (currentUi === "Closed" || currentUi === "Cancelled") return false;
  return isAllowedTransition(
    statusUiToCode(currentUi) as TaskStatusCode,
    statusUiToCode(targetUi) as TaskStatusCode,
  );
}

// Section 14 Step 5B-4b: controlled error messaging for task create (no silent fallback).
function taskCreateErrorMessage(error: ApiError): string {
  switch (error.kind) {
    case "session": return "Your session has expired. Please sign in again.";
    case "authorization": return "You do not have permission to create tasks.";
    case "not_found": return error.message || "The selected client, reviewer, or assignee was not found in this firm.";
    case "validation": return error.message || "Please check the task details and try again.";
    case "db_unavailable": return "Task creation is temporarily unavailable. Please retry shortly.";
    default: return "Could not create the task. Please try again.";
  }
}

// Section 14 Step 5B-4c-1: controlled lifecycle error messaging for status move +
// close. Covers 401/403/404/422/503 via ApiError.kind. No silent fallback.
function taskLifecycleErrorMessage(error: ApiError): string {
  switch (error.kind) {
    case "session": return "Your session has expired. Please sign in again.";
    case "authorization": return "You do not have permission to change this task.";
    case "not_found": return error.message || "This task was not found in this firm.";
    case "validation": return error.message || "This status change is not allowed. Please refresh and try again.";
    case "db_unavailable": return "Task updates are temporarily unavailable. Please retry shortly.";
    default: return "Could not update the task. Please try again.";
  }
}

// Maps an API task (GET /api/tasks) to the UI Task shape. assignmentId has no API
// source (left undefined; grouping views handle that safely); notes are not in the
// list response (set [] in 5B-4a; per-task notes load in 5B-4d); sequence has no
// API source (display order follows the server's createdAt desc).
function mapTaskDtoToUi(dto: TaskDTO): Task {
  return {
    id: dto.id,
    title: dto.title,
    clientId: dto.clientId,
    dueDate: dto.dueDate,
    status: taskStatusCodeToUi(dto.status),
    priority: taskPriorityCodeToUi(dto.priority),
    assigneeIds: dto.assignees.map((a) => a.userId),
    reviewerId: dto.reviewerId,
    createdById: dto.createdById,
    updatedAt: dto.updatedAt,
    description: dto.description ?? undefined,
    closureRemarks: dto.closureRemarks ?? undefined,
    closedAt: dto.closedAt ?? undefined,
    notes: [],
  };
}

// Builds the current-user object from the server-authoritative /api/me identity.
// platformRole and firmRole come ONLY from /api/me. The session email is
// display-only and must not drive role, permission, owner detection, identity
// matching, or team lookup.
function mapMeDtoToUi(me: MeDTO, sessionEmail: string): TeamMember {
  const role = firmRoleCodeToUi(me.firmRole);
  return {
    id: me.firmMemberId,
    userId: me.userId,
    name: me.name,
    email: sessionEmail,
    firmRole: role,
    role,
    platformRole: platformRoleCodeToUi(me.platformRole),
    lastActive: "Active",
    isActive: true,
  };
}

// Section 14 Step 5B-final (F1): normalise the server firm status string to the
// FirmProfile UI union. Defaults to "Active" for any unrecognised value.
function normalizeFirmStatus(raw: string | null | undefined): FirmProfile["status"] {
  switch ((raw ?? "").toUpperCase()) {
    case "TRIAL": return "Trial";
    case "PAUSED": return "Paused";
    default: return "Active";
  }
}

// Section 14 Step 5B-final (F1): map the optional active-firm display fields from
// GET /api/me into the FirmProfile UI shape. Server is the source of truth; falls
// back to neutral display values (never demo data) when a field is absent.
function mapMeFirmToProfile(me: MeDTO): FirmProfile {
  return {
    id: me.firmId,
    name: me.firmName ?? "PracticeIQ Workspace",
    status: normalizeFirmStatus(me.firmStatus),
    city: me.firmCity ?? "",
    plan: me.firmPlan ?? "",
    emailDomain: me.firmEmailDomain ?? "",
  };
}

// Controlled, explicit error messaging for the team read (no silent fallback).
function teamErrorMessage(error: ApiError): string {
  switch (error.kind) {
    case "session": return "Your session has expired. Please sign in again.";
    case "authorization": return "You do not have access to the team list.";
    case "db_unavailable": return "The team list is temporarily unavailable. Please retry shortly.";
    default: return "Could not load the team. Please retry.";
  }
}

// Controlled messaging when /api/me cannot resolve the current user's identity.
function identityErrorMessage(error: ApiError): string {
  switch (error.kind) {
    case "db_unavailable": return "We could not reach the server to confirm your profile. Please retry shortly.";
    case "authorization": return "Your account does not have access to this workspace.";
    default: return "We could not confirm your profile. Please sign in again.";
  }
}

// Controlled, explicit error messaging for the clients read (no silent fallback).
function clientsErrorMessage(error: ApiError): string {
  switch (error.kind) {
    case "session":
      return "Your session has expired. Please sign in again.";
    case "authorization":
      return "You do not have access to clients.";
    case "db_unavailable":
      return "Clients are temporarily unavailable. Please retry shortly.";
    default:
      return "Could not load clients. Please retry.";
  }
}

// Controlled, explicit error messaging for the client create write (no silent failure).
function clientCreateErrorMessage(error: ApiError): string {
  switch (error.kind) {
    case "session":
      return "Your session has expired. Please sign in again.";
    case "authorization":
      return "You do not have permission to add clients.";
    case "validation":
      return error.message || "Please check the client details and try again.";
    case "db_unavailable":
      return "Clients are temporarily unavailable. Please try again shortly.";
    default:
      return "Could not add the client. Please try again.";
  }
}

// Section 14 Step 5B-3b: controlled, explicit error messaging for team writes
// (add / role change / deactivate / reactivate). Surface the server message for
// validation/conflict so guardrails like "must keep one active FIRM_ADMIN" and
// "cannot deactivate yourself" reach the UI verbatim. No silent failure path.
type TeamWriteAction = "add" | "role" | "deactivate" | "reactivate" | "reset";
function teamWriteErrorMessage(action: TeamWriteAction, error: ApiError): string {
  // Section 14 Step 5B-3c-2: reset-specific messaging. Self-reset and
  // Platform-Owner-target are both backend 403s (authorization); distinguish by
  // the server message text. Inactive target is a 422 (validation).
  if (action === "reset") {
    switch (error.kind) {
      case "session":
        return "Your session has expired. Please sign in again.";
      case "authorization":
        return error.message && error.message.toLowerCase().includes("platform owner")
          ? "Platform Owner passwords are managed separately."
          : error.message && error.message.toLowerCase().includes("own password")
            ? "You can't reset your own password here."
            : "You do not have permission to reset this member's password.";
      case "validation":
        return "Reactivate this member before resetting their password.";
      case "not_found":
        return "This team member is no longer available. The list will refresh.";
      case "db_unavailable":
        return "Reset service temporarily unavailable. Try again shortly.";
      default:
        return "Could not send the password-reset email. Please try again.";
    }
  }
  const verb = action === "add"
    ? "add the team member"
    : action === "role"
      ? "change the role"
      : action === "deactivate"
        ? "deactivate the team member"
        : "reactivate the team member";
  switch (error.kind) {
    case "session":
      return "Your session has expired. Please sign in again.";
    case "authorization":
      return `You do not have permission to ${verb}.`;
    case "validation":
      return error.message || `Please check the details and try again.`;
    case "not_found":
      return "This team member is no longer available. The list will refresh.";
    case "db_unavailable":
      return "Team changes are temporarily unavailable. Please retry shortly.";
    default:
      return `Could not ${verb}. Please try again.`;
  }
}

const loginTips = [
  "Create the client first, then create the task. This keeps every action traceable till closure.",
  "Use Pending Client only when the next action is genuinely with the client.",
  "Move completed work to Under Review instead of Closed. The reviewer closes after checking.",
  "Add short progress notes whenever work is stuck. It reduces follow-up calls later.",
  "Keep task titles action-oriented, for example: Prepare GSTR-1 working for April.",
];

const navItems = [
  { id: "dashboard" as const, label: "Dashboard", icon: Gauge },
  { id: "projectReview" as const, label: "Project Review", icon: Gauge },
  { id: "assignments" as const, label: "Assignments", icon: LayoutGrid },
  { id: "tasks" as const, label: "Task Queue", icon: ClipboardList },
  { id: "clients" as const, label: "Clients", icon: Building2 },
  { id: "team" as const, label: "Team", icon: Users },
  { id: "reports" as const, label: "Reports", icon: BarChart3 },
  { id: "firmSetup" as const, label: "Firm Setup", icon: Settings },
  { id: "admin" as const, label: "Admin", icon: ShieldCheck },
];

const statusTone: Record<TaskStatus, string> = {
  Open: "border-slate-200 bg-slate-50 text-slate-700",
  "In Progress": "border-blue-200 bg-blue-50 text-blue-700",
  "Pending Client": "border-amber-200 bg-amber-50 text-amber-800",
  "Pending Internal": "border-orange-200 bg-orange-50 text-orange-800",
  "Under Review": "border-violet-200 bg-violet-50 text-violet-700",
  Closed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

const priorityTone: Record<Task["priority"], string> = {
  Low: "text-slate-500",
  Normal: "text-slate-700",
  High: "text-amber-700",
  Urgent: "text-red-700",
  Critical: "text-red-800",
};

export default function Home() {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [modal, setModal] = useState<Modal>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | TaskStatus>("All");
  // Section 14 Step 5B-final-F3: assignments are parked - no seed, no localStorage.
  const [assignmentList, setAssignmentList] = useState<Assignment[]>([]);
  // Post-5B-final first-paint fix: tasks load from GET /api/tasks; no demo seed (avoids a demo-data flash before the API resolves).
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<ApiError | null>(null);
  // Section 14 Step 5B-4d-1: people-update in-flight guard + controlled notice.
  const [peoplePendingTaskId, setPeoplePendingTaskId] = useState<string | null>(null);
  const [peopleNotice, setPeopleNotice] = useState<string | null>(null);
  // Post-5B-final first-paint fix: clients load from GET /api/clients; no demo seed.
  const [clientList, setClientList] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState<ApiError | null>(null);
  const [clientsNotice, setClientsNotice] = useState<string | null>(null);
  // Post-5B-final first-paint fix: team loads from GET /api/team; no demo seed (avoids the demo "Active Users" flash on the dashboard).
  const [teamList, setTeamList] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState<ApiError | null>(null);
  // Section 14 Step 5B-3b: write surfacing. On a write success but refetch
  // failure, or on a non-modal write error (role change / deactivate /
  // reactivate), set teamNotice; the TeamView panel renders it as a banner.
  const [teamNotice, setTeamNotice] = useState<string | null>(null);
  // Section 14 Step 5B-3c-2: id of the member whose password reset is in-flight;
  // disables that row's button and shows "Sending…" to prevent duplicate sends.
  const [resettingMemberId, setResettingMemberId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [identityError, setIdentityError] = useState<ApiError | "no_profile" | null>(null);
  // Section 14 Step 5B-final (F1): firm display is sourced from GET /api/me after
  // auth. Initialise to a neutral placeholder (NOT the demo seed) so no demo firm
  // name/domain can render before the server value loads.
  const [firmProfile, setFirmProfile] = useState<FirmProfile>({ id: "", name: "PracticeIQ Workspace", status: "Active", city: "", plan: "", emailDomain: "" });
  const [firmLoading, setFirmLoading] = useState(true);
  // Section 14 Step 5B-final-F2: the firm registry is derived from the active firm
  // (server-sourced via /api/me). No localStorage source-of-truth; multi-firm parked.
  const firmDirectory = useMemo<FirmProfile[]>(() => [firmProfile], [firmProfile]);
  // Section 14 Step 5B-5a: activity feed is the server ActivityLog only (GET /api/activity).
  // No local activity state, no seed, no localStorage source of truth.
  const [activityList, setActivityList] = useState<ActivityDTO[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<ApiError | null>(null);
  // Section 14 Step 5B-5b: modules load from GET /api/modules (API is source of truth).
  // No seed, no localStorage fallback after cutover.
  const [modules, setModules] = useState<ModuleFlag[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [modulesError, setModulesError] = useState<ApiError | null>(null);
  // In-flight guard: key of the module currently being toggled; null when idle.
  const [moduleTogglePending, setModuleTogglePending] = useState<string | null>(null);
  const [loginTip, setLoginTip] = useState(loginTips[0]);

  useEffect(() => {
    // Section 14 Step 5B-final-F3: no app state hydrates from localStorage anymore
    // (assignments was the last source-of-truth key). Clear the legacy keys AND the
    // workspaceStorageKey itself so existing browsers actively drop any stale
    // `{ assignments: ... }` payload. The export bridge still produces a manual JSON
    // backup on demand; it does not depend on this key.
    try {
      legacyStorageKeys.forEach((key) => window.localStorage.removeItem(key));
      window.localStorage.removeItem(workspaceStorageKey);
    } catch {
      // Ignore storage access errors (private mode etc.).
    }
  }, []);

  // Section 14 Step 5B-final-F3: the localStorage persist effect was removed - no
  // source-of-truth keys remain (assignments was the last). Reads/writes of app state
  // are entirely server-backed; only the on-demand export bridge serialises a backup.

  // Section 14 Step 5B-3a: resolve the current-user identity from GET /api/me
  // (server-authoritative platformRole + firmRole). No seed/email identity match.
  useEffect(() => {
    let active = true;
    getSupabaseBrowserClient()
      .auth.getUser()
      .then(async ({ data }) => {
        if (!active) return;
        const authedEmail = data.user?.email ? normalizeEmail(data.user.email) : null;
        if (!authedEmail) {
          // Signed out: no /api/me call; fall through to the login screen.
          setFirmLoading(false);
          setMeLoading(false);
          setSessionChecked(true);
          return;
        }
        try {
          const me = await meApi.get();
          if (!active) return;
          setCurrentUser(mapMeDtoToUi(me, authedEmail));
          setSessionUserId(me.firmMemberId);
          // Section 14 Step 5B-final (F1): active firm display from GET /api/me.
          setFirmProfile(mapMeFirmToProfile(me));
          setIdentityError(null);
        } catch (error: unknown) {
          if (!active) return;
          // Distinguish "no active workspace profile" (controlled state) from a
          // hard sign-out (treated as signed out). Never auto-sign-out / loop.
          if (error instanceof ApiError && error.status === 401) {
            setIdentityError(/profile/i.test(error.message) ? "no_profile" : null);
          } else {
            setIdentityError(error instanceof ApiError ? error : new ApiError("server", 0, "Unable to confirm your profile."));
          }
        } finally {
          if (active) {
            setFirmLoading(false);
            setMeLoading(false);
            setSessionChecked(true);
          }
        }
      })
      .catch(() => {
        if (active) {
          setFirmLoading(false);
          setMeLoading(false);
          setSessionChecked(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Section 14 Step 5B-1: clients read cutover. Load from GET /api/clients once a
  // session exists; map DB shape to UI shape. On failure show a controlled error
  // state - never fall back to seed/localStorage clients.
  useEffect(() => {
    if (!sessionUserId) return;
    let active = true;
    // clientsLoading is initialised to true (loading-by-default once a session
    // exists), so we do NOT set it synchronously here. State is updated only in
    // the async resolve/reject callbacks below.
    clientsApi
      .list()
      .then((result) => {
        if (!active) return;
        setClientList(result.items.map(mapClientDtoToUi));
        setClientsError(null);
        setClientsLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setClientsError(error instanceof ApiError ? error : new ApiError("server", 0, "Unable to load clients."));
        setClientsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionUserId]);

  // Section 14 Step 5B-3a: team read cutover. Load the firm team from
  // GET /api/team once a session/identity exists; map to the UI shape. On
  // failure show a controlled error - never fall back to seed/localStorage team.
  useEffect(() => {
    if (!sessionUserId) return;
    let active = true;
    teamApi
      .list()
      .then((result) => {
        if (!active) return;
        setTeamList(result.items.map(mapTeamDtoToUi));
        setTeamError(null);
        setTeamLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setTeamError(error instanceof ApiError ? error : new ApiError("server", 0, "Unable to load the team."));
        setTeamLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionUserId]);

  // Section 14 Step 5B-4a: tasks read cutover. Load from GET /api/tasks once a
  // session exists; map DB shape to UI shape. On failure show a controlled error
  // - never fall back to seed/localStorage tasks.
  useEffect(() => {
    if (!sessionUserId) return;
    let active = true;
    tasksApi
      .list()
      .then((result) => {
        if (!active) return;
        setTaskList(result.items.map(mapTaskDtoToUi));
        setTasksError(null);
        setTasksLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setTasksError(error instanceof ApiError ? error : new ApiError("server", 0, "Unable to load tasks."));
        setTasksLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionUserId]);

  // Section 14 Step 5B-5a: activity read cutover. The feed is the server ActivityLog
  // (GET /api/activity) only. Load once a session exists; on failure show a controlled
  // error - never fall back to seed/localStorage activity. Strict-Mode-safe via the
  // `active` cancellation guard (no state write after unmount / double-invoke).
  useEffect(() => {
    if (!sessionUserId) return;
    let active = true;
    // Section 14 Step 5B-5a: do not setState synchronously in the effect body
    // (react-hooks/set-state-in-effect). `activityLoading` initializes to true;
    // setActivityLoading(false) runs only in the async resolve/reject paths.
    activityApi
      .list()
      .then((result) => {
        if (!active) return;
        setActivityList(result.items);
        setActivityError(null);
        setActivityLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setActivityError(error instanceof ApiError ? error : new ApiError("server", 0, "Unable to load activity."));
        setActivityLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionUserId]);

  // Section 14 Step 5B-5b: modules read cutover. Reads from GET /api/modules once a
  // session exists. Maps API ModuleDTO to the existing ModuleFlag UI shape using
  // id: dto.key so downstream components need no structural changes.
  // Never falls back to seed/localStorage. Strict-Mode-safe via `active` guard.
  // modulesLoading initializes to true; setModulesLoading(false) runs only in the
  // async resolve/reject paths (no synchronous setState in effect body).
  useEffect(() => {
    if (!sessionUserId || !MODULES_READ_ENABLED) return;
    let active = true;
    modulesApi
      .list()
      .then((result) => {
        if (!active) return;
        setModules(result.items.map((dto) => ({
          id: dto.key,
          key: dto.key,
          name: dto.name,
          enabled: dto.isEnabled,
          visibility: dto.isEnabled ? "Visible" : "Hidden",
        })));
        setModulesError(null);
        setModulesLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setModulesError(error instanceof ApiError ? error : new ApiError("server", 0, "Unable to load modules."));
        setModulesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionUserId]);

  // Section 14 Step 5B-3a: the current user comes from /api/me (server-authoritative),
  // not from a teamList lookup by id/email.
  const user = currentUser;
  const selectedTask = taskList.find((task) => task.id === selectedTaskId) ?? null;
  const isPlatformOwner = user?.platformRole === "Platform Owner";
  const canCreateTask = Boolean(user && creatorRoles.includes(user.firmRole)) && TASK_CREATE_ENABLED;
  // Section 14 Step 5B-4d-1: coordination predicate for people updates (assignee
  // swap / reviewer change). Matches the row-select `canCoordinate` gate
  // (creator roles OR Platform Owner) and is independent of TASK_CREATE_ENABLED.
  // Backend (TASK_EDIT; ARTICLE_STAFF route 403) remains the final authority.
  const canCoordinateTasks = Boolean(user && (creatorRoles.includes(user.firmRole) || user.platformRole === "Platform Owner"));
  const allowedSections = user ? navItems.filter((item) => canAccessSection(user, item.id)) : [];
  const defaultSection = allowedSections[0]?.id ?? "dashboard";
  const currentSection = user && canAccessSection(user, activeSection) ? activeSection : defaultSection;

  const visibleTasks = useMemo(() => {
    if (!user) return [];
    return taskList.filter((task) => {
      const roleCanSeeFirm = isPlatformOwner || user.firmRole !== "Article/Staff";
      const staffCanSee = task.assigneeIds.includes(user.userId ?? "") || task.reviewerId === (user.userId ?? "");
      const text = [task.title, clientName(clientList, task.clientId), assignmentName(assignmentList, task.assignmentId), task.status].join(" ").toLowerCase();
      return (roleCanSeeFirm || staffCanSee) && text.includes(query.toLowerCase()) && (statusFilter === "All" || task.status === statusFilter);
    });
  }, [assignmentList, clientList, isPlatformOwner, query, statusFilter, taskList, user]);

  const stats = useMemo(() => ({
    overdue: visibleTasks.filter((task) => task.status !== "Closed" && task.dueDate < todayIso).length,
    dueToday: visibleTasks.filter((task) => task.status !== "Closed" && task.dueDate === todayIso).length,
    underReview: visibleTasks.filter((task) => task.status === "Under Review").length,
    closed: visibleTasks.filter((task) => task.status === "Closed").length,
  }), [visibleTasks]);

  // Section 14 Step 5B-4b: task CREATE cutover. Async values handler (mirrors
  // createClient/createMember): POST /api/tasks then refetch GET /api/tasks and
  // render the server result. No local task insert, no client-side log(), no
  // localStorage write. reviewerId/assigneeIds are PlatformUser userIds; priority
  // is mapped to the server code. assignmentId is not persisted by the API.
  async function createTask(values: { title: string; clientId: string; dueDate: string; priority: string; assigneeIds: string[]; reviewerId: string; description?: string }): Promise<{ ok: boolean; message?: string }> {
    if (!TASK_CREATE_ENABLED || !user || !canCreateTask) return { ok: false, message: "Task creation is not available." };
    if (!values.title || !values.clientId || !values.dueDate || !values.reviewerId || values.assigneeIds.length === 0) {
      return { ok: false, message: "Title, client, due date, reviewer, and at least one assignee are required." };
    }
    try {
      await tasksApi.create({
        title: values.title,
        clientId: values.clientId,
        reviewerId: values.reviewerId,
        assigneeIds: values.assigneeIds,
        dueDate: values.dueDate,
        priority: priorityUiToCode(values.priority),
        description: values.description,
      });
    } catch (error: unknown) {
      return { ok: false, message: error instanceof ApiError ? taskCreateErrorMessage(error) : "Could not create the task. Please try again." };
    }
    // Create succeeded server-side. Refetch so the API is the source of truth.
    try {
      const result = await tasksApi.list();
      setTaskList(result.items.map(mapTaskDtoToUi));
      setTasksError(null);
    } catch {
      // Created, but the refetch failed. Resolve ok to avoid a duplicate create on
      // re-submit; surface a controlled list-level message (reload to see the task).
      setTasksError(new ApiError("server", 0, "Task created, but the list could not refresh. Please reload."));
    }
    return { ok: true };
  }

  // Section 14 Step 5B-2: client create writes through POST /api/clients, then the
  // list refetches from the API (source of truth). The ClientModal manages its own
  // submit lifecycle and closes on { ok: true }. Returns a result; never mutates
  // local client state directly.
  async function createClient(values: { name: string; pan?: string; gstin?: string; email?: string; mobile?: string }): Promise<{ ok: boolean; message?: string }> {
    if (!CLIENT_WRITES_ENABLED) return { ok: false, message: "Client creation is not available." };
    if (!user) return { ok: false, message: "No active session. Please sign in again." };
    try {
      await clientsApi.create(values);
      // Section 14 Step 5B-5a: no local activity log. The server writes the CLIENT_CREATE
      // audit row, which the feed renders from GET /api/activity.
    } catch (error: unknown) {
      return { ok: false, message: error instanceof ApiError ? clientCreateErrorMessage(error) : "Unable to add client. Please try again." };
    }
    // Refresh from the API. Do NOT retry the create if the refetch fails (avoids a
    // duplicate); surface a controlled refresh hint instead.
    try {
      const result = await clientsApi.list();
      setClientList(result.items.map(mapClientDtoToUi));
      setClientsNotice(null);
    } catch {
      setClientsNotice("Client created, but the list could not refresh. Please reload the page.");
    }
    return { ok: true };
  }

  // Section 14 Step 5B-3b: team add writes through POST /api/team, then the
  // list refetches from the API (source of truth). The TeamModal manages its
  // own submit lifecycle and closes on { ok: true }. No optimistic UI; no
  // client-side ActivityLog (server already writes TEAM_MEMBER_ADD).
  async function createMember(values: { name: string; email: string; firmRole: FirmRole }): Promise<{ ok: boolean; message?: string }> {
    if (!TEAM_WRITES_ENABLED) return { ok: false, message: "Team writes are not available." };
    if (!user) return { ok: false, message: "No active session. Please sign in again." };
    try {
      await teamApi.create({
        name: values.name,
        email: normalizeEmail(values.email),
        firmRole: firmRoleUiToCode(values.firmRole),
      });
    } catch (error: unknown) {
      return { ok: false, message: error instanceof ApiError ? teamWriteErrorMessage("add", error) : "Could not add the team member. Please try again." };
    }
    // Refresh from the API. Do NOT retry the create if the refetch fails
    // (avoids duplicate); surface a controlled notice instead.
    try {
      const result = await teamApi.list();
      setTeamList(result.items.map(mapTeamDtoToUi));
      setTeamNotice(null);
    } catch {
      setTeamNotice("Team member added, but the list could not refresh. Please reload the page.");
    }
    return { ok: true };
  }

  function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !canCreateTask) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const clientId = String(form.get("clientId") || "");
    const ownerId = String(form.get("ownerId") || "");
    const reviewerId = String(form.get("reviewerId") || "");
    if (!name || !clientId || !ownerId || !reviewerId) return;
    const nextAssignment: Assignment = {
      id: "as_" + Date.now(),
      clientId,
      name,
      ownerId,
      reviewerId,
      period: textOrUndefined(form, "period"),
      dueDate: textOrUndefined(form, "dueDate"),
      status: "Active",
    };
    setAssignmentList((current) => [nextAssignment, ...current]);
    // Section 14 Step 5B-5a: no local activity log. Assignments are a local-only
    // domain (no API yet), so assignment creation will not appear in the server
    // activity feed until that domain is cut over.
    setModal(null);
    setActiveSection("assignments");
  }

  function canManageMember(target: TeamMember) {
    return Boolean(user && canManageUser(user, target));
  }

  // Section 14 Step 5B-3b: deactivate / reactivate write through POST
  // /api/team/[id]/deactivate or .../reactivate, then refetch. No optimistic
  // UI. The server writes the ActivityLog row (TEAM_MEMBER_DEACTIVATE /
  // TEAM_MEMBER_REACTIVATE) - the client does not.
  async function setMemberActive(memberId: string, isActive: boolean): Promise<void> {
    if (!TEAM_WRITES_ENABLED || !user) return;
    const target = teamList.find((member) => member.id === memberId);
    if (!target || !canManageMember(target)) return;
    try {
      if (isActive) {
        // Section 14 Step 5B-3b defect fix: the server requires `reason: string`.
        // Supply a generic default string; a structured reason input is a 5B-3b+ UX
        // follow-up if/when product wants to capture per-toggle context.
        await teamApi.reactivate(memberId, "Reactivated via Team UI");
      } else {
        await teamApi.deactivate(memberId, "Deactivated via Team UI");
      }
    } catch (error: unknown) {
      setTeamNotice(error instanceof ApiError
        ? teamWriteErrorMessage(isActive ? "reactivate" : "deactivate", error)
        : `Could not ${isActive ? "reactivate" : "deactivate"} the team member. Please try again.`);
      return;
    }
    try {
      const result = await teamApi.list();
      setTeamList(result.items.map(mapTeamDtoToUi));
      setTeamNotice(null);
    } catch {
      setTeamNotice(`Team member ${isActive ? "reactivated" : "deactivated"}, but the list could not refresh. Please reload the page.`);
    }
  }

  // Section 14 Step 5B-3c-2: trigger an email-based password reset for a team
  // member via POST /api/team/[id]/password-reset (static reason). The in-flight
  // guard prevents duplicate sends; no team-list refetch (reset does not mutate
  // member rows). Self-reset and Platform-Owner-target are enforced by the
  // backend (403) and surfaced via teamWriteErrorMessage("reset", ...).
  async function resetMemberPassword(memberId: string) {
    if (!TEAM_PASSWORD_RESET_ENABLED || !user) return;
    if (resettingMemberId) return;
    const target = teamList.find((member) => member.id === memberId);
    if (!target || !canManageMember(target)) return;
    setResettingMemberId(memberId);
    try {
      await teamApi.resetPassword(memberId, "Password reset via Team UI");
      setTeamNotice("Password-reset email sent to this team member.");
    } catch (error: unknown) {
      setTeamNotice(error instanceof ApiError
        ? teamWriteErrorMessage("reset", error)
        : "Could not send the password-reset email. Please try again.");
    } finally {
      setResettingMemberId(null);
    }
  }

  // Section 14 Step 5B-3b: role change writes through PATCH /api/team/[id]
  // with the API-shape firmRole code, then refetches. The controlled <select>
  // is bound to member.firmRole so a failed write snaps the visual back to the
  // server-confirmed value without an explicit revert. The server writes the
  // ActivityLog row (TEAM_MEMBER_ROLE_CHANGE) - the client does not.
  async function updateMemberRole(memberId: string, firmRole: FirmRole): Promise<void> {
    if (!TEAM_WRITES_ENABLED || !user) return;
    const target = teamList.find((member) => member.id === memberId);
    if (!target || !canManageMember(target)) return;
    try {
      await teamApi.update(memberId, { firmRole: firmRoleUiToCode(firmRole) });
    } catch (error: unknown) {
      setTeamNotice(error instanceof ApiError ? teamWriteErrorMessage("role", error) : "Could not change the role. Please try again.");
      return;
    }
    try {
      const result = await teamApi.list();
      setTeamList(result.items.map(mapTeamDtoToUi));
      setTeamNotice(null);
    } catch {
      setTeamNotice("Role updated, but the list could not refresh. Please reload the page.");
    }
  }

  // Section 14 Step 5B-4d-2b: standalone note add cuts over to the API. POST
  // /api/tasks/[id]/notes only; the drawer refetches notes from the API on
  // success (source of truth). No local task mutation, no log(), no localStorage,
  // no local echo. Backend (TASK_ADD_NOTE; ARTICLE_STAFF own/assigned) is final
  // authority.
  async function addNote(taskId: string, text: string): Promise<{ ok: boolean; message?: string }> {
    if (!TASK_NOTES_ENABLED || !user) return { ok: false, message: "Notes are not available." };
    const trimmed = text.trim();
    if (!trimmed) return { ok: false, message: "Note cannot be empty." };
    try {
      await tasksApi.addNote(taskId, trimmed);
    } catch (error: unknown) {
      return { ok: false, message: error instanceof ApiError ? taskLifecycleErrorMessage(error) : "Could not add the note. Please try again." };
    }
    return { ok: true };
  }

  // Section 14 Step 5B-4c: shared post-lifecycle refetch. The mutation already
  // succeeded server-side; refetch so the API is the source of truth. A refetch
  // failure resolves ok (avoids duplicate mutation on re-click) with a controlled
  // list-level message.
  async function refetchTasksAfterLifecycle(): Promise<{ ok: boolean; message?: string }> {
    try {
      const result = await tasksApi.list();
      setTaskList(result.items.map(mapTaskDtoToUi));
      setTasksError(null);
    } catch {
      setTasksError(new ApiError("server", 0, "Task updated, but the list could not refresh. Please reload."));
    }
    return { ok: true };
  }

  // Section 14 Step 5B-4c-1: status move + close cut over to the API (source of
  // truth). Non-terminal moves -> PATCH /api/tasks/[id] (with a progress note);
  // Closed -> POST /api/tasks/[id]/close (user-entered remarks). On success the
  // list refetches from the API. No local setTaskList mutation as source of truth,
  // no log(), no localStorage write. Reopen and cancel are dedicated actions
  // (5B-4c-2 below), not status-matrix moves through this function.
  async function moveTask(taskId: string, nextStatus: TaskStatus, remarks?: string): Promise<{ ok: boolean; message?: string }> {
    if (!TASK_LIFECYCLE_ENABLED || !user) return { ok: false, message: "Task workflow is not available." };
    if (nextStatus === "Cancelled") return { ok: false, message: "Cancel runs through its dedicated action." };
    const before = taskList.find((task) => task.id === taskId);
    if (!before || before.status === nextStatus) return { ok: false, message: "No status change to apply." };
    try {
      if (nextStatus === "Closed") {
        const trimmed = (remarks ?? "").trim();
        if (!trimmed) return { ok: false, message: "Closure remarks are required." };
        await tasksApi.close(taskId, trimmed);
      } else {
        await tasksApi.update(taskId, { status: statusUiToCode(nextStatus), note: "Status update via Task UI" });
      }
    } catch (error: unknown) {
      return { ok: false, message: error instanceof ApiError ? taskLifecycleErrorMessage(error) : "Could not update the task. Please try again." };
    }
    return refetchTasksAfterLifecycle();
  }

  // Section 14 Step 5B-4c-2: reopen + cancel are dedicated lifecycle actions (not
  // normal status-matrix moves). Both routes Zod-require a non-empty user-entered
  // reason. On success the list refetches from the API (source of truth). No local
  // task mutation, no log(), no localStorage write. The backend permission matrix
  // (TASK_REOPEN / TASK_CANCEL) remains the final authority.
  async function reopenTask(taskId: string, reason: string): Promise<{ ok: boolean; message?: string }> {
    if (!TASK_LIFECYCLE_ENABLED || !user) return { ok: false, message: "Task workflow is not available." };
    const trimmed = reason.trim();
    if (!trimmed) return { ok: false, message: "Reopen reason is required." };
    try {
      await tasksApi.reopen(taskId, trimmed);
    } catch (error: unknown) {
      return { ok: false, message: error instanceof ApiError ? taskLifecycleErrorMessage(error) : "Could not update the task. Please try again." };
    }
    return refetchTasksAfterLifecycle();
  }

  async function cancelTask(taskId: string, reason: string): Promise<{ ok: boolean; message?: string }> {
    if (!TASK_LIFECYCLE_ENABLED || !user) return { ok: false, message: "Task workflow is not available." };
    const trimmed = reason.trim();
    if (!trimmed) return { ok: false, message: "Cancellation reason is required." };
    try {
      await tasksApi.cancel(taskId, trimmed);
    } catch (error: unknown) {
      return { ok: false, message: error instanceof ApiError ? taskLifecycleErrorMessage(error) : "Could not update the task. Please try again." };
    }
    return refetchTasksAfterLifecycle();
  }

  // Section 14 Step 5B-4d-1: assignee swap cut over to the API (source of
  // truth). Single-assignee UI semantics preserved: the row select swaps
  // assigneeIds[0] via set-semantics PATCH /api/tasks/[id]/assignees
  // `{ add: [new], remove: [old] }` (min-one-assignee rule holds naturally).
  // On success the list refetches from the API. No local task mutation, no
  // log(), no localStorage write. Terminal statuses are fail-closed in the UI;
  // the backend permission matrix (TASK_EDIT; ARTICLE_STAFF route-layer 403)
  // remains the final authority.
  async function reassignTask(taskId: string, assigneeId: string) {
    if (!TASK_PEOPLE_ENABLED || !user || !canCoordinateTasks || !assigneeId || peoplePendingTaskId) return;
    const target = taskList.find((task) => task.id === taskId);
    const assignee = teamList.find((member) => member.userId === assigneeId && member.isActive);
    if (!target || !assignee) return;
    if (target.status === "Closed" || target.status === "Cancelled") return;
    const current = target.assigneeIds[0];
    if (current === assigneeId) return;
    setPeoplePendingTaskId(taskId);
    setPeopleNotice(null);
    try {
      await tasksApi.setAssignees(taskId, { add: [assigneeId], ...(current ? { remove: [current] } : {}) });
      await refetchTasksAfterLifecycle();
    } catch (error: unknown) {
      setPeopleNotice(error instanceof ApiError ? taskLifecycleErrorMessage(error) : "Could not update the assignee. Please try again.");
    } finally {
      setPeoplePendingTaskId(null);
    }
  }

  // Section 14 Step 5B-4d-1: reviewer change cut over to the API via
  // PATCH /api/tasks/[id] { reviewerId } (server validates the reviewer is an
  // active firm member and audits TASK_REVIEWER_CHANGE). Same refetch /
  // fail-closed / no-local-mutation rules as reassignTask.
  async function updateReviewer(taskId: string, reviewerId: string) {
    if (!TASK_PEOPLE_ENABLED || !user || !canCoordinateTasks || !reviewerId || peoplePendingTaskId) return;
    const target = taskList.find((task) => task.id === taskId);
    const reviewer = teamList.find((member) => member.userId === reviewerId && member.isActive);
    if (!target || !reviewer) return;
    if (target.status === "Closed" || target.status === "Cancelled") return;
    if (target.reviewerId === reviewerId) return;
    setPeoplePendingTaskId(taskId);
    setPeopleNotice(null);
    try {
      await tasksApi.update(taskId, { reviewerId });
      await refetchTasksAfterLifecycle();
    } catch (error: unknown) {
      setPeopleNotice(error instanceof ApiError ? taskLifecycleErrorMessage(error) : "Could not update the reviewer. Please try again.");
    } finally {
      setPeoplePendingTaskId(null);
    }
  }

  // Section 14 Step 5B-4e: manual task resequence (Up/Down) removed. It was a
  // permanently-disabled, local-only no-op with no backend API; ordering still
  // uses taskSequence() (default sort fallback). A real resequence API is
  // deferred (recorded in DECISION_LOG during the 5B-4e doc-sync).

  // Section 14 Step 5B-5b: async server toggle. PLATFORM_OWNER only; gated by
  // MODULE_TOGGLE_ENABLED. moduleId === dto.key (mapped via id: dto.key at read time).
  // In-flight guard prevents double-toggles. On success: refetch GET /api/modules and
  // remap to ModuleFlag shape (server is source of truth; no local optimistic mutation).
  // The server emits a MODULE_ACCESS_CHANGE audit row (fail-open) on each PATCH.
  async function toggleModule(moduleId: string) {
    if (!user || !isPlatformOwner || !MODULE_TOGGLE_ENABLED) return;
    const target = modules.find((m) => m.id === moduleId);
    if (!target || moduleTogglePending !== null) return;
    setModuleTogglePending(moduleId);
    try {
      // setEnabled throws ApiError on failure — no .ok check needed.
      await modulesApi.setEnabled(target.key, !target.enabled);
      // Refetch the full list to keep the UI in sync with the server state.
      // list() also throws ApiError on failure.
      const listResult = await modulesApi.list();
      setModules(listResult.items.map((dto) => ({
        id: dto.key,
        key: dto.key,
        name: dto.name,
        enabled: dto.isEnabled,
        visibility: dto.isEnabled ? "Visible" : "Hidden",
      })));
      setModulesError(null);
    } catch (error: unknown) {
      setModulesError(error instanceof ApiError ? error : new ApiError("server", 0, "Could not update module."));
    } finally {
      setModuleTogglePending(null);
    }
  }

  async function login(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);
    // Section 14 Step 5B-final (F1): the pre-login client-side email-domain gate was
    // removed. Authority is Supabase Auth + the /api/me fail-closed workspace mapping
    // below (an unmapped account is signed out and rejected).
    if (password.length < 8) return { ok: false, message: "Password must be at least 8 characters." };
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) return { ok: false, message: "Invalid email or password." };
    let me: MeDTO;
    try {
      me = await meApi.get();
    } catch (error: unknown) {
      await supabase.auth.signOut();
      if (error instanceof ApiError && error.status === 401 && /profile/i.test(error.message)) {
        return { ok: false, message: "Signed in, but no active workspace profile is mapped to this account." };
      }
      return { ok: false, message: "Signed in, but we could not confirm your profile. Please try again." };
    }
    setCurrentUser(mapMeDtoToUi(me, normalizedEmail));
    setSessionUserId(me.firmMemberId);
    // Section 14 Step 5B-final (F1): active firm display from GET /api/me.
    setFirmProfile(mapMeFirmToProfile(me));
    setFirmLoading(false);
    setIdentityError(null);
    setMeLoading(false);
    setActiveSection("dashboard");
    setSelectedTaskId(null);
    setModal(null);
    setLoginTip(loginTips[Math.floor(Math.random() * loginTips.length)]);
    return { ok: true };
  }

  function logout() {
    void getSupabaseBrowserClient().auth.signOut();
    setSessionUserId(null);
    setCurrentUser(null);
    setIdentityError(null);
    setMeLoading(false);
    setActiveSection("dashboard");
    setSelectedTaskId(null);
    setModal(null);
  }

  // Section 14 Step 5B-0: safety export bridge. Serialises ONLY the PracticeIQ
  // workspace structures (never the whole localStorage; no Supabase/auth/session
  // keys). Lets the operator download a backup before the 5B source-of-truth
  // cutover. Read-only: does not mutate state or localStorage.
  function exportWorkspace() {
    const payload = {
      app: "PracticeIQ",
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      workspaceStorageKey,
      workspace: {
        assignments: assignmentList,
        tasks: taskList,
        clients: clientList,
        team: teamList,
        firm: firmProfile,
        firms: firmDirectory,
        activity: activityList,
        modules,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `practiceiq-workspace-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  if (!sessionChecked || meLoading) return <SessionLoading />;
  if (!user) {
    if (identityError) return <IdentityIssue error={identityError} onSignOut={logout} />;
    return <LoginScreen onLogin={login} />;
  }

  const memberActions: MemberActions = { resetPassword: resetMemberPassword, resettingId: resettingMemberId, setActive: setMemberActive, updateRole: updateMemberRole };
  const workMapActions: WorkMapActions = { reassignTask, updateReviewer, peoplePendingTaskId };

  return (
    <main className="min-h-screen overflow-x-hidden text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar active={currentSection} firm={firmProfile} firmLoading={firmLoading} nav={allowedSections} setActive={setActiveSection} user={user} />
        <section className="flex min-w-0 flex-1 flex-col">
          <Header active={currentSection} canCreateTask={canCreateTask} firm={firmProfile} nav={allowedSections} open={setModal} setActive={setActiveSection} user={user} logout={logout} exportWorkspace={exportWorkspace} />
          <div className="p-4 md:p-6">
            <GuidanceNote title="Tip for effective usage" text={loginTip} />
            {currentSection === "dashboard" && ((clientsLoading || tasksLoading || teamLoading || modulesLoading)
              ? <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading workspace…</div>
              : <RoleDashboardView assignments={assignmentList} clients={clientList} modules={modules} openAssignment={() => setModal("assignment")} openTask={setSelectedTaskId} setActive={setActiveSection} tasks={taskList} team={teamList} user={user} />)}
            {currentSection === "tasks" && (tasksLoading
              ? <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading tasks…</div>
              : tasksError
                ? <div className="rounded-lg border border-red-300/40 bg-red-50 p-4 text-sm text-red-800" role="alert">Could not load tasks. Please retry.</div>
                : <TasksView assignments={assignmentList} stats={stats} tasks={visibleTasks} allTasks={taskList} clients={clientList} team={teamList} query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} view={viewMode} setView={setViewMode} openTask={setSelectedTaskId} user={user} />)}
            {peopleNotice && (currentSection === "assignments" || currentSection === "projectReview") && <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-800" role="alert">{peopleNotice}</div>}
            {currentSection === "assignments" && <AssignmentsView actions={workMapActions} assignments={assignmentList} clients={clientList} openAssignment={() => setModal("assignment")} openClient={CLIENT_WRITES_ENABLED ? () => setModal("client") : () => {}} openTask={setSelectedTaskId} tasks={taskList} team={teamList} user={user} />}
            {currentSection === "projectReview" && <ProjectReviewView actions={workMapActions} assignments={assignmentList} clients={clientList} openAssignment={() => setModal("assignment")} openTask={setSelectedTaskId} tasks={taskList} team={teamList} user={user} />}
            {currentSection === "clients" && <ClientsView assignments={assignmentList} clients={clientList} tasks={taskList} loading={clientsLoading} error={clientsError} notice={clientsNotice} open={CLIENT_WRITES_ENABLED ? () => setModal("client") : () => {}} />}
            {currentSection === "team" && <TeamView actions={memberActions} team={teamList} user={user} open={TEAM_WRITES_ENABLED ? () => setModal("team") : () => {}} loading={teamLoading} error={teamError} notice={teamNotice} />}
            {currentSection === "reports" && <ReportsView tasks={taskList} clients={clientList} team={teamList} />}
            {currentSection === "firmSetup" && <FirmSetupView
              currentFirm={firmProfile}
              firms={firmDirectory}
              user={user}
            />}
            {currentSection === "admin" && <AdminView actions={memberActions} user={user} tasks={taskList} clients={clientList} team={teamList} activity={activityList} activityLoading={activityLoading} activityError={activityError} modules={modules} modulesLoading={modulesLoading} modulesError={modulesError} moduleTogglePending={moduleTogglePending} toggleModule={toggleModule} openTeam={TEAM_WRITES_ENABLED ? () => setModal("team") : () => {}} firm={firmProfile} />}
          </div>
        </section>
      </div>
      {TASK_CREATE_ENABLED && modal === "task" && <TaskModal clients={clientList} team={teamList} close={() => setModal(null)} submit={createTask} />}
      {ASSIGNMENTS_ENABLED && modal === "assignment" && <AssignmentModal clients={clientList} close={() => setModal(null)} submit={createAssignment} team={teamList} />}
      {CLIENT_WRITES_ENABLED && modal === "client" && <ClientModal close={() => setModal(null)} submit={createClient} />}
      {TEAM_WRITES_ENABLED && modal === "team" && <TeamModal close={() => setModal(null)} submit={createMember} />}
      {selectedTask && <TaskDrawer key={selectedTask.id} assignments={assignmentList} task={selectedTask} team={teamList} clients={clientList} user={user} close={() => setSelectedTaskId(null)} addNote={addNote} moveTask={moveTask} reopenTask={reopenTask} cancelTask={cancelTask} />}
    </main>
  );
}

function SessionLoading() {
  return <main className="font-login flex min-h-screen items-center justify-center bg-[#1e1f24] p-4 text-slate-100">
    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/80">Checking secure session...</p>
  </main>;
}

// Section 14 Step 5B-3a: shown when a session exists but /api/me cannot resolve an
// active workspace profile (or a transient identity error). Manual sign-out only;
// never auto-signs-out or loops.
function IdentityIssue({ error, onSignOut }: { error: ApiError | "no_profile"; onSignOut: () => void }) {
  const message = error === "no_profile"
    ? "No active team profile found for this account."
    : identityErrorMessage(error);
  return <main className="font-login flex min-h-screen flex-col items-center justify-center gap-4 bg-[#1e1f24] p-4 text-slate-100">
    <p className="max-w-sm text-center text-sm text-slate-200">{message}</p>
    <button className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-200" onClick={onSignOut} type="button">Sign out</button>
  </main>;
}

function LoginScreen({ onLogin }: { onLogin: (email: string, password: string) => Promise<{ ok: boolean; message?: string }> }) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dailyTip = loginTips[new Date().getDate() % loginTips.length];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    setError("");
    setIsSubmitting(true);
    try {
      const result = await onLogin(email, password);
      if (!result.ok) setError(result.message ?? "Unable to sign in.");
    } catch {
      setError("Unable to verify access. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="font-login flex min-h-screen items-center justify-center bg-[#1e1f24] p-4 text-slate-100">
    <section className="grid w-full max-w-6xl overflow-hidden rounded-xl border border-amber-200/15 bg-[#2a2c33] shadow-2xl shadow-black/50 md:grid-cols-[1.08fr_0.92fr]">
      <div className="relative overflow-hidden bg-[#24262d] p-8 text-white md:p-12">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200/20 bg-white/5 p-3 shadow-lg shadow-black/20 sm:flex-row sm:items-center" title="PracticeIQ">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-amber-300 font-serif text-xl font-bold text-slate-950 shadow-md shadow-amber-950/20">PIQ</div>
          <div className="min-w-0">
            <p className="font-serif text-2xl font-semibold leading-tight text-amber-100 md:text-4xl">PracticeIQ</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">Clarity. Control. Closure. Confidence.</p>
          </div>
        </div>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/80">Secure cloud workspace</p>
        <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-tight md:text-5xl">Disciplined task tracking for a modern CA firm.</h1>
        <p className="mt-5 max-w-xl text-sm leading-6 text-slate-300">Create work, assign responsibility, move it through review, and close with a clear record. The workspace starts simple and grows only when the firm is ready.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3"><Mini label="Work" value="Tasks" /><Mini label="Review" value="Closure" /><Mini label="Control" value="Admin" /></div>
        <div className="mt-8 rounded-lg border border-amber-200/15 bg-white/5 p-4" title="A small practice tip is shown before each login to help the team build better work habits.">
          <p className="text-xs font-semibold uppercase text-amber-200/80">Today&apos;s effectiveness tip</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{dailyTip}</p>
        </div>
      </div>
      <form className="bg-[#2f3239] p-6 md:p-10" noValidate onSubmit={submit}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/80">Secure workspace access</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Sign in with work email</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">Use your registered work email ID and workspace password.</p>
        <label className="mt-6 block text-sm font-medium text-slate-200" title="Use the email ID registered in your workspace profile.">Email ID</label>
        <input className="mt-2 w-full rounded-lg border border-slate-500 bg-[#24262d] px-3 py-3 text-sm text-white outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-200/10" inputMode="email" name="email" placeholder="name@yourfirm.com" required title="Enter your registered work email ID" type="email" />
        <label className="mt-4 block text-sm font-medium text-slate-200" title="Use the password created for this workspace.">Password</label>
        <input className="mt-2 w-full rounded-lg border border-slate-500 bg-[#24262d] px-3 py-3 text-sm text-white outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-200/10" minLength={8} name="password" placeholder="Enter password" required title="Enter your workspace password" type="password" />
        {error && <div className="mt-4 rounded-lg border border-red-300/30 bg-red-500/10 p-3 text-sm leading-5 text-red-100" role="alert">{error}</div>}
        <p className="mt-5 rounded-lg border border-slate-600 bg-slate-950/25 p-3 text-xs leading-5 text-slate-300">Guidance: If this is your first sign-in, this password becomes your workspace password for this profile.</p>
        <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-950/20 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting} title="Enter PracticeIQ workspace" type="submit">{isSubmitting ? "Checking access..." : "Enter workspace"} <ShieldCheck size={18} /></button>
      </form>
    </section>
  </main>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-amber-200/15 bg-white/5 p-3" title={`${label}: ${value}`}><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-lg font-semibold text-white">{value}</p></div>;
}

function GuidanceNote({ text, title }: { text: string; title: string }) {
  return <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900" title="A practical usage tip to help the team work more consistently."><span className="font-semibold">{title}: </span>{text}</div>;
}

function DashKpi({ detail, label, tone, value }: { detail: string; label: string; tone: "amber" | "emerald" | "sky" | "violet"; value: string }) {
  const toneClass = tone === "amber"
    ? "from-amber-100 to-amber-50 text-amber-900"
    : tone === "emerald"
      ? "from-emerald-100 to-emerald-50 text-emerald-900"
      : tone === "sky"
        ? "from-sky-100 to-sky-50 text-sky-900"
        : "from-violet-100 to-violet-50 text-violet-900";
  return <article className={"rounded-xl border border-white/70 bg-gradient-to-br p-4 shadow-[0_10px_20px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(15,23,42,0.14)] " + toneClass}>
    <p className="text-xs font-semibold uppercase tracking-[0.14em]">{label}</p>
    <p className="mt-2 text-2xl font-semibold">{value}</p>
    <p className="mt-1 text-xs opacity-75">{detail}</p>
  </article>;
}

function DashTile({ dark = false, label, text, value }: { dark?: boolean; label: string; text: string; value: string }) {
  return <article className={(dark ? "border-white/15 bg-white/5 text-white" : "border-slate-100 bg-slate-50 text-slate-900") + " rounded-lg border p-3 transition hover:-translate-y-0.5 hover:shadow-[0_12px_22px_rgba(15,23,42,0.12)]"}>
    <p className={(dark ? "text-slate-300" : "text-slate-500") + " text-xs font-semibold uppercase tracking-[0.14em]"}>{label}</p>
    <p className="mt-2 text-2xl font-semibold">{value}</p>
    <p className={(dark ? "text-slate-300" : "text-slate-500") + " mt-1 text-xs"}>{text}</p>
  </article>;
}

function Sidebar({ active, firm, firmLoading, nav, setActive, user }: { active: Section; firm: FirmProfile; firmLoading: boolean; nav: typeof navItems; setActive: (section: Section) => void; user: TeamMember }) {
  return <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white/90 px-4 py-5 shadow-sm backdrop-blur lg:block">
    <div className="mb-6 flex items-center gap-3 px-2"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white"><ClipboardList size={21} /></div><div><p className="text-sm font-semibold text-slate-950">PracticeIQ</p><p className="text-xs text-slate-500">Practice orchestration platform</p></div></div>
    <nav className="space-y-1">{nav.map((item) => { const Icon = item.icon; return <button key={item.id} className={(active === item.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950") + " flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition"} onClick={() => setActive(item.id)} type="button"><Icon size={18} />{item.label}</button>; })}</nav>
    <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">Active firm</p><p className="mt-2 text-sm font-semibold text-slate-900">{firmLoading ? "PracticeIQ Workspace" : firm.name}</p><p className="mt-1 text-xs text-slate-500">{firmLoading ? "Workspace" : firm.plan ? `${firm.status} - ${firm.plan}` : firm.status}</p></div>
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3"><p className="text-xs font-semibold uppercase text-blue-700">Signed in</p><p className="mt-2 text-sm font-semibold text-blue-950">{user.name}</p><p className="mt-1 text-xs text-blue-700">{user.platformRole === "Platform Owner" ? "Platform Owner" : user.firmRole}</p></div>
  </aside>;
}

function Header({ active, canCreateTask, exportWorkspace, firm, logout, nav, open, setActive, user }: { active: Section; canCreateTask: boolean; exportWorkspace: () => void; firm: FirmProfile; logout: () => void; nav: typeof navItems; open: (modal: Modal) => void; setActive: (section: Section) => void; user: TeamMember }) {
  const title = nav.find((item) => item.id === active)?.label ?? "PracticeIQ";
  const nextModal: Modal = active === "clients" ? "client" : active === "team" ? "team" : active === "assignments" || active === "projectReview" || active === "dashboard" ? (ASSIGNMENTS_ENABLED ? "assignment" : null) : active === "firmSetup" ? null : "task";
  const canManageTeam = user.platformRole === "Platform Owner" || user.firmRole === "Firm Admin";
  const canUsePrimaryAction = active === "firmSetup"
    ? user.platformRole === "Platform Owner"
    : active === "team"
      ? TEAM_WRITES_ENABLED && canManageTeam
      : active === "clients"
        ? CLIENT_WRITES_ENABLED && canCreateTask
        : canCreateTask;
  const disabledReason = active === "clients" && !CLIENT_WRITES_ENABLED
    ? "Client creation moves to the database in the next step (5B-2); read-only in this build"
    : active === "team" && !TEAM_WRITES_ENABLED
      ? "Adding team members moves to the database in a later step; read-only in this build"
      : active === "team"
        ? "Only Platform Owner and Firm Admin can add users"
        : active === "firmSetup"
          ? "Only Platform Owner can register additional firms"
          : "Only Firm Admin, Partner, and Manager can create this record";
  const actionLabel = active === "clients"
    ? "Add Client"
    : active === "team"
      ? "Add User"
      : active === "assignments" || active === "projectReview" || active === "dashboard"
        ? "Add Assignment"
        : active === "firmSetup"
          ? "Add Firm"
          : "Create Task";
  return <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/86 px-4 py-3 backdrop-blur md:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-blue-700">{firm.name}</p><h1 className="text-xl font-semibold text-slate-950 md:text-2xl">{title}</h1></div><div className="flex flex-wrap items-center gap-2"><span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:inline-flex">{user.name}</span><button aria-label="Notifications prepared for reminder layer" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400" disabled title="Notifications will activate with email reminders" type="button"><Bell size={18} /></button>{nextModal ? <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" disabled={!canUsePrimaryAction} onClick={canUsePrimaryAction ? () => open(nextModal) : undefined} title={!canUsePrimaryAction ? disabledReason : undefined} type="button"><Plus size={18} />{actionLabel}</button> : null}<button aria-label="Export workspace backup (JSON)" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" onClick={exportWorkspace} title="Download a JSON backup of this workspace" type="button"><FileDown size={18} /></button><button aria-label="Log out" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" onClick={logout} type="button"><LogOut size={18} /></button></div></div><nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Mobile workspace navigation">{nav.map((item) => { const Icon = item.icon; return <button key={item.id} className={(active === item.id ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600") + " inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"} onClick={() => setActive(item.id)} type="button"><Icon size={16} />{item.label}</button>; })}</nav></header>;
}

function RoleDashboardView({ assignments, clients, modules, openAssignment, openTask, setActive, tasks, team, user }: { assignments: Assignment[]; clients: Client[]; modules: ModuleFlag[]; openAssignment: () => void; openTask: (id: string) => void; setActive: (section: Section) => void; tasks: Task[]; team: TeamMember[]; user: TeamMember }) {
  const overdue = tasks.filter((task) => task.status !== "Closed" && task.dueDate < todayIso).length;
  const underReview = tasks.filter((task) => task.status === "Under Review").length;
  const openCount = tasks.filter((task) => task.status !== "Closed").length;
  const closedCount = tasks.filter((task) => task.status === "Closed").length;
  const activeUsers = team.filter((member) => member.isActive).length;
  const activeAssignments = assignments.filter((assignment) => assignment.status === "Active").length;
  const enabledModules = modules.filter((module) => module.enabled).length;
  const canControl = user.platformRole === "Platform Owner" || user.firmRole === "Firm Admin" || user.firmRole === "Partner";
  const clientRows = clients.map((client) => {
    const clientAssignments = assignments.filter((assignment) => assignment.clientId === client.id);
    const clientTasks = tasks.filter((task) => task.clientId === client.id);
    const pending = clientTasks.filter((task) => task.status !== "Closed").length;
    const reviewed = clientTasks.filter((task) => task.status === "Under Review").length;
    return { client, clientAssignments, pending, reviewed };
  }).sort((a, b) => b.pending - a.pending);
  const partnerAssignments = assignments.map((assignment) => {
    const scoped = tasks.filter((task) => task.assignmentId === assignment.id);
    const pending = scoped.filter((task) => task.status !== "Closed").length;
    const risk = scoped.some((task) => task.status !== "Closed" && task.dueDate < todayIso);
    return { assignment, pending, risk, nextTask: scoped.find((task) => task.status !== "Closed") };
  }).sort((a, b) => Number(b.risk) - Number(a.risk) || b.pending - a.pending);
  const roleTitle = user.platformRole === "Platform Owner" ? "Platform Owner Command Dashboard" : user.firmRole === "Firm Admin" ? "Firm Admin Operations Dashboard" : user.firmRole === "Partner" ? "Partner Control Dashboard" : "Firm Dashboard";

  return <div className="space-y-5">
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">{roleTitle}</h2>
          <p className="mt-1 text-sm text-slate-500">Role-based control surface with client and task roll-up.</p>
        </div>
        <div className="flex items-center gap-2">
          {ASSIGNMENTS_ENABLED && <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setActive("projectReview")} type="button">Open Master Review</button>}
          {ASSIGNMENTS_ENABLED && canControl && <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(37,99,235,0.35)] hover:bg-blue-700" onClick={openAssignment} type="button">Add Assignment</button>}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashKpi label="Open tasks" value={String(openCount)} detail={`${overdue} overdue`} tone="amber" />
        <DashKpi label="Closed tasks" value={String(closedCount)} detail={`${underReview} under review`} tone="emerald" />
        <DashKpi label="Active assignments" value={String(activeAssignments)} detail={`${assignments.length} total`} tone="sky" />
        <DashKpi label="Active users" value={String(activeUsers)} detail={`${enabledModules}/${modules.length} modules enabled`} tone="violet" />
      </div>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-950">Client Master Dashboard</h3>
          <button className="text-sm font-semibold text-blue-700 hover:text-blue-800" onClick={() => setActive("clients")} type="button">Manage clients</button>
        </div>
        <div className="space-y-2">
          {clientRows.slice(0, 8).map((row) => <div key={row.client.id} className="grid grid-cols-[minmax(0,1fr)_120px_120px_120px] items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm">
            <div>
              <p className="font-semibold text-slate-900">{row.client.name}</p>
              <p className="text-xs text-slate-500">{row.clientAssignments.length} assignments</p>
            </div>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-center text-xs font-semibold text-amber-800">{row.pending} pending</span>
            <span className="rounded-full bg-violet-100 px-2 py-1 text-center text-xs font-semibold text-violet-800">{row.reviewed} review</span>
            {ASSIGNMENTS_ENABLED && <button className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100" onClick={() => setActive("projectReview")} type="button">Open</button>}
          </div>)}
        </div>
      </div>

      {ASSIGNMENTS_ENABLED && <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-slate-950">Assignment Control Board</h3>
        <p className="mt-1 text-xs text-slate-500">Priority-sorted by risk and pending load.</p>
        <div className="mt-3 space-y-2">
          {partnerAssignments.slice(0, 8).map((row) => <div key={row.assignment.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{row.assignment.name}</p>
              <span className={(row.risk ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700") + " rounded-full px-2 py-0.5 text-xs font-semibold"}>{row.risk ? "Risk" : "On track"}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{clientName(clients, row.assignment.clientId)} · {row.pending} pending tasks</p>
            <div className="mt-2 flex gap-2">
              <button className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100" onClick={() => setActive("projectReview")} type="button">Review</button>
              {row.nextTask && <button className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100" onClick={() => openTask(row.nextTask!.id)} type="button">Open task</button>}
            </div>
          </div>)}
        </div>
      </div>}
    </section>

    {user.firmRole === "Firm Admin" && <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-950">Firm Admin Controls</h3>
        <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100" onClick={() => setActive("team")} type="button">Manage team</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <DashTile label="Access alerts" value={String(team.filter((member) => !member.isActive).length)} text="Inactive accounts to review" />
        <DashTile label="Review queue" value={String(underReview)} text="Tasks waiting for reviewer closure" />
        <DashTile label="Client coverage" value={`${clients.length}`} text="Active clients mapped to team capacity" />
      </div>
    </section>}

    {user.platformRole === "Platform Owner" && <section className="rounded-xl border border-slate-200 bg-slate-950 p-4 text-white shadow-[0_12px_28px_rgba(15,23,42,0.4)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Platform Owner Compact Console</h3>
        <button className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20" onClick={() => setActive("admin")} type="button">Open full admin</button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <DashTile dark label="Module visibility" value={`${enabledModules}/${modules.length}`} text="Feature activation authority is centralized." />
        <DashTile dark label="Risk ledger" value={`${overdue}`} text="Overdue items requiring partner/admin intervention." />
        <DashTile dark label="Governance scope" value={`${team.length}`} text="Users across roles under owner control." />
      </div>
    </section>}
  </div>;
}

function TasksView({ allTasks, assignments, clients, openTask, query, setQuery, setStatusFilter, setView, stats, statusFilter, tasks, team, user, view }: { allTasks: Task[]; assignments: Assignment[]; clients: Client[]; openTask: (id: string) => void; query: string; setQuery: (value: string) => void; setStatusFilter: (value: "All" | TaskStatus) => void; setView: (value: ViewMode) => void; stats: { overdue: number; dueToday: number; underReview: number; closed: number }; statusFilter: "All" | TaskStatus; tasks: Task[]; team: TeamMember[]; user: TeamMember; view: ViewMode }) {
  return <div className="space-y-5"><div className="grid gap-3 md:grid-cols-4"><Metric label="Overdue" value={stats.overdue} icon={AlertTriangle} tone="red" /><Metric label="Due today" value={stats.dueToday} icon={CalendarDays} tone="amber" /><Metric label="Under review" value={stats.underReview} icon={Eye} tone="violet" /><Metric label="Closed" value={stats.closed} icon={CheckCircle2} tone="emerald" /></div><div className="rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4"><div><h2 className="font-semibold text-slate-950">My task queue</h2><p className="text-sm text-slate-500">{user.firmRole === "Article/Staff" ? "Update assigned work and move it to review." : "Create, assign, review, and close work."}</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex min-w-64 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Search size={17} className="text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search task, client, assignment, or status" value={query} onChange={(event) => setQuery(event.target.value)} /></div><select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "All" | TaskStatus)}><option>All</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select><div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1"><button className={(view === "list" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600") + " inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium"} onClick={() => setView("list")} type="button"><List size={16} />List</button><button className={(view === "kanban" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600") + " inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium"} onClick={() => setView("kanban")} type="button"><LayoutGrid size={16} />Kanban</button></div></div></div>{view === "list" ? <TaskTable assignments={assignments} clients={clients} openTask={openTask} tasks={tasks} team={team} /> : <Kanban assignments={assignments} clients={clients} openTask={openTask} tasks={allTasks} team={team} />}</div></div>;
}

function Metric({ icon: Icon, label, tone, value }: { icon: typeof AlertTriangle; label: string; tone: "red" | "amber" | "violet" | "emerald"; value: number }) {
  const toneClass = { red: "bg-red-50 text-red-700 border-red-100", amber: "bg-amber-50 text-amber-700 border-amber-100", violet: "bg-violet-50 text-violet-700 border-violet-100", emerald: "bg-emerald-50 text-emerald-700 border-emerald-100" }[tone];
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className={toneClass + " inline-flex h-9 w-9 items-center justify-center rounded-lg border"}><Icon size={18} /></span></div><p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p></div>;
}

function TaskTable({ assignments, clients, openTask, tasks, team }: { assignments: Assignment[]; clients: Client[]; openTask: (id: string) => void; tasks: Task[]; team: TeamMember[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[1080px] border-collapse text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3 font-semibold" title="Task title entered by the creator.">Task</th><th className="px-4 py-3 font-semibold" title="Client linked to the task.">Client</th>{ASSIGNMENTS_ENABLED && <th className="px-4 py-3 font-semibold" title="Assignment stream this task rolls up into.">Assignment</th>}<th className="px-4 py-3 font-semibold" title="Current workflow stage.">Status</th><th className="px-4 py-3 font-semibold" title="Due date and urgency.">Due</th><th className="px-4 py-3 font-semibold" title="People responsible for doing the work.">Assignees</th><th className="px-4 py-3 font-semibold" title="Person responsible for review and closure.">Reviewer</th><th className="px-4 py-3 font-semibold" title="Priority selected by the creator.">Priority</th><th className="px-4 py-3 font-semibold" title="Open the task detail panel.">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{tasks.length === 0 && <tr><td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={ASSIGNMENTS_ENABLED ? 9 : 8}>No tasks yet. Add a client first, then create a task with only the required details.</td></tr>}{tasks.map((task) => { const due = dueState(task); return <tr key={task.id} className="hover:bg-slate-50/70" title="Open this task to update status, notes, and review closure."><td className="px-4 py-3 font-medium text-slate-950">{task.title}</td><td className="px-4 py-3 text-slate-600">{clientName(clients, task.clientId)}</td>{ASSIGNMENTS_ENABLED && <td className="px-4 py-3 text-slate-600">{assignmentName(assignments, task.assignmentId)}</td>}<td className="px-4 py-3"><StatusPill status={task.status} /></td><td className="px-4 py-3"><span className={due.tone + " font-medium"}>{due.label}</span><div className="text-xs text-slate-500">{task.dueDate}</div></td><td className="px-4 py-3 text-slate-600">{task.assigneeIds.map((id) => userNameByUserId(team, id)).join(", ")}</td><td className="px-4 py-3 text-slate-600">{userNameByUserId(team, task.reviewerId)}</td><td className={priorityTone[task.priority] + " px-4 py-3 font-semibold"}>{task.priority}</td><td className="px-4 py-3"><button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => openTask(task.id)} title="View task details and workflow actions" type="button">View</button></td></tr>; })}</tbody></table></div>;
}

function Kanban({ assignments, clients, openTask, tasks, team }: { assignments: Assignment[]; clients: Client[]; openTask: (id: string) => void; tasks: Task[]; team: TeamMember[] }) {
  return <div className="grid gap-3 overflow-x-auto p-4 lg:grid-cols-3 xl:grid-cols-6">{statuses.map((status) => <div key={status} className="min-h-72 rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-800">{status}</h3><span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">{tasks.filter((task) => task.status === status).length}</span></div><div className="space-y-2">{tasks.filter((task) => task.status === status).map((task) => <button key={task.id} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-blue-200 hover:bg-blue-50/40" onClick={() => openTask(task.id)} type="button"><p className="text-sm font-semibold text-slate-950">{task.title}</p><p className="mt-1 text-xs text-slate-500">{clientName(clients, task.clientId)}</p>{ASSIGNMENTS_ENABLED && <p className="mt-1 text-xs font-medium text-blue-700">{assignmentName(assignments, task.assignmentId)}</p>}<p className="mt-2 text-xs text-slate-500">{task.assigneeIds.map((id) => userNameByUserId(team, id)).join(", ")}</p><div className="mt-3 flex items-center justify-between text-xs"><span className={dueState(task).tone}>{dueState(task).label}</span><span className={priorityTone[task.priority]}>{task.priority}</span></div></button>)}</div></div>)}</div>;
}

function AssignmentsView({ actions, assignments, clients, openAssignment, openClient, openTask, tasks, team, user }: { actions: WorkMapActions; assignments: Assignment[]; clients: Client[]; openAssignment: () => void; openClient: () => void; openTask: (id: string) => void; tasks: Task[]; team: TeamMember[]; user: TeamMember }) {
  const firmWide = user.platformRole === "Platform Owner" || user.firmRole !== "Article/Staff";
  const canCoordinate = creatorRoles.includes(user.firmRole) || user.platformRole === "Platform Owner";
  const clientRows = clients.map((client) => {
    const clientTasks = tasks.filter((task) => task.clientId === client.id);
    const clientAssignments = assignments.filter((assignment) => assignment.clientId === client.id).filter((assignment) => firmWide || assignment.ownerId === user.id || assignment.reviewerId === user.id || clientTasks.some((task) => task.assignmentId === assignment.id && (task.assigneeIds.includes(user.userId ?? "") || task.reviewerId === (user.userId ?? ""))));
    const unmappedTasks = clientTasks.filter((task) => !task.assignmentId && (firmWide || task.assigneeIds.includes(user.userId ?? "") || task.reviewerId === (user.userId ?? "")));
    return { client, clientAssignments, unmappedTasks };
  }).filter((row) => firmWide || row.clientAssignments.length > 0 || row.unmappedTasks.length > 0);
  const totalAssignments = clientRows.reduce((sum, row) => sum + row.clientAssignments.length, 0);
  const allVisibleTasks = clientRows.flatMap((row) => [...row.clientAssignments.flatMap((assignment) => tasks.filter((task) => task.assignmentId === assignment.id)), ...row.unmappedTasks]);
  const closedCount = allVisibleTasks.filter((task) => task.status === "Closed").length;
  const overdueCount = allVisibleTasks.filter((task) => task.status !== "Closed" && task.dueDate < todayIso).length;

  return <div className="space-y-5">
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-slate-950">Client-wise assignment tree</h2><p className="text-sm leading-6 text-slate-500">Partner view: client to assignment to manager, reviewer, assignee, task status, and closure progress.</p></div>
        <div className="flex flex-wrap gap-2"><button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={openClient} title="Add a client before creating assignment streams" type="button">Add Client</button><button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={openAssignment} title="Create a client assignment stream" type="button">Add Assignment</button></div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4"><ReportPanel title="Clients" value={String(clientRows.length)} detail="Visible client groups" icon={Building2} /><ReportPanel title="Assignments" value={String(totalAssignments)} detail="Active workstreams" icon={LayoutGrid} /><ReportPanel title="Open tasks" value={String(allVisibleTasks.length - closedCount)} detail="Pending execution" icon={ClipboardList} /><ReportPanel title="Overdue" value={String(overdueCount)} detail="Needs partner attention" icon={AlertTriangle} /></div>
    </section>

    {clients.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Add a client first. Then create assignment streams such as return filing, audit closure, notice response, or monthly compliance.</div>}
    {clients.length > 0 && totalAssignments === 0 && allVisibleTasks.length === 0 && <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50 p-8 text-center text-sm text-blue-900">No assignment streams yet. Create the first assignment so tasks roll up cleanly for partner review.</div>}

    <div className="space-y-4">
      {clientRows.map(({ client, clientAssignments, unmappedTasks }) => <section key={client.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <details open>
          <summary className="cursor-pointer list-none border-b border-slate-100 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-blue-700">Client</p><h3 className="text-lg font-semibold text-slate-950">{client.name}</h3></div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">{clientAssignments.length} assignments</span><span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">{tasks.filter((task) => task.clientId === client.id && task.status !== "Closed").length} open tasks</span></div></div>
          </summary>
          <div className="space-y-3 p-4">
            {clientAssignments.map((assignment) => <AssignmentTreeItem key={assignment.id} actions={actions} assignment={assignment} canCoordinate={canCoordinate} openTask={openTask} tasks={tasks.filter((task) => task.assignmentId === assignment.id).sort((a, b) => taskSequence(a) - taskSequence(b))} team={team} />)}
            {unmappedTasks.length > 0 && <AssignmentTreeItem actions={actions} canCoordinate={canCoordinate} openTask={openTask} tasks={unmappedTasks.sort((a, b) => taskSequence(a) - taskSequence(b))} team={team} title="Unmapped tasks" />}
            {clientAssignments.length === 0 && unmappedTasks.length === 0 && <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No assignment or task activity for this client yet.</div>}
          </div>
        </details>
      </section>)}
    </div>
  </div>;
}

function AssignmentTreeItem({ actions, assignment, canCoordinate, openTask, tasks, team, title }: { actions: WorkMapActions; assignment?: Assignment; canCoordinate: boolean; openTask: (id: string) => void; tasks: Task[]; team: TeamMember[]; title?: string }) {
  const closed = tasks.filter((task) => task.status === "Closed").length;
  const open = tasks.length - closed;
  const overdue = tasks.filter((task) => task.status !== "Closed" && task.dueDate < todayIso).length;
  const progress = tasks.length ? Math.round((closed / tasks.length) * 100) : 0;
  return <details className="rounded-lg border border-slate-200 bg-slate-50" open title="Assignment stream with task roll-up">
    <summary className="cursor-pointer list-none p-4">
      <div className="grid gap-3 lg:grid-cols-[1.4fr_0.9fr_0.9fr_0.8fr] lg:items-center">
        <div><p className="text-sm font-semibold text-slate-950">{assignment?.name ?? title}</p><p className="mt-1 text-xs text-slate-500">{assignment?.period ?? "No period set"}{assignment?.dueDate ? " - Due " + assignment.dueDate : ""}</p></div>
        <div className="text-xs text-slate-600"><span className="font-semibold text-slate-800">Manager:</span> {assignment ? userName(team, assignment.ownerId) : "Not mapped"}</div>
        <div className="text-xs text-slate-600"><span className="font-semibold text-slate-800">Reviewer:</span> {assignment ? userName(team, assignment.reviewerId) : "Not mapped"}</div>
        <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700">{open} open</span><span className={(overdue ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700") + " rounded-full px-2.5 py-1 font-semibold"}>{overdue} overdue</span></div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-700" style={{ width: `${progress}%` }} /></div>
    </summary>
    <div className="border-t border-slate-200 bg-white p-3">
      {tasks.length === 0 && <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No tasks linked to this assignment yet.</div>}
      <div className="space-y-2">{tasks.map((task) => <div key={task.id} className="grid gap-2 rounded-lg border border-slate-100 bg-white p-3 text-sm md:grid-cols-[1.2fr_0.55fr_0.85fr_0.85fr_0.7fr] md:items-center" title="Task mapping row">
        <button className="text-left font-semibold text-slate-950 hover:text-blue-700" onClick={() => openTask(task.id)} type="button">{task.title}</button>
        <StatusPill status={task.status} />
        <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs disabled:bg-slate-50" disabled={!canCoordinate || !TASK_PEOPLE_ENABLED || actions.peoplePendingTaskId !== null || task.status === "Closed" || task.status === "Cancelled"} onChange={(event) => actions.reassignTask(task.id, event.target.value)} title="Reassign task owner" value={task.assigneeIds[0] ?? ""}>{team.filter((member) => member.isActive && member.firmRole !== "Firm Admin").map((member) => <option key={member.id} value={member.userId}>{member.name}</option>)}</select>
        <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs disabled:bg-slate-50" disabled={!canCoordinate || !TASK_PEOPLE_ENABLED || actions.peoplePendingTaskId !== null || task.status === "Closed" || task.status === "Cancelled"} onChange={(event) => actions.updateReviewer(task.id, event.target.value)} title="Change reviewer" value={task.reviewerId}>{team.filter((member) => member.isActive && member.firmRole !== "Article/Staff").map((member) => <option key={member.id} value={member.userId}>{member.name}</option>)}</select>
        <span className={dueState(task).tone + " text-xs font-semibold"}>{dueState(task).label} <span className="text-slate-400">{task.dueDate}</span></span>
      </div>)}</div>
    </div>
  </details>;
}

function ProjectReviewView({ actions, assignments, clients, openAssignment, openTask, tasks, team, user }: { actions: WorkMapActions; assignments: Assignment[]; clients: Client[]; openAssignment: () => void; openTask: (id: string) => void; tasks: Task[]; team: TeamMember[]; user: TeamMember }) {
  const [clientFilter, setClientFilter] = useState("All");
  const [personFilter, setPersonFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");
  const [sortMode, setSortMode] = useState("Risk first");
  const [search, setSearch] = useState("");
  const canCoordinate = creatorRoles.includes(user.firmRole) || user.platformRole === "Platform Owner";
  const firmWide = user.platformRole === "Platform Owner" || user.firmRole !== "Article/Staff";
  const visibleTasks = tasks.filter((task) => firmWide || task.assigneeIds.includes(user.userId ?? "") || task.reviewerId === (user.userId ?? ""));
  const myTasks = tasks.filter((task) => task.assigneeIds.includes(user.userId ?? "") || task.reviewerId === (user.userId ?? ""));
  const scopedAssignments = assignments.filter((assignment) => {
    const linkedTasks = visibleTasks.filter((task) => task.assignmentId === assignment.id);
    const text = [assignment.name, assignment.period, clientName(clients, assignment.clientId), userName(team, assignment.ownerId), userName(team, assignment.reviewerId)].join(" ").toLowerCase();
    const matchesClient = clientFilter === "All" || assignment.clientId === clientFilter;
    const matchesPerson = personFilter === "All" || assignment.ownerId === personFilter || assignment.reviewerId === personFilter || linkedTasks.some((task) => { const pid = team.find((m) => m.id === personFilter)?.userId ?? ""; return task.assigneeIds.includes(pid) || task.reviewerId === pid; });
    const matchesRisk = riskFilter === "All" || assignmentRisk(assignment, linkedTasks) === riskFilter;
    const matchesSearch = !search.trim() || text.includes(search.toLowerCase()) || linkedTasks.some((task) => task.title.toLowerCase().includes(search.toLowerCase()));
    return matchesClient && matchesPerson && matchesRisk && matchesSearch && (firmWide || linkedTasks.length > 0 || assignment.ownerId === user.id || assignment.reviewerId === user.id);
  }).sort((a, b) => sortAssignments(a, b, tasks, sortMode));
  const reviewTasks = scopedAssignments.flatMap((assignment) => visibleTasks.filter((task) => task.assignmentId === assignment.id));
  const closed = reviewTasks.filter((task) => task.status === "Closed").length;
  const overdue = reviewTasks.filter((task) => task.status !== "Closed" && task.dueDate < todayIso).length;
  const reviewQueue = reviewTasks.filter((task) => task.status === "Under Review").length;

  return <div className="space-y-5">
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase text-blue-700">Partner review cockpit</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Project accountability by client and assignment</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Review every project stream from the partner lens: objective, manager, reviewer, task sequence, assignee contribution, completion, and risk.</p></div>
        <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700" disabled={!canCoordinate} onClick={openAssignment} title="Create a new project assignment stream" type="button">Add Assignment</button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4"><ReportPanel title="Assignments" value={String(scopedAssignments.length)} detail="Visible project streams" icon={LayoutGrid} /><ReportPanel title="Open tasks" value={String(reviewTasks.length - closed)} detail="Still pending" icon={ClipboardList} /><ReportPanel title="Review queue" value={String(reviewQueue)} detail="Awaiting reviewer" icon={Eye} /><ReportPanel title="Overdue" value={String(overdue)} detail="Accountability focus" icon={AlertTriangle} /></div>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-slate-950">Review filters</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2"><Search size={16} className="text-slate-400" /><input className="min-w-0 flex-1 bg-transparent text-sm outline-none" onChange={(event) => setSearch(event.target.value)} placeholder="Search client, assignment, task, person" value={search} /></div>
          <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" onChange={(event) => setClientFilter(event.target.value)} value={clientFilter}><option value="All">All clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
          <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" onChange={(event) => setPersonFilter(event.target.value)} value={personFilter}><option value="All">All people</option>{team.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
          <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" onChange={(event) => setRiskFilter(event.target.value)} value={riskFilter}><option>All</option><option>At risk</option><option>Needs review</option><option>On track</option></select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><span className="text-slate-500">Sort:</span>{["Risk first", "Due first", "Progress low", "Client A-Z"].map((mode) => <button key={mode} className={(sortMode === mode ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600") + " rounded-lg border px-3 py-1.5 text-xs font-semibold"} onClick={() => setSortMode(mode)} type="button">{mode}</button>)}</div>
      </div>
      <ContributionPanel tasks={myTasks} team={team} user={user} />
    </section>

    <div className="space-y-4">
      {scopedAssignments.length === 0 && <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50 p-8 text-center text-sm text-blue-900">No matching project streams yet. Add a client, create an assignment, then add tasks under it to build the full project map.</div>}
      {scopedAssignments.map((assignment) => <ProjectReviewCard key={assignment.id} actions={actions} assignment={assignment} canCoordinate={canCoordinate} client={clients.find((client) => client.id === assignment.clientId)} openTask={openTask} tasks={visibleTasks.filter((task) => task.assignmentId === assignment.id).sort((a, b) => taskSequence(a) - taskSequence(b))} team={team} />)}
    </div>
  </div>;
}

function ContributionPanel({ tasks, team, user }: { tasks: Task[]; team: TeamMember[]; user: TeamMember }) {
  const underReview = tasks.filter((task) => task.status === "Under Review").length;
  const overdue = tasks.filter((task) => task.status !== "Closed" && task.dueDate < todayIso).length;
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <h3 className="font-semibold text-slate-950">My contribution map</h3>
    <p className="mt-1 text-sm leading-6 text-slate-500">Shows how your assigned or review work fits into project delivery.</p>
    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-lg bg-slate-50 p-3"><p className="text-lg font-semibold text-slate-950">{tasks.length}</p><p className="text-slate-500">Mapped</p></div><div className="rounded-lg bg-violet-50 p-3"><p className="text-lg font-semibold text-violet-700">{underReview}</p><p className="text-violet-600">Review</p></div><div className="rounded-lg bg-red-50 p-3"><p className="text-lg font-semibold text-red-700">{overdue}</p><p className="text-red-600">Overdue</p></div></div>
    <div className="mt-4 space-y-2">{tasks.slice(0, 4).map((task) => <div key={task.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs" title="Contribution item"><p className="font-semibold text-slate-950">{task.title}</p><p className="mt-1 text-slate-500">{task.assigneeIds.includes(user.userId ?? "") ? "Assignee" : "Reviewer"} - {task.status} - {userNameByUserId(team, task.reviewerId)}</p></div>)}{tasks.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No mapped work for your profile yet.</p>}</div>
  </div>;
}

function ProjectReviewCard({ actions, assignment, canCoordinate, client, openTask, tasks, team }: { actions: WorkMapActions; assignment: Assignment; canCoordinate: boolean; client?: Client; openTask: (id: string) => void; tasks: Task[]; team: TeamMember[] }) {
  const closed = tasks.filter((task) => task.status === "Closed").length;
  const progress = tasks.length ? Math.round((closed / tasks.length) * 100) : 0;
  const risk = assignmentRisk(assignment, tasks);
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 bg-slate-50 p-4">
      <div className="grid gap-3 xl:grid-cols-[1.35fr_0.7fr_0.7fr_0.55fr] xl:items-center">
        <div><p className="text-xs font-semibold uppercase text-blue-700">{client?.name ?? "Client not found"}</p><h3 className="mt-1 text-lg font-semibold text-slate-950">{assignment.name}</h3><p className="mt-1 text-xs text-slate-500">{assignment.period ?? "No period"}{assignment.dueDate ? " - Target " + assignment.dueDate : ""}</p></div>
        <Info label="Manager" value={userName(team, assignment.ownerId)} />
        <Info label="Reviewer" value={userName(team, assignment.reviewerId)} />
        <span className={riskTone(risk) + " inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold"}>{risk}</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-700" style={{ width: `${progress}%` }} /></div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500"><span>{progress}% complete</span><span>{tasks.length - closed} pending</span><span>{tasks.filter((task) => task.status === "Under Review").length} under review</span></div>
    </div>
    <div className="space-y-4 p-4">
      {statuses.map((status) => {
        const stageTasks = tasks.filter((task) => task.status === status);
        if (stageTasks.length === 0) return null;
        return <div key={status} className="rounded-lg border border-slate-100">
          <div className="flex items-center justify-between bg-slate-50 px-3 py-2"><StatusPill status={status} /><span className="text-xs font-semibold text-slate-500">{stageTasks.length} task{stageTasks.length === 1 ? "" : "s"}</span></div>
          <div className="space-y-2 p-3">{stageTasks.map((task) => <ProjectTaskRow key={task.id} actions={actions} canCoordinate={canCoordinate} openTask={openTask} task={task} team={team} />)}</div>
        </div>;
      })}
      {tasks.length === 0 && <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">No task breakdown yet. Add tasks under this assignment to make accountability visible.</div>}
    </div>
  </section>;
}

function ProjectTaskRow({ actions, canCoordinate, openTask, task, team }: { actions: WorkMapActions; canCoordinate: boolean; openTask: (id: string) => void; task: Task; team: TeamMember[] }) {
  const risk = taskRisk(task);
  return <div className="grid gap-2 rounded-lg border border-slate-100 bg-white p-3 text-sm md:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_0.55fr] md:items-center" title="Project task accountability row">
    <button className="text-left font-semibold text-slate-950 hover:text-blue-700" onClick={() => openTask(task.id)} type="button">{task.title}<span className="mt-1 block text-xs font-normal text-slate-500">{task.priority} priority</span></button>
    <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs disabled:bg-slate-50" disabled={!canCoordinate || !TASK_PEOPLE_ENABLED || actions.peoplePendingTaskId !== null || task.status === "Closed" || task.status === "Cancelled"} onChange={(event) => actions.reassignTask(task.id, event.target.value)} title="Reassign assignee" value={task.assigneeIds[0] ?? ""}>{team.filter((member) => member.isActive && member.firmRole !== "Firm Admin").map((member) => <option key={member.id} value={member.userId}>{member.name}</option>)}</select>
    <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs disabled:bg-slate-50" disabled={!canCoordinate || !TASK_PEOPLE_ENABLED || actions.peoplePendingTaskId !== null || task.status === "Closed" || task.status === "Cancelled"} onChange={(event) => actions.updateReviewer(task.id, event.target.value)} title="Change reviewer" value={task.reviewerId}>{team.filter((member) => member.isActive && member.firmRole !== "Article/Staff").map((member) => <option key={member.id} value={member.userId}>{member.name}</option>)}</select>
    <div><p className={dueState(task).tone + " text-xs font-semibold"}>{dueState(task).label}</p><p className="text-xs text-slate-500">{task.dueDate}</p></div>
    <div className="flex flex-wrap items-center gap-1"><span className={riskTone(risk) + " rounded-full px-2 py-1 text-xs font-semibold"}>{risk}</span></div>
  </div>;
}

function ClientsView({ assignments, clients, error, loading, notice, open, tasks }: { assignments: Assignment[]; clients: Client[]; error: ApiError | null; loading: boolean; notice: string | null; open: () => void; tasks: Task[] }) {
  return <Panel title="Client master" subtitle="Client name is required. PAN, GSTIN, email, and mobile stay optional." action="Add Client" actionDisabled={!CLIENT_WRITES_ENABLED} actionTitle="Add Client" onAction={open}>{notice && <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">{notice}</div>}{loading ? <div className="p-8 text-center text-sm text-slate-500">Loading clients...</div> : error ? <div className="p-8 text-center text-sm text-red-600" role="alert">{clientsErrorMessage(error)}</div> : <div className="divide-y divide-slate-100">{clients.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No clients yet. Use Add Client to create one.</div>}{clients.map((client) => <div key={client.id} className="grid gap-2 p-4 md:grid-cols-[1.2fr_0.7fr_0.7fr_0.8fr_1fr_0.7fr]" title="Client record with optional statutory and contact details."><div><p className="font-semibold text-slate-950">{client.name}</p><p className="text-xs text-slate-500">{tasks.filter((task) => task.clientId === client.id).length} linked tasks</p></div><p className="text-sm text-slate-600">{assignments.filter((assignment) => assignment.clientId === client.id).length} assignments</p><p className="text-sm text-slate-600">PAN: {client.pan ?? "Optional"}</p><p className="text-sm text-slate-600">GSTIN: {client.gstin ?? "Optional"}</p><p className="text-sm text-slate-600">{client.email ?? client.mobile ?? "No contact added"}</p><span className="inline-flex w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700" title="Client status">{client.status}</span></div>)}</div>}</Panel>;
}

function FirmSetupView({
  currentFirm,
  firms,
  user,
}: {
  currentFirm: FirmProfile;
  firms: FirmProfile[];
  user: TeamMember;
}) {
  // Section 14 Step 5B-final-F2: read-only active-firm view. The local-only write
  // actions (Save Active Firm, Add Firm) were parked - they had no server backing
  // and did not persist after F1. Multi-firm onboarding stays parked. No mutations.
  return <div className="space-y-4">
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Firm Setup</h2>
      <p className="mt-1 text-sm text-slate-500">Review the active firm identity used for this workspace. Multi-firm onboarding is parked for this release.</p>
    </div>

    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-slate-950">Active firm</h3>
      <dl className="mt-3 grid gap-3 md:grid-cols-2">
        <FirmDetail label="Firm name" value={currentFirm.name} />
        <FirmDetail label="City" value={currentFirm.city || "Not set"} />
        <FirmDetail label="Plan" value={currentFirm.plan || "Not set"} />
        <FirmDetail label="Email domain" value={currentFirm.emailDomain || "Not set"} />
        <FirmDetail label="Status" value={currentFirm.status} />
      </dl>
    </div>

    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-950">Firm registry</h3>
        <span className="text-xs text-slate-500">Single-firm workspace</span>
      </div>
      <div className="mt-3 space-y-2">
        {firms.map((item) => <div key={item.id} className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 md:grid-cols-[1.2fr_0.7fr_0.6fr_0.8fr]">
          <div>
            <p className="font-semibold text-slate-900">{item.name}</p>
            <p className="text-xs text-slate-500">{item.emailDomain || "Not set"}</p>
          </div>
          <p className="text-sm text-slate-700">{item.city || "Not set"}</p>
          <p className="text-sm text-slate-700">{item.plan || "Not set"}</p>
          <p className="text-sm font-medium text-slate-700">{item.status}</p>
        </div>)}
      </div>
      <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">Multi-firm onboarding is not enabled in this release. Additional firms are added by your platform administrator.</p>
      <p className="mt-3 text-xs text-slate-500">Logged in as: {user.platformRole === "Platform Owner" ? "Platform Owner" : user.firmRole}</p>
    </div>
  </div>;
}

function FirmDetail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-100 bg-slate-50 p-3"><dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd></div>;
}

function TeamView({ actions, open, team, user, loading, error, notice }: { actions: MemberActions; open: () => void; team: TeamMember[]; user: TeamMember; loading: boolean; error: ApiError | null; notice: string | null }) {
  const canManage = (user.platformRole === "Platform Owner" || user.firmRole === "Firm Admin") && TEAM_WRITES_ENABLED;
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div><h2 className="font-semibold text-slate-950">Team and access</h2><p className="text-sm text-slate-500">Add users, control roles, reset passwords, and deactivate access when someone leaves.</p></div><button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50" disabled={!canManage} onClick={open} title={TEAM_WRITES_ENABLED ? "Create an active user. The user creates a password on first sign-in." : "Team changes are not available in this build."} type="button">Add User</button></div>{notice && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm" role="status">{notice}</div>}{loading ? <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Loading team...</div> : error ? <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-red-600 shadow-sm" role="alert">{teamErrorMessage(error)}</div> : team.length === 0 ? <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">No team members found.</div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{team.map((member) => <UserAccessCard key={member.id} actions={actions} currentUser={user} member={member} />)}</div>}</div>;
}

function UserAccessCard({ actions, currentUser, member }: { actions: MemberActions; currentUser: TeamMember; member: TeamMember }) {
  const manageable = canManageUser(currentUser, member);
  const roleLabel = member.platformRole === "Platform Owner" ? "Platform Owner" : member.firmRole;
  return <div className={(member.isActive ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50") + " rounded-lg border p-4 shadow-sm"} title="User access record">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-950">{member.name}</p>
        <p className="mt-1 truncate text-sm text-slate-500">{member.email}</p>
      </div>
      <span className={(member.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600") + " shrink-0 rounded-full px-2 py-1 text-xs font-semibold"}>{member.isActive ? "Active" : "Inactive"}</span>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
      <label className="block" title={manageable ? "Change the user's firm role." : "This user cannot be edited from your current access level."}>
        <span className="text-xs font-semibold uppercase text-slate-500">Role</span>
        <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500" disabled={!manageable || member.platformRole === "Platform Owner" || !TEAM_WRITES_ENABLED} onChange={(event) => actions.updateRole(member.id, event.target.value as FirmRole)} value={member.firmRole}>
          {firmRoles.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
      </label>
      <div className="pt-5 text-right text-xs text-slate-500"><UserCog className="ml-auto text-blue-600" size={18} />{roleLabel}</div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
      <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45" disabled={!manageable || !member.isActive || !TEAM_PASSWORD_RESET_ENABLED || actions.resettingId === member.id} onClick={() => actions.resetPassword(member.id)} title={TEAM_PASSWORD_RESET_ENABLED ? "Send this user a password-reset email. They set a new password via the secure link." : "Password reset moves to the database in the next step (5B-3c); read-only in this build."} type="button"><KeyRound size={14} className="inline" /> {actions.resettingId === member.id ? "Sending…" : "Reset password"}</button>
      <button className={(member.isActive ? "border-red-200 text-red-700 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50") + " rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"} disabled={!manageable || !TEAM_WRITES_ENABLED} onClick={() => actions.setActive(member.id, !member.isActive)} title={member.isActive ? "Stop this user from signing in while keeping history intact." : "Allow this user to sign in again."} type="button">{member.isActive ? "Deactivate" : "Reactivate"}</button>
    </div>
    <p className="mt-3 text-xs leading-5 text-slate-500">Last status: {member.lastActive}</p>
  </div>;
}

function ReportsView({ clients, tasks, team }: { clients: Client[]; tasks: Task[]; team: TeamMember[] }) {
  const active = tasks.filter((task) => task.status !== "Closed");
  const overdue = active.filter((task) => task.dueDate < todayIso).length;
  const busiest = tasks.length === 0 ? null : [...team].sort((a, b) => tasks.filter((task) => task.assigneeIds.includes(b.userId ?? "")).length - tasks.filter((task) => task.assigneeIds.includes(a.userId ?? "")).length)[0];
  return <div className="space-y-4"><div className="grid gap-3 md:grid-cols-4"><ReportPanel title="Active tasks" value={String(active.length)} detail="Open through review" icon={ClipboardList} /><ReportPanel title="Overdue" value={String(overdue)} detail="Needs attention" icon={AlertTriangle} /><ReportPanel title="Review queue" value={String(tasks.filter((task) => task.status === "Under Review").length)} detail="Pending closure" icon={Eye} /><ReportPanel title="Top workload" value={busiest?.name ?? "None"} detail="Assignee load" icon={Users} /></div><div className="grid gap-4 xl:grid-cols-2"><div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold text-slate-950">Status distribution</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{statuses.map((status) => <div key={status} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500">{status}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{tasks.filter((task) => task.status === status).length}</p></div>)}</div></div><div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold text-slate-950">Client-wise workload</h2><div className="mt-4 space-y-3">{clients.map((client) => <div key={client.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"><span className="font-medium text-slate-700">{client.name}</span><span className="font-semibold text-slate-950">{tasks.filter((task) => task.clientId === client.id && task.status !== "Closed").length} active</span></div>)}</div></div></div></div>;
}

function AdminView({ actions, activity, activityLoading, activityError, clients, firm, modules, modulesLoading, modulesError, moduleTogglePending, openTeam, tasks, team, toggleModule, user }: { actions: MemberActions; activity: ActivityDTO[]; activityLoading: boolean; activityError: ApiError | null; clients: Client[]; firm: FirmProfile; modules: ModuleFlag[]; modulesLoading: boolean; modulesError: ApiError | null; moduleTogglePending: string | null; openTeam: () => void; tasks: Task[]; team: TeamMember[]; toggleModule: (id: string) => void; user: TeamMember }) {
  const owner = user.platformRole === "Platform Owner";
  const activeTasks = tasks.filter((task) => task.status !== "Closed");
  const overdueTasks = activeTasks.filter((task) => task.dueDate < todayIso);
  const reviewTasks = tasks.filter((task) => task.status === "Under Review");
  const closedTasks = tasks.filter((task) => task.status === "Closed");
  const enabledModules = modules.filter((module) => module.enabled).length;
  const completionRate = tasks.length ? Math.round((closedTasks.length / tasks.length) * 100) : 0;
  const healthScore = Math.max(0, Math.min(100, 92 - overdueTasks.length * 12 + reviewTasks.length * 3 + enabledModules));
  const activeUsers = team.filter((member) => member.isActive).length;
  const roleRows = ["Platform Owner", "Firm Admin", "Partner", "Manager", "Article/Staff"].map((role) => ({
    role,
    users: team.filter((member) => role === "Platform Owner" ? member.platformRole === "Platform Owner" : member.firmRole === role && member.platformRole !== "Platform Owner").length,
  }));

  return <div className="space-y-5 overflow-x-hidden">
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-[#080d18] text-white shadow-xl shadow-slate-950/10">
      <div className="relative grid min-w-0 gap-6 p-5 md:p-6 2xl:grid-cols-[1.25fr_0.75fr]">
        <div className="absolute right-8 top-6 h-24 w-24 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-24 w-48 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-100"><Crown size={14} /> Admin Command Center</span>
            <span className="inline-flex items-center rounded-full border border-emerald-200/20 bg-emerald-200/10 px-3 py-1 text-xs font-semibold text-emerald-100">{firm.status} workspace</span>
          </div>
          <h2 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight md:text-4xl">Control firm operations with visibility, governance, and calm execution discipline.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Start with firm health, then review users, modules, plan limits, and activity. Sensitive platform controls stay visible, traceable, and role-gated.</p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <AdminMetric icon={Gauge} label="Workspace health" value={healthScore + "%"} detail={overdueTasks.length ? `${overdueTasks.length} overdue attention point${overdueTasks.length === 1 ? "" : "s"}` : "No overdue pressure"} tone="emerald" />
            <AdminMetric icon={Users} label="Active users" value={String(activeUsers)} detail={`${team.length} total profiles`} tone="sky" />
            <AdminMetric icon={Zap} label="Enabled modules" value={`${enabledModules}/${modules.length}`} detail="Feature visibility under control" tone="amber" />
          </div>
        </div>
        <div className="relative rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Completion quality</p>
              <p className="mt-1 text-sm text-slate-300">Closed work as a share of total tasks</p>
            </div>
            <Gauge className="text-amber-200" size={20} />
          </div>
          <DonutChart value={completionRate} label="Closure" />
          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-white/5 p-2"><p className="font-semibold text-white">{activeTasks.length}</p><p className="text-slate-400">Active</p></div>
            <div className="rounded-lg bg-white/5 p-2"><p className="font-semibold text-white">{reviewTasks.length}</p><p className="text-slate-400">Review</p></div>
            <div className="rounded-lg bg-white/5 p-2"><p className="font-semibold text-white">{closedTasks.length}</p><p className="text-slate-400">Closed</p></div>
          </div>
        </div>
      </div>
    </section>

    {!owner && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Firm-level admin view active. Platform-wide controls require Platform Owner access.</div>}

    <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <AdminPanel title="Operational Analytics" subtitle="Live health indicators for task governance and closure quality." icon={TrendingUp}>
        <div className="grid gap-3 md:grid-cols-2">
          <ReportPanel title="Clients" value={String(clients.length)} detail="Client master records" icon={Building2} />
          <ReportPanel title="Tasks" value={String(tasks.length)} detail="All workflow statuses" icon={ClipboardList} />
          <ReportPanel title="Review queue" value={String(reviewTasks.length)} detail="Awaiting reviewer action" icon={Eye} />
          <ReportPanel title="Overdue" value={String(overdueTasks.length)} detail="Needs owner attention" icon={AlertTriangle} />
        </div>
        <div className="mt-5 space-y-3">
          {statuses.map((status) => <StatusBarRow key={status} count={tasks.filter((task) => task.status === status).length} status={status} total={Math.max(tasks.length, 1)} />)}
        </div>
      </AdminPanel>

      <AdminPanel title="User Administration" subtitle="Create users, control access, reset passwords, and strike off inactive profiles." icon={UserCog}>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45" disabled={!owner && user.firmRole !== "Firm Admin"} onClick={openTeam} title="Add a work email ID as an active workspace user" type="button"><UserPlus size={16} /> Add user</button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" disabled title="View-as mode is prepared for the next admin layer." type="button"><Eye size={16} /> View-as</button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" disabled title="Exports are planned for firm owner reporting." type="button"><FileDown size={16} /> Export</button>
        </div>
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900" title="Current access model">
          Add the user&apos;s work email ID here first. The user sets their own password on first sign-in. Deactivate access when a person leaves; historical task records stay intact.
        </div>
        <div className="mt-5 space-y-3">
          {roleRows.map((row) => <div key={row.role} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2" title={`${row.role}: ${row.users} user${row.users === 1 ? "" : "s"}`}>
            <div className="flex items-center gap-3"><RoleBadge role={row.role} /><span className="text-sm font-semibold text-slate-800">{row.role}</span></div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{row.users}</span>
          </div>)}
        </div>
        <div className="mt-5 grid gap-3">
          {team.map((member) => <UserAccessCard key={member.id} actions={actions} currentUser={user} member={member} />)}
        </div>
      </AdminPanel>
    </section>

    <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <AdminPanel title="Module Governance" subtitle="Turn advanced modules on only when the firm is ready to use them." icon={SlidersHorizontal}>
        <div className="grid gap-3 md:grid-cols-2">
          {modulesLoading ? (
            <div className="col-span-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Loading modules…</div>
          ) : modulesError ? (
            <div className="col-span-2 rounded-lg border border-dashed border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">Could not load modules. Please reload the page.</div>
          ) : (
            modules.map((item) => <ModuleControlCard key={item.id} item={item} owner={owner} toggleModule={toggleModule} togglePending={moduleTogglePending !== null} />)
          )}
        </div>
      </AdminPanel>

      <AdminPanel title="Subscription and Controls" subtitle="Plan position, locked owner tools, and governance readiness." icon={KeyRound}>
        <div className="grid gap-3 md:grid-cols-3">
          {plans.map((plan) => <div key={plan.id} className={(plan.price === "Active" ? "border-slate-900 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900") + " rounded-lg border p-4 shadow-sm"} title={`${plan.name}: ${plan.limits}`}>
            <div className="flex items-center justify-between"><p className="font-semibold">{plan.name}</p><span className={(plan.price === "Active" ? "bg-amber-200 text-slate-950" : "bg-slate-100 text-slate-600") + " rounded-full px-2 py-1 text-xs font-semibold"}>{plan.price}</span></div>
            <p className={(plan.price === "Active" ? "text-slate-300" : "text-slate-500") + " mt-3 text-xs leading-5"}>{plan.limits}</p>
          </div>)}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <OwnerTool icon={Eye} label="View-as mode" text="Controlled role visibility with audit logging." />
          <OwnerTool icon={FileDown} label="Data exports" text="Firm, user, task, client, and activity export controls." />
          <OwnerTool icon={LockKeyhole} label="Audit tools" text="Sensitive actions create activity entries." />
          <OwnerTool icon={Mail} label="Email reminders" text="Daily summary and overdue alert controls." />
        </div>
      </AdminPanel>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <AdminPanel title="Activity Monitor" subtitle="Chronological control log for sensitive and operational actions." icon={Activity}>
        <ActivityTimeline activity={activity} loading={activityLoading} error={activityError} team={team} />
      </AdminPanel>
      <AdminPanel title="Release Readiness" subtitle="Simple governance checklist for first client deployment." icon={Settings}>
        <div className="space-y-3">
          <ActionTile done label="Core task tracking" text="Create, assign, review, and close tasks." />
          <ActionTile done label="Client master" text="Minimum client record before task creation." />
          <ActionTile done={modules.find((module) => module.key === "REPORTS_ADVANCED")?.enabled ?? false} label="Reports visibility" text="Analytics visible to admin and manager roles." />
          <ActionTile done={owner} label="Owner control" text={owner ? "Platform owner controls available." : "Sign in as Platform Owner for full controls."} />
        </div>
      </AdminPanel>
    </section>
  </div>;
}

function AdminMetric({ detail, icon: Icon, label, tone, value }: { detail: string; icon: typeof Gauge; label: string; tone: "emerald" | "sky" | "amber"; value: string }) {
  const toneClass = {
    emerald: "border-emerald-200/20 bg-emerald-200/10 text-emerald-100",
    sky: "border-sky-200/20 bg-sky-200/10 text-sky-100",
    amber: "border-amber-200/20 bg-amber-200/10 text-amber-100",
  }[tone];
  return <div className={`min-w-0 rounded-lg border p-4 ${toneClass}`} title={`${label}: ${detail}`}>
    <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">{label}</p><Icon size={18} /></div>
    <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    <p className="mt-1 text-xs leading-5 opacity-80">{detail}</p>
  </div>;
}

function AdminPanel({ children, icon: Icon, subtitle, title }: { children: React.ReactNode; icon: typeof ShieldCheck; subtitle: string; title: string }) {
  return <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" title={subtitle}>
    <div className="flex items-start justify-between gap-3">
      <div><h2 className="text-base font-semibold text-slate-950">{title}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{subtitle}</p></div>
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white"><Icon size={19} /></span>
    </div>
    <div className="mt-5">{children}</div>
  </section>;
}

function DonutChart({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return <div className="mt-6 flex items-center justify-center">
    <div className="relative flex h-44 w-44 items-center justify-center rounded-full transition-transform duration-500 hover:scale-[1.03]" style={{ background: `conic-gradient(#fcd34d ${clamped * 3.6}deg, rgba(255,255,255,0.1) 0deg)` }} title={`${label}: ${clamped}%`}>
      <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-[#101623] text-center shadow-inner shadow-black/40">
        <p className="text-4xl font-semibold text-white">{clamped}%</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      </div>
    </div>
  </div>;
}

function StatusBarRow({ count, status, total }: { count: number; status: TaskStatus; total: number }) {
  const percent = Math.round((count / total) * 100);
  return <div title={`${status}: ${count} task${count === 1 ? "" : "s"}`}>
    <div className="flex items-center justify-between text-xs"><span className="font-semibold text-slate-700">{status}</span><span className="text-slate-500">{count}</span></div>
    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500 transition-all duration-700" style={{ width: `${percent}%` }} /></div>
  </div>;
}

function RoleBadge({ role }: { role: string }) {
  const tone = role === "Platform Owner" ? "bg-amber-100 text-amber-800" : role === "Firm Admin" ? "bg-sky-100 text-sky-800" : role === "Partner" ? "bg-violet-100 text-violet-800" : role === "Manager" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700";
  return <span className={`${tone} inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold`}>{role.slice(0, 1)}</span>;
}

function ModuleControlCard({ item, owner, toggleModule, togglePending }: { item: ModuleFlag; owner: boolean; toggleModule: (id: string) => void; togglePending: boolean }) {
  return <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 transition hover:border-slate-200 hover:bg-white" title={`${item.name}: ${item.visibility}`}>
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-sm font-semibold text-slate-900">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.key}</p></div>
      <button className={(item.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700") + " rounded-full px-3 py-1 text-xs font-semibold transition hover:scale-105 disabled:hover:scale-100"} disabled={!owner || togglePending} onClick={() => toggleModule(item.id)} title={owner ? `Toggle ${item.name}` : "Only Platform Owner can change module access"} type="button">{item.enabled ? "Enabled" : "Hidden"}</button>
    </div>
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white"><div className={(item.enabled ? "w-full bg-emerald-500" : "w-1/3 bg-slate-300") + " h-full rounded-full transition-all duration-500"} /></div>
  </div>;
}

// Section 14 Step 5B-5a: renders the server ActivityLog (GET /api/activity) only.
// Fields come from ActivityDTO; actor resolved by PlatformUser userId. No local echo.
function ActivityTimeline({ activity, loading, error, team }: { activity: ActivityDTO[]; loading: boolean; error: ApiError | null; team: TeamMember[] }) {
  if (loading) return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Loading activity…</div>;
  if (error) return <div className="rounded-lg border border-dashed border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">Could not load activity. Please reload the page.</div>;
  if (activity.length === 0) return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">No activity yet. Audited actions appear here automatically.</div>;
  return <div className="space-y-3">
    {activity.slice(0, 8).map((event) => <div key={event.id} className="relative rounded-lg border border-slate-100 bg-slate-50 p-3 pl-10 text-sm" title={`${event.action}: ${event.entityType}`}>
      <span className="absolute left-3 top-4 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
      <p className="font-semibold text-slate-900">{event.action}</p>
      <p className="mt-1 text-slate-600">{event.entityType}</p>
      <p className="mt-1 text-xs text-slate-500">{userNameByUserId(team, event.actorId ?? "")} - {new Date(event.createdAt).toLocaleString()}</p>
    </div>)}
  </div>;
}

function ActionTile({ done, label, text }: { done: boolean; label: string; text: string }) {
  return <div className={(done ? "border-emerald-100 bg-emerald-50" : "border-amber-100 bg-amber-50") + " flex items-start gap-3 rounded-lg border p-3"} title={text}>
    <span className={(done ? "bg-emerald-600 text-white" : "bg-amber-500 text-white") + " mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full"}>{done ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}</span>
    <div><p className={(done ? "text-emerald-950" : "text-amber-950") + " text-sm font-semibold"}>{label}</p><p className={(done ? "text-emerald-700" : "text-amber-800") + " mt-1 text-xs leading-5"}>{text}</p></div>
  </div>;
}

function Panel({ action, actionDisabled, actionTitle, children, onAction, subtitle, title }: { action: string; actionDisabled?: boolean; actionTitle?: string; children: React.ReactNode; onAction: () => void; subtitle: string; title: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white shadow-sm" title={subtitle}><div className="flex items-center justify-between border-b border-slate-200 p-4"><div><h2 className="font-semibold text-slate-950">{title}</h2><p className="text-sm text-slate-500">{subtitle}</p></div><button className={(actionDisabled ? "cursor-not-allowed bg-slate-200 text-slate-500" : "bg-blue-600 text-white hover:bg-blue-700") + " rounded-lg px-3 py-2 text-sm font-semibold"} disabled={actionDisabled} onClick={onAction} title={actionTitle ?? action} type="button">{action}</button></div>{children}</div>;
}

function ReportPanel({ detail, icon: Icon, title, value }: { detail: string; icon: typeof ClipboardList; title: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" title={`${title}: ${detail}`}><Icon className="text-blue-600" size={20} /><p className="mt-4 text-sm font-medium text-slate-500">{title}</p><p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-sm text-slate-500">{detail}</p></div>;
}

function OwnerTool({ icon: Icon, label, text }: { icon: typeof Eye; label: string; text: string }) {
  return <div className="rounded-lg border border-slate-100 bg-slate-50 p-3" title={text}><Icon className="text-blue-600" size={18} /><p className="mt-3 text-sm font-semibold text-slate-950">{label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>;
}

function TaskModal({ clients, close, submit, team }: { clients: Client[]; close: () => void; submit: (values: { title: string; clientId: string; dueDate: string; priority: string; assigneeIds: string[]; reviewerId: string; description?: string }) => Promise<{ ok: boolean; message?: string }>; team: TeamMember[] }) {
  const activeTeam = team.filter((member) => member.isActive);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  if (clients.length === 0) return <ModalFrame title="Create task" subtitle="Add one client before creating tasks." close={close}><div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900" title="Tasks must be linked to a client for clean tracking.">Guidance: First add the client in Client master. Then return here and create the task with only title, client, due date, assignee, and reviewer.</div><div className="mt-4 flex justify-end"><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={close} type="button">Close</button></div></ModalFrame>;
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    const values = {
      title: String(form.get("title") || "").trim(),
      clientId: String(form.get("clientId") || ""),
      dueDate: String(form.get("dueDate") || ""),
      priority: String(form.get("priority") || "Normal"),
      assigneeIds: form.getAll("assigneeIds").map(String).filter(Boolean),
      reviewerId: String(form.get("reviewerId") || ""),
      description: String(form.get("description") || "").trim() || undefined,
    };
    if (!values.title || !values.clientId || !values.dueDate || !values.reviewerId || values.assigneeIds.length === 0) {
      setError("Title, client, due date, reviewer, and at least one assignee are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    const result = await submit(values);
    if (result.ok) { close(); return; }
    setError(result.message || "Could not create the task. Please try again.");
    setSubmitting(false);
  }
  return <ModalFrame title="Create task" subtitle="Required fields first." close={close}><form className="space-y-4" onSubmit={onSubmit}><Field label="Task title" name="title" required /><div className="grid gap-4 md:grid-cols-2"><Select label="Client" name="clientId" required><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select><Field label="Due date" name="dueDate" required type="date" /><Select label="Priority" name="priority"><option>Low</option><option>Normal</option><option>High</option><option>Critical</option></Select></div><div className="grid gap-4 md:grid-cols-2"><label className="block"><span className="text-sm font-medium text-slate-700">Assignees</span><select className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" name="assigneeIds" multiple required>{activeTeam.filter((member) => member.firmRole !== "Firm Admin").map((member) => <option key={member.id} value={member.userId}>{member.name} - {member.firmRole}</option>)}</select><span className="mt-1 block text-xs text-slate-500">Hold Ctrl to select multiple active users.</span></label><Select label="Reviewer" name="reviewerId" required><option value="">Select reviewer</option>{activeTeam.filter((member) => member.firmRole !== "Article/Staff").map((member) => <option key={member.id} value={member.userId}>{member.name} - {member.firmRole}</option>)}</Select></div><textarea className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" name="description" placeholder="More details, optional" />{error && <div className="rounded-lg border border-red-300/40 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</div>}<Actions close={close} disabled={submitting} label={submitting ? "Creating…" : "Create Task"} /></form></ModalFrame>;
}

function AssignmentModal({ clients, close, submit, team }: { clients: Client[]; close: () => void; submit: (event: FormEvent<HTMLFormElement>) => void; team: TeamMember[] }) {
  const activeTeam = team.filter((member) => member.isActive);
  if (clients.length === 0) return <ModalFrame title="Create assignment" subtitle="Add one client before creating an assignment stream." close={close}><div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Create the client first. Assignment streams sit under clients and collect related tasks for partner-level tracking.</div><div className="mt-4 flex justify-end"><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={close} type="button">Close</button></div></ModalFrame>;
  return <ModalFrame title="Create assignment" subtitle="Create the roll-up stream before adding detailed tasks." close={close}><form className="space-y-4" onSubmit={submit}><Field label="Assignment name" name="name" placeholder="For example: Monthly GST compliance" required /><div className="grid gap-4 md:grid-cols-2"><Select label="Client" name="clientId" required><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select><Field label="Period" name="period" placeholder="For example: April 2026" /></div><div className="grid gap-4 md:grid-cols-2"><Select label="Manager / owner" name="ownerId" required><option value="">Select manager</option>{activeTeam.filter((member) => member.firmRole !== "Article/Staff").map((member) => <option key={member.id} value={member.id}>{member.name} - {member.firmRole}</option>)}</Select><Select label="Reviewer" name="reviewerId" required><option value="">Select reviewer</option>{activeTeam.filter((member) => member.firmRole !== "Article/Staff").map((member) => <option key={member.id} value={member.id}>{member.name} - {member.firmRole}</option>)}</Select></div><Field label="Target date" name="dueDate" type="date" /><Actions close={close} label="Create Assignment" /></form></ModalFrame>;
}

function ClientModal({ close, submit }: { close: () => void; submit: (values: { name: string; pan?: string; gstin?: string; email?: string; mobile?: string }) => Promise<{ ok: boolean; message?: string }> }) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) {
      setError("Client name is required.");
      return;
    }
    const optional = (key: string) => {
      const value = String(form.get(key) || "").trim();
      return value || undefined;
    };
    const pan = optional("pan");
    const gstin = optional("gstin");
    const email = optional("email");
    const mobile = optional("mobile");
    // Email is the only optional field the API validates (CreateClientSchema). Mirror
    // that rule client-side so an invalid entry shows a specific message. A blank email
    // stays allowed (optional). PAN/GSTIN/mobile have no format rule in the API contract.
    if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Invalid email address.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    let result: { ok: boolean; message?: string };
    try {
      result = await submit({ name, pan, gstin, email, mobile });
    } catch {
      setError("Unable to add client. Please try again.");
      setIsSubmitting(false);
      return;
    }
    if (result.ok) {
      close();
      return;
    }
    setError(result.message ?? "Unable to add client.");
    setIsSubmitting(false);
  }

  return <ModalFrame title="Add client" subtitle="Only client name is compulsory." close={close}><form className="space-y-4" noValidate onSubmit={onSubmit}><Field label="Client name" name="name" required /><div className="grid gap-4 md:grid-cols-2"><Field label="PAN" name="pan" /><Field label="GSTIN" name="gstin" /><Field label="Email" name="email" type="email" /><Field label="Mobile/contact" name="mobile" /></div>{error && <div className="rounded-lg border border-red-300/50 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}<Actions close={close} disabled={isSubmitting} label={isSubmitting ? "Adding..." : "Add Client"} /></form></ModalFrame>;
}

function TeamModal({ close, submit }: { close: () => void; submit: (values: { name: string; email: string; firmRole: FirmRole }) => Promise<{ ok: boolean; message?: string }> }) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const firmRole = String(form.get("firmRole") || "Article/Staff") as FirmRole;
    if (!name) {
      setError("Name is required.");
      return;
    }
    // Mirror the server CreateTeamMemberSchema email regex client-side so an
    // invalid entry surfaces a specific message and the API call is skipped.
    // Domain enforcement (matching the firm emailDomain) remains server-side
    // and surfaces verbatim if it rejects.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Invalid email address.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    let result: { ok: boolean; message?: string };
    try {
      result = await submit({ name, email, firmRole });
    } catch {
      setError("Could not add the team member. Please try again.");
      setIsSubmitting(false);
      return;
    }
    if (result.ok) {
      close();
      return;
    }
    setError(result.message ?? "Could not add the team member.");
    setIsSubmitting(false);
  }

  return <ModalFrame title="Add team member" subtitle="Use an official work email. Password is created by the user on first sign-in." close={close}><form className="space-y-4" noValidate onSubmit={onSubmit}><Field label="Name" name="name" required /><Field label="Work email" name="email" placeholder="name@yourfirm.com" required type="email" /><Select label="Role" name="firmRole"><option>Firm Admin</option><option>Partner</option><option>Manager</option><option>Article/Staff</option></Select>{error && <div className="rounded-lg border border-red-300/50 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}<Actions close={close} disabled={isSubmitting} label={isSubmitting ? "Adding..." : "Add User"} /></form></ModalFrame>;
}

function TaskDrawer({ addNote, assignments, cancelTask, clients, close, moveTask, reopenTask, task, team, user }: { addNote: (taskId: string, note: string) => Promise<{ ok: boolean; message?: string }>; assignments: Assignment[]; cancelTask: (taskId: string, reason: string) => Promise<{ ok: boolean; message?: string }>; clients: Client[]; close: () => void; moveTask: (taskId: string, status: TaskStatus, remarks?: string) => Promise<{ ok: boolean; message?: string }>; reopenTask: (taskId: string, reason: string) => Promise<{ ok: boolean; message?: string }>; task: Task; team: TeamMember[]; user: TeamMember }) {
  const [note, setNote] = useState("");
  const [remarks, setRemarks] = useState("");
  // Section 14 Step 5B-4c-1: lifecycle (status move + close) cuts over to the API
  // behind TASK_LIFECYCLE_ENABLED. The progress-note form / assignee / reviewer /
  // resequence stay parked behind TASK_WRITES_ENABLED (false) until 5B-4c-2 / 4d.
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState("");
  // Section 14 Step 5B-4c-2: user-entered reason for the contextual reopen/cancel action.
  const [actionReason, setActionReason] = useState("");
  // Section 14 Step 5B-4d-2b: notes render from the API. Fetched per drawer open /
  // task switch (the drawer is keyed by task.id at the call site, so it remounts);
  // add-note POSTs then refetches (no local echo). refetchNotes is memoized on
  // task.id so the effect runs once per task without a dependency loop.
  const [notes, setNotes] = useState<TaskNoteDTO[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const refetchNotes = useCallback(async () => {
    setNotesLoading(true);
    setNotesError("");
    try {
      const result = await tasksApi.listNotes(task.id);
      setNotes(result.items);
    } catch {
      setNotesError("Couldn't load notes - reopen the task to retry.");
    } finally {
      setNotesLoading(false);
    }
  }, [task.id]);
  // Drawer-open / task-switch initial load. Separate from refetchNotes (which is
  // used for event-driven refreshes after add-note and lifecycle success). No
  // synchronous setState before the first await; relies on the initial defaults
  // (notes=[], notesLoading=true) and the drawer key={task.id} remount.
  useEffect(() => {
    let cancelled = false;
    async function loadInitialNotes() {
      try {
        const response = await tasksApi.listNotes(task.id);
        if (cancelled) return;
        setNotes(response.items);
        setNotesError("");
      } catch {
        if (!cancelled) setNotesError("Couldn't load notes - reopen the task to retry.");
      } finally {
        if (!cancelled) setNotesLoading(false);
      }
    }
    void loadInitialNotes();
    return () => { cancelled = true; };
  }, [task.id]);
  async function submitNote(event: FormEvent) {
    event.preventDefault();
    if (!TASK_NOTES_ENABLED || noteSubmitting || !note.trim()) return;
    setNoteSubmitting(true);
    setNotesError("");
    const result = await addNote(task.id, note);
    if (result.ok) {
      setNote("");
      await refetchNotes();
    } else {
      setNotesError(result.message ?? "Could not add the note. Please try again.");
    }
    setNoteSubmitting(false);
  }
  const rawAssignee = task.assigneeIds.includes(user.userId ?? "");
  const rawReviewer = task.reviewerId === (user.userId ?? "") || user.firmRole === "Firm Admin" || user.platformRole === "Platform Owner";
  const rawCanUpdate = rawAssignee || rawReviewer || task.createdById === (user.userId ?? "");
  // Lifecycle gates (status move + close) — enabled this wave.
  const lcAssignee = TASK_LIFECYCLE_ENABLED && rawAssignee;
  const lcReviewer = TASK_LIFECYCLE_ENABLED && rawReviewer;
  const lcCanUpdate = TASK_LIFECYCLE_ENABLED && rawCanUpdate;
  // Runs a lifecycle action with an in-flight guard + inline error capture. On
  // success the refetched task list re-renders this drawer from API state.
  async function runMove(nextStatus: TaskStatus, closureRemarks?: string) {
    if (actionPending) return;
    setActionPending(true);
    setActionError("");
    const result = await moveTask(task.id, nextStatus, closureRemarks);
    if (!result.ok) setActionError(result.message ?? "Could not update the task. Please try again.");
    else await refetchNotes(); // status moves / close auto-create a TaskNote server-side
    setActionPending(false);
  }
  // Section 14 Step 5B-4c-2: reopen/cancel gates mirror the server permission
  // matrix fail-closed (backend remains the final authority).
  // TASK_REOPEN: PO / Firm Admin always; Partner / Manager only if reviewer; staff never.
  const lcReopen = TASK_LIFECYCLE_ENABLED && (user.platformRole === "Platform Owner" || user.firmRole === "Firm Admin" || ((user.firmRole === "Partner" || user.firmRole === "Manager") && task.reviewerId === (user.userId ?? "")));
  // TASK_CANCEL: PO / Firm Admin / Partner always; Manager only if creator; staff never.
  const lcCancel = TASK_LIFECYCLE_ENABLED && (user.platformRole === "Platform Owner" || user.firmRole === "Firm Admin" || user.firmRole === "Partner" || (user.firmRole === "Manager" && task.createdById === (user.userId ?? "")));
  // Runs the contextual dedicated action (Closed -> reopen; non-terminal -> cancel)
  // with the shared in-flight guard + inline error; clears the reason on success.
  async function runAction(action: "reopen" | "cancel") {
    if (actionPending) return;
    setActionPending(true);
    setActionError("");
    const result = action === "reopen" ? await reopenTask(task.id, actionReason.trim()) : await cancelTask(task.id, actionReason.trim());
    if (!result.ok) setActionError(result.message ?? "Could not update the task. Please try again.");
    else { setActionReason(""); await refetchNotes(); } // reopen/cancel auto-create a TaskNote server-side
    setActionPending(false);
  }
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35"><aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><div><button className="mb-2 text-sm font-semibold text-slate-600 hover:text-slate-950" onClick={close} type="button">Back</button><h2 className="text-xl font-semibold text-slate-950">{task.title}</h2><p className="mt-1 text-sm text-slate-500">{clientName(clients, task.clientId)}{ASSIGNMENTS_ENABLED ? " - " + assignmentName(assignments, task.assignmentId) : ""}</p></div><StatusPill status={task.status} /></div><div className="space-y-5 p-5"><div className="grid gap-3 md:grid-cols-2">{ASSIGNMENTS_ENABLED && <Info label="Assignment" value={assignmentName(assignments, task.assignmentId)} />}<Info label="Due date" value={task.dueDate + " - " + dueState(task).label} /><Info label="Priority" value={task.priority} /><Info label="Assignees" value={task.assigneeIds.map((id) => userNameByUserId(team, id)).join(", ")} /><Info label="Reviewer" value={userNameByUserId(team, task.reviewerId)} /></div>{task.description && <Info label="Description" value={task.description} />}<div className="rounded-lg border border-slate-200 bg-white p-4"><h3 className="font-semibold text-slate-950">Workflow actions</h3><div className="mt-3 flex flex-wrap gap-2"><Workflow disabled={!lcCanUpdate || actionPending || task.status === "Under Review" || !lifecycleCanMoveTo(task.status, "In Progress")} label="Start / resume" action={() => runMove("In Progress")} /><Workflow disabled={!lcCanUpdate || actionPending || !lifecycleCanMoveTo(task.status, "Pending Client")} label="Pending client" action={() => runMove("Pending Client")} /><Workflow disabled={!lcCanUpdate || actionPending || !lifecycleCanMoveTo(task.status, "Pending Internal")} label="Pending internal" action={() => runMove("Pending Internal")} /><Workflow disabled={!lcAssignee || actionPending || !lifecycleCanMoveTo(task.status, "Under Review")} label="Move to review" action={() => runMove("Under Review")} /><Workflow disabled={!lcReviewer || actionPending || task.status !== "Under Review"} label="Send back" action={() => runMove("In Progress")} /></div><div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3"><label className="block text-sm font-medium text-slate-700">Closure remarks</label><textarea className="mt-2 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Required before reviewer closes the task" /><button className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50" disabled={!lcReviewer || actionPending || task.status !== "Under Review" || !remarks.trim()} onClick={() => runMove("Closed", remarks.trim())} type="button">Close after review</button></div>{task.status !== "Cancelled" && <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3"><label className="block text-sm font-medium text-slate-700">{task.status === "Closed" ? "Reopen reason" : "Cancellation reason"}</label><input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" disabled={actionPending} value={actionReason} onChange={(event) => setActionReason(event.target.value)} placeholder={task.status === "Closed" ? "Required before reopening this closed task" : "Required before cancelling this task"} />{task.status === "Closed" ? <button className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50" disabled={!lcReopen || actionPending || !actionReason.trim()} onClick={() => runAction("reopen")} type="button">Reopen task</button> : <button className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50" disabled={!lcCancel || actionPending || !actionReason.trim()} onClick={() => runAction("cancel")} type="button">Cancel task</button>}</div>}{actionError && <p className="mt-3 text-sm text-red-600">{actionError}</p>}</div><div className="rounded-lg border border-slate-200 bg-white p-4"><h3 className="font-semibold text-slate-950">Progress notes</h3><form className="mt-3 flex gap-2" onSubmit={submitNote}><input className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" disabled={!TASK_NOTES_ENABLED || noteSubmitting} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add progress note" /><button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!TASK_NOTES_ENABLED || noteSubmitting || !note.trim()} type="submit">{noteSubmitting ? "Adding..." : "Add"}</button></form><div className="mt-4 space-y-3">{notesLoading ? <p className="text-sm text-slate-500">Loading notes...</p> : notesError ? <p className="text-sm text-red-600">{notesError}</p> : notes.length === 0 ? <p className="text-sm text-slate-500">No notes yet.</p> : notes.map((item) => <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"><p className="text-slate-700">{item.note}</p><p className="mt-2 text-xs text-slate-500">{userNameByUserId(team, item.authorId)} - {new Date(item.createdAt).toLocaleString()}{(item.oldStatus || item.newStatus) ? " - Status: " + (item.oldStatus ? taskStatusCodeToUi(item.oldStatus) : "—") + " to " + (item.newStatus ? taskStatusCodeToUi(item.newStatus) : "—") : ""}</p></div>)}</div></div>{task.closureRemarks && <Info label="Closure remarks" value={task.closureRemarks} />}</div></aside></div>;
}

function ModalFrame({ children, close, subtitle, title }: { children: React.ReactNode; close: () => void; subtitle: string; title: string }) {
  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 sm:items-center"><div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"><div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-lg font-semibold text-slate-950">{title}</h2><p className="text-sm text-slate-500">{subtitle}</p></div><button aria-label="Close modal" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={close} type="button"><X size={18} /></button></div><div className="overflow-y-auto p-5">{children}</div></div></div>;
}

function Field({ defaultValue, label, name, pattern, placeholder, required, type = "text" }: { defaultValue?: string; label: string; name: string; pattern?: string; placeholder?: string; required?: boolean; type?: string }) {
  return <label className="block" title={required ? `${label} is required.` : `${label} is optional.`}><span className="text-sm font-medium text-slate-700">{label}{required ? " *" : ""}</span><input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" defaultValue={defaultValue} name={name} pattern={pattern} placeholder={placeholder ?? (required ? "Required" : "Optional")} required={required} title={required ? `${label} is required.` : `${label} is optional.`} type={type} /></label>;
}

function Select({ children, label, name, required }: { children: React.ReactNode; label: string; name: string; required?: boolean }) {
  return <label className="block" title={required ? `${label} is required.` : `${label} is optional.`}><span className="text-sm font-medium text-slate-700">{label}{required ? " *" : ""}</span><select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" defaultValue="" name={name} required={required} title={required ? `${label} is required.` : `${label} is optional.`}>{children}</select></label>;
}

function Actions({ close, disabled, label }: { close: () => void; disabled?: boolean; label: string }) {
  return <div className="sticky bottom-0 -mx-5 -mb-5 mt-2 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4"><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={close} title="Close without saving" type="button">Cancel</button><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={disabled} title={label} type="submit">{label}</button></div>;
}

function Workflow({ action, disabled, label }: { action: () => void; disabled: boolean; label: string }) {
  return <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50" disabled={disabled} onClick={action} title={disabled ? "This action is not available for your role or current task status." : `Move task: ${label}`} type="button">{label}</button>;
}

function StatusPill({ status }: { status: TaskStatus }) {
  return <span className={statusTone[status] + " inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold"} title={`Current status: ${status}`}>{status}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" title={`${label}: ${value}`}><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-900">{value}</p></div>;
}

function clientName(clients: Client[], id: string) {
  return clients.find((client) => client.id === id)?.name ?? "Unknown client";
}

function assignmentName(assignments: Assignment[], id?: string) {
  if (!id) return "Unmapped task";
  return assignments.find((assignment) => assignment.id === id)?.name ?? "Unmapped task";
}

function assignmentRisk(assignment: Assignment, tasks: Task[]) {
  if (tasks.some((task) => task.status !== "Closed" && task.dueDate < todayIso) || (assignment.dueDate && assignment.dueDate < todayIso && tasks.some((task) => task.status !== "Closed"))) return "At risk";
  if (tasks.some((task) => task.status === "Under Review")) return "Needs review";
  return "On track";
}

function taskRisk(task: Task) {
  if (task.status !== "Closed" && task.dueDate < todayIso) return "At risk";
  if (task.status === "Under Review") return "Needs review";
  return "On track";
}

function riskTone(risk: string) {
  if (risk === "At risk") return "bg-red-50 text-red-700";
  if (risk === "Needs review") return "bg-violet-50 text-violet-700";
  return "bg-emerald-50 text-emerald-700";
}

function sortAssignments(a: Assignment, b: Assignment, tasks: Task[], sortMode: string) {
  const aTasks = tasks.filter((task) => task.assignmentId === a.id);
  const bTasks = tasks.filter((task) => task.assignmentId === b.id);
  if (sortMode === "Client A-Z") return a.clientId.localeCompare(b.clientId) || a.name.localeCompare(b.name);
  if (sortMode === "Due first") return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
  if (sortMode === "Progress low") return assignmentProgress(aTasks) - assignmentProgress(bTasks);
  return riskRank(assignmentRisk(b, bTasks)) - riskRank(assignmentRisk(a, aTasks));
}

function assignmentProgress(tasks: Task[]) {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((task) => task.status === "Closed").length / tasks.length) * 100);
}

function riskRank(risk: string) {
  if (risk === "At risk") return 3;
  if (risk === "Needs review") return 2;
  return 1;
}

// Section 14 Step 5B-4b: resolve a team member name by PlatformUser userId (task
// reviewer/assignee fields are userIds). Team-management lookups that key on
// firmMemberId continue to use userName(team, id).
function userNameByUserId(team: TeamMember[], userId: string) {
  return team.find((member) => member.userId === userId)?.name ?? "Unknown";
}

function userName(team: TeamMember[], id: string) {
  return team.find((member) => member.id === id)?.name ?? "Unknown user";
}

function taskSequence(task: Task) {
  if (typeof task.sequence === "number") return task.sequence;
  const numericId = Number(task.id.replace(/\D/g, ""));
  if (Number.isFinite(numericId) && numericId > 0) return numericId;
  return new Date(task.dueDate).getTime();
}

function dueState(task: Task) {
  if (task.status === "Closed") return { label: "Closed", tone: "text-emerald-700" };
  if (task.dueDate < todayIso) return { label: "Overdue", tone: "text-red-700" };
  if (task.dueDate === todayIso) return { label: "Due today", tone: "text-amber-700" };
  return { label: "Upcoming", tone: "text-slate-600" };
}

function textOrUndefined(form: FormData, key: string) {
  const value = String(form.get(key) || "").trim();
  return value || undefined;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function canManageUser(currentUser: TeamMember, target: TeamMember) {
  if (target.id === currentUser.id) return false;
  if (currentUser.platformRole === "Platform Owner") return true;
  return currentUser.firmRole === "Firm Admin" && target.platformRole !== "Platform Owner";
}

function canAccessSection(user: TeamMember, section: Section) {
  if (section === "dashboard" || section === "tasks") return true;
  if (section === "admin" || section === "team" || section === "firmSetup") return user.platformRole === "Platform Owner" || user.firmRole === "Firm Admin";
  // Section 14 Step 5B-final-F3: Assignments + Project Review parked off the pilot nav (no Assignment backend).
  if (section === "assignments" || section === "projectReview") return ASSIGNMENTS_ENABLED && (user.platformRole === "Platform Owner" || user.firmRole !== "Article/Staff");
  if (section === "clients" || section === "reports") return user.platformRole === "Platform Owner" || user.firmRole !== "Article/Staff";
  return false;
}

// Section 14 Step 5B-final (F1): the pre-login email-domain gate and its helpers
// (isAllowedLoginEmail / isWorkspaceEmail / isPlatformOwnerEmail) were removed.
// Authority is Supabase Auth + the /api/me fail-closed workspace mapping.

