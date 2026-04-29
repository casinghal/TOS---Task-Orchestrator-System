export type TaskStatus =
  | "Open"
  | "In Progress"
  | "Pending Client"
  | "Pending Internal"
  | "Under Review"
  | "Closed";

export type FirmRole = "Firm Admin" | "Partner" | "Manager" | "Article/Staff";
export type PlatformRole = "Platform Owner" | "Standard";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  passwordDigest?: string;
  firmRole: FirmRole;
  role: FirmRole;
  platformRole: PlatformRole;
  lastActive: string;
  isActive: boolean;
};

export type Client = {
  id: string;
  name: string;
  pan?: string;
  gstin?: string;
  email?: string;
  mobile?: string;
  status: "Active" | "Inactive";
};

export type Assignment = {
  id: string;
  clientId: string;
  name: string;
  period?: string;
  ownerId: string;
  reviewerId: string;
  dueDate?: string;
  status: "Active" | "On Hold" | "Completed";
};

export type TaskNote = {
  id: string;
  authorId?: string;
  author?: string;
  text: string;
  createdAt: string;
  oldStatus?: TaskStatus;
  newStatus?: TaskStatus;
};

export type Task = {
  id: string;
  title: string;
  clientId: string;
  assignmentId?: string;
  dueDate: string;
  status: TaskStatus;
  priority: "Low" | "Normal" | "High" | "Urgent";
  assigneeIds: string[];
  reviewerId: string;
  createdById: string;
  updatedAt: string;
  sequence?: number;
  description?: string;
  closureRemarks?: string;
  closedAt?: string;
  notes: TaskNote[];
};

export type ActivityEvent = {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  detail: string;
  createdAt: string;
};

export type ModuleFlag = {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  visibility: "Visible" | "Hidden";
};

export type Plan = {
  id: string;
  name: string;
  price: string;
  status: "Draft" | "Ready";
  limits: string;
};

export const firm = {
  id: "firm_tams_tkg",
  name: "TAMS-TKG Chartered Accountants",
  status: "Active",
  city: "Mumbai",
  plan: "Professional",
};

export const initialTeamMembers: TeamMember[] = [
  {
    id: "u_owner",
    name: "Platform Owner",
    email: "singhal.accuron@gmail.com",
    passwordDigest: "d83123f88ec1dffa28f8d9b3eba071d4304bef30424caddd2cd82d2a0523cdc4",
    firmRole: "Firm Admin",
    role: "Firm Admin",
    platformRole: "Platform Owner",
    lastActive: "Today",
    isActive: true,
  },
  {
    id: "u_admin",
    name: "Firm Admin",
    email: "admin@tams.co.in",
    firmRole: "Firm Admin",
    role: "Firm Admin",
    platformRole: "Standard",
    lastActive: "Today",
    isActive: true,
  },
  {
    id: "u_partner",
    name: "Partner",
    email: "partner@tams.co.in",
    firmRole: "Partner",
    role: "Partner",
    platformRole: "Standard",
    lastActive: "Today",
    isActive: true,
  },
  {
    id: "u_manager",
    name: "Manager",
    email: "manager@tams.co.in",
    firmRole: "Manager",
    role: "Manager",
    platformRole: "Standard",
    lastActive: "Yesterday",
    isActive: true,
  },
  {
    id: "u_staff",
    name: "Article/Staff",
    email: "staff@tams.co.in",
    firmRole: "Article/Staff",
    role: "Article/Staff",
    platformRole: "Standard",
    lastActive: "2 days ago",
    isActive: true,
  },
];

export const initialClients: Client[] = [];

export const initialAssignments: Assignment[] = [];

export const initialTasks: Task[] = [];

export const initialActivityEvents: ActivityEvent[] = [];

export const initialModuleFlags: ModuleFlag[] = [
  { id: "m_tasks", key: "TASKS_CORE", name: "Task management", enabled: true, visibility: "Visible" },
  { id: "m_clients", key: "CLIENTS_CORE", name: "Client master", enabled: true, visibility: "Visible" },
  { id: "m_reports", key: "REPORTS_ADVANCED", name: "Reports and analytics", enabled: true, visibility: "Visible" },
  { id: "m_email", key: "EMAIL_REMINDERS", name: "Email reminders", enabled: true, visibility: "Visible" },
  { id: "m_billing", key: "BILLING_PORTAL", name: "Billing portal", enabled: false, visibility: "Hidden" },
  { id: "m_whatsapp", key: "WHATSAPP_REMINDERS", name: "WhatsApp reminders", enabled: false, visibility: "Hidden" },
  { id: "m_ai", key: "AI_ASSISTANT", name: "AI assistant", enabled: false, visibility: "Hidden" },
  { id: "m_workflows", key: "WORKFLOW_TEMPLATES", name: "Workflow templates", enabled: false, visibility: "Hidden" },
];

export const plans: Plan[] = [
  { id: "p_starter", name: "Starter", price: "Configured", status: "Ready", limits: "10 users, 150 clients" },
  { id: "p_professional", name: "Professional", price: "Active", status: "Ready", limits: "30 users, 500 clients" },
  { id: "p_enterprise", name: "Enterprise", price: "Available", status: "Ready", limits: "Custom limits" },
];

export const statuses: TaskStatus[] = [
  "Open",
  "In Progress",
  "Pending Client",
  "Pending Internal",
  "Under Review",
  "Closed",
];
export const teamMembers = initialTeamMembers;
export const clients = initialClients;
export const assignments = initialAssignments;
export const tasks = initialTasks;
