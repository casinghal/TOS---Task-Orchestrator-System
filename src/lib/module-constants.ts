// src/lib/module-constants.ts
// PracticeIQ Section 14 Step 3F-1 - Canonical module catalog.
//
// Single source of truth for the set of platform modules and their default
// enablement. Mirrors the frontend module concepts in src/lib/demo-data.ts /
// src/lib/workspace-data.ts (`initialModuleFlags`) so the Step 5 persistence
// cutover can swap localStorage for the API without a contract change.
//
// This constant is the authoritative DEFINITION of the catalog. The persisted
// catalog lives in the `ModuleFlag` table (one row per key); this file is the
// source used to SEED those rows and to validate route inputs. Route handlers
// read the persisted `ModuleFlag` rows from the DB - they do NOT auto-seed.
//
// MODULES_MANAGE is PLATFORM_OWNER-only (decision D2, Step 3F-1): module
// enablement is platform-level entitlement / plan gating, not firm self-service.
//
// References: MASTER_PROJECT.md Section 14 Step 3F; DECISION_LOG D-2026-05-06-01;
// Step 3F-1 plan-first decisions D1 (fixed code-constant catalog) + D2.

export type ModuleCatalogEntry = {
  key: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
};

// Keys are stable identifiers. Do NOT rename a key once shipped; renaming a key
// orphans any FirmModuleAccess rows that reference the corresponding ModuleFlag.
export const MODULE_CATALOG: readonly ModuleCatalogEntry[] = [
  {
    key: "TASKS_CORE",
    name: "Task management",
    description: "Core task orchestration: create, assign, review, and close client work.",
    defaultEnabled: true,
  },
  {
    key: "CLIENTS_CORE",
    name: "Client master",
    description: "Client records and the client master list.",
    defaultEnabled: true,
  },
  {
    key: "REPORTS_ADVANCED",
    name: "Reports and analytics",
    description: "Firm-wide reporting and analytics views.",
    defaultEnabled: true,
  },
  {
    key: "EMAIL_REMINDERS",
    name: "Email reminders",
    description: "Automated email reminders for due and pending work.",
    defaultEnabled: true,
  },
  {
    key: "BILLING_PORTAL",
    name: "Billing portal",
    description: "Client-facing billing and invoicing portal.",
    defaultEnabled: false,
  },
  {
    key: "WHATSAPP_REMINDERS",
    name: "WhatsApp reminders",
    description: "WhatsApp-channel reminders for client communication.",
    defaultEnabled: false,
  },
  {
    key: "AI_ASSISTANT",
    name: "AI assistant",
    description: "AI-assisted drafting and workflow help.",
    defaultEnabled: false,
  },
  {
    key: "WORKFLOW_TEMPLATES",
    name: "Workflow templates",
    description: "Reusable workflow templates for recurring engagements.",
    defaultEnabled: false,
  },
] as const;

const MODULE_BY_KEY: ReadonlyMap<string, ModuleCatalogEntry> = new Map(
  MODULE_CATALOG.map((entry): [string, ModuleCatalogEntry] => [entry.key, entry]),
);

export function isKnownModuleKey(key: string): boolean {
  return MODULE_BY_KEY.has(key);
}

export function getModuleByKey(key: string): ModuleCatalogEntry | undefined {
  return MODULE_BY_KEY.get(key);
}
