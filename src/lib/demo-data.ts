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
  dueDate: string;
  status: TaskStatus;
  priority: "Low" | "Normal" | "High" | "Urgent";
  assigneeIds: string[];
  reviewerId: string;
  createdById: string;
  updatedAt: string;
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
    email: "owner@tos.local",
    firmRole: "Firm Admin",
    role: "Firm Admin",
    platformRole: "Platform Owner",
    lastActive: "Today",
    isActive: true,
  },
  {
    id: "u_admin",
    name: "Ananya Shah",
    email: "admin@avantage.example",
    firmRole: "Firm Admin",
    role: "Firm Admin",
    platformRole: "Standard",
    lastActive: "Today",
    isActive: true,
  },
  {
    id: "u_partner",
    name: "Rohit Mehra",
    email: "partner@avantage.example",
    firmRole: "Partner",
    role: "Partner",
    platformRole: "Standard",
    lastActive: "Today",
    isActive: true,
  },
  {
    id: "u_manager",
    name: "Priya Nair",
    email: "manager@avantage.example",
    firmRole: "Manager",
    role: "Manager",
    platformRole: "Standard",
    lastActive: "Yesterday",
    isActive: true,
  },
  {
    id: "u_staff",
    name: "Aman Verma",
    email: "staff@avantage.example",
    firmRole: "Article/Staff",
    role: "Article/Staff",
    platformRole: "Standard",
    lastActive: "2 days ago",
    isActive: true,
  },
];

export const initialClients: Client[] = [
  {
    id: "c_abc",
    name: "ABC Private Limited",
    pan: "AABCA1234A",
    gstin: "27AABCA1234A1Z5",
    email: "accounts@abc.example",
    mobile: "+91 98765 43210",
    status: "Active",
  },
  {
    id: "c_mehta",
    name: "Mehta Traders",
    pan: "AAHPM6789L",
    gstin: "27AAHPM6789L1Z2",
    status: "Active",
  },
  {
    id: "c_sunrise",
    name: "Sunrise LLP",
    pan: "AAXFS5555Q",
    email: "finance@sunrise.example",
    status: "Active",
  },
  {
    id: "c_kapoor",
    name: "Kapoor Family Office",
    mobile: "+91 99887 77665",
    status: "Active",
  },
];

export const initialTasks: Task[] = [
  {
    id: "t_gst",
    title: "GST return preparation for March",
    clientId: "c_abc",
    dueDate: "2026-04-20",
    status: "Open",
    priority: "High",
    assigneeIds: ["u_manager", "u_staff"],
    reviewerId: "u_partner",
    createdById: "u_admin",
    updatedAt: "Today, 10:20 AM",
    description: "Prepare GSTR working and reconcile sales register before review.",
    notes: [
      {
        id: "n1",
        authorId: "u_staff",
        text: "Purchase register received. Sales reconciliation pending.",
        createdAt: "Today, 9:40 AM",
      },
    ],
  },
  {
    id: "t_tds",
    title: "TDS reconciliation for Q4",
    clientId: "c_mehta",
    dueDate: "2026-04-26",
    status: "In Progress",
    priority: "Normal",
    assigneeIds: ["u_staff"],
    reviewerId: "u_manager",
    createdById: "u_partner",
    updatedAt: "Today, 11:10 AM",
    notes: [
      {
        id: "n2",
        authorId: "u_manager",
        text: "Check challan mapping before moving to review.",
        createdAt: "Yesterday, 4:00 PM",
      },
    ],
  },
  {
    id: "t_itr",
    title: "ITR data collection checklist",
    clientId: "c_kapoor",
    dueDate: "2026-04-29",
    status: "Pending Client",
    priority: "Normal",
    assigneeIds: ["u_manager"],
    reviewerId: "u_partner",
    createdById: "u_admin",
    updatedAt: "Yesterday, 6:15 PM",
    notes: [
      {
        id: "n3",
        authorId: "u_manager",
        text: "Awaiting capital gains statement and bank interest certificate.",
        createdAt: "Yesterday, 6:15 PM",
        newStatus: "Pending Client",
      },
    ],
  },
  {
    id: "t_audit",
    title: "Tax audit schedule request",
    clientId: "c_sunrise",
    dueDate: "2026-05-02",
    status: "Pending Internal",
    priority: "High",
    assigneeIds: ["u_manager", "u_staff"],
    reviewerId: "u_partner",
    createdById: "u_admin",
    updatedAt: "Today, 8:55 AM",
    notes: [],
  },
  {
    id: "t_roc",
    title: "ROC filing document review",
    clientId: "c_abc",
    dueDate: "2026-04-27",
    status: "Under Review",
    priority: "Urgent",
    assigneeIds: ["u_staff"],
    reviewerId: "u_partner",
    createdById: "u_manager",
    updatedAt: "Today, 12:25 PM",
    notes: [
      {
        id: "n4",
        authorId: "u_staff",
        text: "Moved to review after checking board resolution and forms.",
        createdAt: "Today, 12:25 PM",
        oldStatus: "In Progress",
        newStatus: "Under Review",
      },
    ],
  },
  {
    id: "t_notice",
    title: "Notice response draft",
    clientId: "c_mehta",
    dueDate: "2026-04-18",
    status: "Closed",
    priority: "High",
    assigneeIds: ["u_manager"],
    reviewerId: "u_partner",
    createdById: "u_admin",
    updatedAt: "2026-04-22",
    closedAt: "2026-04-22",
    closureRemarks: "Response reviewed and filed with client approval.",
    notes: [
      {
        id: "n5",
        authorId: "u_partner",
        text: "Closed after final review.",
        createdAt: "2026-04-22, 5:30 PM",
        oldStatus: "Under Review",
        newStatus: "Closed",
      },
    ],
  },
];

export const initialActivityEvents: ActivityEvent[] = [
  {
    id: "a1",
    actorId: "u_admin",
    action: "Created task",
    entity: "Task",
    detail: "GST return preparation for March",
    createdAt: "Today, 10:20 AM",
  },
  {
    id: "a2",
    actorId: "u_staff",
    action: "Moved to review",
    entity: "Task",
    detail: "ROC filing document review",
    createdAt: "Today, 12:25 PM",
  },
  {
    id: "a3",
    actorId: "u_partner",
    action: "Closed task",
    entity: "Task",
    detail: "Notice response draft",
    createdAt: "2026-04-22, 5:30 PM",
  },
  {
    id: "a4",
    actorId: "u_owner",
    action: "Enabled module",
    entity: "ModuleFlag",
    detail: "Reports and analytics enabled for TAMS-TKG",
    createdAt: "Today, 8:00 AM",
  },
];

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
export const tasks = initialTasks;
