// src/lib/task-constants.ts
// PracticeIQ Section 14 Step 3D foundation.
// Canonical TaskStatus and Priority sets, transition matrix, length / count
// caps locked at MASTER Section 25.5 (Decision G), and helper functions
// consumed by the Task route group.
//
// References:
// - MASTER_PROJECT.md Section 23 (task operating model; transition matrix
//   in 23.2; reopen-as-action / cancel-as-terminal in 23.3; status set in
//   23.1 - explicitly excludes REOPENED).
// - MASTER_PROJECT.md Section 25.5 (task-route-specific security; length
//   caps locked here are the canonical values consumed by Zod schemas in
//   route files).
// - DECISION_LOG D-2026-05-04-01 (3D plan decisions A through F selected).
// - CHANGE_LOG C-2026-05-04-01 (3D-1 implementation wave).
//
// Past due dates are explicitly permitted (Section 23.5) - firms enter
// backlog tasks at onboarding and during ad-hoc cleanup. Past-due tasks
// surface as overdue in reports; routes do not reject them.

// --- Canonical sets -------------------------------------------------------

export const TASK_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "PENDING_CLIENT",
  "PENDING_INTERNAL",
  "UNDER_REVIEW",
  "CLOSED",
  "CANCELLED",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;
export type Priority = (typeof PRIORITIES)[number];

// --- Transitions ----------------------------------------------------------
//
// Allowed next states from each current state. Per MASTER Section 23.2:
// CLOSED -> IN_PROGRESS only via the dedicated /reopen action endpoint
// (3D-3). CANCELLED is terminal. REOPENED is NOT a status; it is an action
// that returns the task to IN_PROGRESS (Section 23.3).

export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  OPEN: ["IN_PROGRESS", "PENDING_INTERNAL", "PENDING_CLIENT", "CANCELLED"],
  IN_PROGRESS: ["PENDING_INTERNAL", "PENDING_CLIENT", "UNDER_REVIEW", "CANCELLED"],
  PENDING_CLIENT: ["IN_PROGRESS", "UNDER_REVIEW", "CANCELLED"],
  PENDING_INTERNAL: ["IN_PROGRESS", "UNDER_REVIEW", "CANCELLED"],
  UNDER_REVIEW: ["IN_PROGRESS", "CLOSED", "CANCELLED"],
  CLOSED: ["IN_PROGRESS"], // only via /reopen action endpoint (3D-3)
  CANCELLED: [], // terminal
} as const;

export function isAllowedTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_STATUS_TRANSITIONS[from].includes(to);
}

// --- Length and count caps (Decision G locked at MASTER Section 25.5) -----

export const MAX_TASK_TITLE_LENGTH = 200;
export const MAX_TASK_DESCRIPTION_LENGTH = 4000;
export const MAX_TASK_NOTE_LENGTH = 4000;
export const MAX_ASSIGNEES_PER_TASK = 50;
export const MAX_TASK_PAGE_SIZE = 200;
export const DEFAULT_TASK_PAGE_SIZE = 50;

// --- Default values -------------------------------------------------------

export const DEFAULT_TASK_STATUS: TaskStatus = "OPEN";
export const DEFAULT_TASK_PRIORITY: Priority = "NORMAL";
