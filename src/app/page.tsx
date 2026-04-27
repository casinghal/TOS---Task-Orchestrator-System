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
  Sparkles,
  TrendingUp,
  UserCog,
  UserPlus,
  Users,
  Zap,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  clients as seedClients,
  firm,
  initialActivityEvents,
  initialModuleFlags,
  plans,
  statuses,
  tasks as seedTasks,
  teamMembers as seedTeam,
  type ActivityEvent,
  type Client,
  type FirmRole,
  type ModuleFlag,
  type Task,
  type TaskStatus,
  type TeamMember,
} from "@/lib/workspace-data";

type Section = "tasks" | "clients" | "team" | "reports" | "admin";
type ViewMode = "list" | "kanban";
type Modal = "task" | "client" | "team" | null;

const todayIso = "2026-04-26";
const workspaceStorageKey = "tos-tams-tkg-live-v3";
const legacyStorageKeys = ["tos-tams-tkg-live-v1", "tos-tams-tkg-live-v2"];
const tamsEmailDomain = "@tams.co.in";
const creatorRoles: FirmRole[] = ["Firm Admin", "Partner", "Manager"];
const loginTips = [
  "Create the client first, then create the task. This keeps every action traceable till closure.",
  "Use Pending Client only when the next action is genuinely with the client.",
  "Move completed work to Under Review instead of Closed. The reviewer closes after checking.",
  "Add short progress notes whenever work is stuck. It reduces follow-up calls later.",
  "Keep task titles action-oriented, for example: Prepare GSTR-1 working for April.",
];

const navItems = [
  { id: "tasks" as const, label: "My Tasks", icon: ClipboardList },
  { id: "clients" as const, label: "Clients", icon: Building2 },
  { id: "team" as const, label: "Team", icon: Users },
  { id: "reports" as const, label: "Reports", icon: BarChart3 },
  { id: "admin" as const, label: "Admin", icon: ShieldCheck },
];

const statusTone: Record<TaskStatus, string> = {
  Open: "border-slate-200 bg-slate-50 text-slate-700",
  "In Progress": "border-blue-200 bg-blue-50 text-blue-700",
  "Pending Client": "border-amber-200 bg-amber-50 text-amber-800",
  "Pending Internal": "border-orange-200 bg-orange-50 text-orange-800",
  "Under Review": "border-violet-200 bg-violet-50 text-violet-700",
  Closed: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const priorityTone: Record<Task["priority"], string> = {
  Low: "text-slate-500",
  Normal: "text-slate-700",
  High: "text-amber-700",
  Urgent: "text-red-700",
};

export default function Home() {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("tasks");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [modal, setModal] = useState<Modal>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | TaskStatus>("All");
  const [taskList, setTaskList] = useState<Task[]>(seedTasks);
  const [clientList, setClientList] = useState<Client[]>(seedClients);
  const [teamList, setTeamList] = useState<TeamMember[]>(seedTeam);
  const [activity, setActivity] = useState<ActivityEvent[]>(initialActivityEvents);
  const [modules, setModules] = useState<ModuleFlag[]>(initialModuleFlags);
  const [isHydrated, setIsHydrated] = useState(false);
  const [loginTip, setLoginTip] = useState(loginTips[0]);

  useEffect(() => {
    try {
      legacyStorageKeys.forEach((key) => window.localStorage.removeItem(key));
      const raw = window.localStorage.getItem(workspaceStorageKey);
      if (raw) {
        const saved = JSON.parse(raw) as { tasks?: Task[]; clients?: Client[]; team?: TeamMember[]; activity?: ActivityEvent[]; modules?: ModuleFlag[] };
        if (saved.tasks) setTaskList(saved.tasks);
        if (saved.clients) setClientList(saved.clients);
        if (saved.team) setTeamList(saved.team);
        if (saved.activity) setActivity(saved.activity);
        if (saved.modules) setModules(saved.modules);
      }
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(workspaceStorageKey, JSON.stringify({ tasks: taskList, clients: clientList, team: teamList, activity, modules }));
  }, [activity, clientList, isHydrated, modules, taskList, teamList]);

  const user = teamList.find((member) => member.id === sessionUserId) ?? null;
  const selectedTask = taskList.find((task) => task.id === selectedTaskId) ?? null;
  const isPlatformOwner = user?.platformRole === "Platform Owner";
  const canCreateTask = Boolean(user && creatorRoles.includes(user.firmRole));

  const visibleTasks = useMemo(() => {
    if (!user) return [];
    return taskList.filter((task) => {
      const roleCanSeeFirm = isPlatformOwner || user.firmRole !== "Article/Staff";
      const staffCanSee = task.assigneeIds.includes(user.id) || task.reviewerId === user.id;
      const text = [task.title, clientName(clientList, task.clientId), task.status].join(" ").toLowerCase();
      return (roleCanSeeFirm || staffCanSee) && text.includes(query.toLowerCase()) && (statusFilter === "All" || task.status === statusFilter);
    });
  }, [clientList, isPlatformOwner, query, statusFilter, taskList, user]);

  const stats = useMemo(() => ({
    overdue: visibleTasks.filter((task) => task.status !== "Closed" && task.dueDate < todayIso).length,
    dueToday: visibleTasks.filter((task) => task.status !== "Closed" && task.dueDate === todayIso).length,
    underReview: visibleTasks.filter((task) => task.status === "Under Review").length,
    closed: visibleTasks.filter((task) => task.status === "Closed").length,
  }), [visibleTasks]);

  function log(actorId: string, action: string, entity: string, detail: string) {
    setActivity((current) => [{ id: "a_" + Date.now(), actorId, action, entity, detail, createdAt: "Just now" }, ...current]);
  }

  function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !canCreateTask) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const clientId = String(form.get("clientId") || "");
    const dueDate = String(form.get("dueDate") || "");
    const assigneeIds = form.getAll("assigneeIds").map(String);
    const reviewerId = String(form.get("reviewerId") || "");
    const priority = String(form.get("priority") || "Normal") as Task["priority"];
    const description = String(form.get("description") || "").trim();
    if (!title || !clientId || !dueDate || !reviewerId || assigneeIds.length === 0) return;
    const nextTask: Task = {
      id: "t_" + Date.now(), title, clientId, dueDate, status: "Open", priority,
      assigneeIds, reviewerId, createdById: user.id, updatedAt: "Just now", description,
      notes: [{ id: "n_" + Date.now(), authorId: user.id, text: "Task created.", createdAt: "Just now" }],
    };
    setTaskList((current) => [nextTask, ...current]);
    log(user.id, "Created task", "Task", title);
    setModal(null);
  }

  function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) return;
    const nextClient: Client = {
      id: "c_" + Date.now(), name, status: "Active",
      pan: textOrUndefined(form, "pan"), gstin: textOrUndefined(form, "gstin"),
      email: textOrUndefined(form, "email"), mobile: textOrUndefined(form, "mobile"),
    };
    setClientList((current) => [nextClient, ...current]);
    log(user.id, "Created client", "Client", name);
    setModal(null);
  }

  function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const email = normalizeEmail(String(form.get("email") || "").trim());
    const firmRole = String(form.get("firmRole") || "Article/Staff") as FirmRole;
    if (!name || !isTamsEmail(email)) return;
    const nextMember: TeamMember = { id: "u_" + Date.now(), name, email, firmRole, role: firmRole, platformRole: "Standard", lastActive: "Invited", isActive: true };
    setTeamList((current) => [nextMember, ...current]);
    log(user.id, "Created user", "User", name + " - " + firmRole);
    setModal(null);
  }

  function addNote(taskId: string, text: string) {
    if (!user || !text.trim()) return;
    setTaskList((current) => current.map((task) => task.id === taskId ? {
      ...task,
      updatedAt: "Just now",
      notes: [{ id: "n_" + Date.now(), authorId: user.id, text: text.trim(), createdAt: "Just now" }, ...task.notes],
    } : task));
    log(user.id, "Added progress note", "Task", taskTitle(taskList, taskId));
  }

  function moveTask(taskId: string, nextStatus: TaskStatus, remarks?: string) {
    if (!user) return;
    const before = taskList.find((task) => task.id === taskId);
    if (!before || before.status === nextStatus) return;
    setTaskList((current) => current.map((task) => task.id === taskId ? {
      ...task,
      status: nextStatus,
      updatedAt: "Just now",
      closedAt: nextStatus === "Closed" ? "Just now" : task.closedAt,
      closureRemarks: nextStatus === "Closed" ? remarks : task.closureRemarks,
      notes: [{
        id: "n_" + Date.now(), authorId: user.id,
        text: nextStatus === "Closed" ? "Closed after review. " + (remarks ?? "") : "Status moved to " + nextStatus + ".",
        createdAt: "Just now", oldStatus: task.status, newStatus: nextStatus,
      }, ...task.notes],
    } : task));
    log(user.id, "Moved task to " + nextStatus, "Task", before.title);
  }

  function toggleModule(moduleId: string) {
    if (!user || !isPlatformOwner) return;
    const item = modules.find((module) => module.id === moduleId);
    setModules((current) => current.map((module) => module.id === moduleId ? {
      ...module,
      enabled: !module.enabled,
      visibility: module.enabled ? "Hidden" : "Visible",
    } : module));
    log(user.id, "Changed module access", "ModuleFlag", item?.name ?? "Module");
  }

  async function login(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);
    if (!isTamsEmail(normalizedEmail)) return { ok: false, message: "Use your TAMS email ID ending with @tams.co.in." };
    if (password.length < 8) return { ok: false, message: "Password must be at least 8 characters." };
    const member = teamList.find((item) => normalizeEmail(item.email) === normalizedEmail && item.isActive);
    if (!member) return { ok: false, message: "No active TAMS user found for this email ID." };
    const digest = await digestPassword(normalizedEmail, password);
    if (member.passwordDigest && member.passwordDigest !== digest) return { ok: false, message: "Password does not match this TAMS user." };
    if (!member.passwordDigest) {
      setTeamList((current) => current.map((item) => item.id === member.id ? { ...item, passwordDigest: digest, lastActive: "Today" } : item));
    }
    setSessionUserId(member.id);
    setActiveSection("tasks");
    setSelectedTaskId(null);
    setModal(null);
    setLoginTip(loginTips[Math.floor(Math.random() * loginTips.length)]);
    return { ok: true };
  }

  function logout() {
    setSessionUserId(null);
    setActiveSection("tasks");
    setSelectedTaskId(null);
    setModal(null);
  }

  if (!user) return <LoginScreen onLogin={login} />;

  return (
    <main className="min-h-screen overflow-x-hidden text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar active={activeSection} setActive={setActiveSection} user={user} />
        <section className="flex min-w-0 flex-1 flex-col">
          <Header active={activeSection} canCreateTask={canCreateTask} open={setModal} setActive={setActiveSection} user={user} logout={logout} />
          <div className="p-4 md:p-6">
            <GuidanceNote title="Tip for effective usage" text={loginTip} />
            {activeSection === "tasks" && <TasksView stats={stats} tasks={visibleTasks} allTasks={taskList} clients={clientList} team={teamList} query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} view={viewMode} setView={setViewMode} openTask={setSelectedTaskId} user={user} />}
            {activeSection === "clients" && <ClientsView clients={clientList} tasks={taskList} open={() => setModal("client")} />}
            {activeSection === "team" && <TeamView team={teamList} user={user} open={() => setModal("team")} />}
            {activeSection === "reports" && <ReportsView tasks={taskList} clients={clientList} team={teamList} />}
            {activeSection === "admin" && <AdminView user={user} tasks={taskList} clients={clientList} team={teamList} activity={activity} modules={modules} toggleModule={toggleModule} openTeam={() => setModal("team")} />}
          </div>
        </section>
      </div>
      {modal === "task" && <TaskModal clients={clientList} team={teamList} close={() => setModal(null)} submit={createTask} />}
      {modal === "client" && <ClientModal close={() => setModal(null)} submit={createClient} />}
      {modal === "team" && <TeamModal close={() => setModal(null)} submit={createMember} />}
      {selectedTask && <TaskDrawer task={selectedTask} team={teamList} clients={clientList} user={user} close={() => setSelectedTaskId(null)} addNote={addNote} moveTask={moveTask} />}
    </main>
  );
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

  return <main className="flex min-h-screen items-center justify-center bg-[#070a12] p-4 text-slate-100">
    <section className="grid w-full max-w-6xl overflow-hidden rounded-xl border border-amber-200/15 bg-[#101623] shadow-2xl shadow-black/50 md:grid-cols-[1.08fr_0.92fr]">
      <div className="relative overflow-hidden bg-[#0b1020] p-8 text-white md:p-12">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-amber-200/25 bg-amber-200/10 text-amber-200"><ClipboardList size={24} /></div>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/80">TAMS-TKG workspace</p>
        <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-tight md:text-5xl">Disciplined task tracking for a modern CA firm.</h1>
        <p className="mt-5 max-w-xl text-sm leading-6 text-slate-300">Create work, assign responsibility, move it through review, and close with a clear record. The workspace starts simple and grows only when the firm is ready.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3"><Mini label="Work" value="Tasks" /><Mini label="Review" value="Closure" /><Mini label="Control" value="Admin" /></div>
        <div className="mt-8 rounded-lg border border-amber-200/15 bg-white/5 p-4" title="A small practice tip is shown before each login to help the team build better work habits.">
          <p className="text-xs font-semibold uppercase text-amber-200/80">Today&apos;s effectiveness tip</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{dailyTip}</p>
        </div>
      </div>
      <form className="bg-[#111827] p-6 md:p-10" noValidate onSubmit={submit}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/80">Secure workspace access</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Sign in with TAMS email</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">Use your official Google Workspace email ID and your workspace password. Access is restricted to active TAMS users.</p>
        <label className="mt-6 block text-sm font-medium text-slate-200" title="Only tams.co.in email IDs are accepted.">TAMS email ID</label>
        <input className="mt-2 w-full rounded-lg border border-slate-600 bg-[#0b1020] px-3 py-3 text-sm text-white outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-200/10" inputMode="email" name="email" placeholder="name@tams.co.in" required title="Enter your official @tams.co.in email ID" type="email" />
        <label className="mt-4 block text-sm font-medium text-slate-200" title="Use the password created for this workspace.">Password</label>
        <input className="mt-2 w-full rounded-lg border border-slate-600 bg-[#0b1020] px-3 py-3 text-sm text-white outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-200/10" minLength={8} name="password" placeholder="Enter password" required title="Enter your workspace password" type="password" />
        {error && <div className="mt-4 rounded-lg border border-red-300/30 bg-red-500/10 p-3 text-sm leading-5 text-red-100" role="alert">{error}</div>}
        <p className="mt-5 rounded-lg border border-slate-700 bg-slate-950/25 p-3 text-xs leading-5 text-slate-400">Guidance: If this is your first sign-in, the password you enter will become your workspace password for this TAMS profile.</p>
        <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-950/20 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting} title="Enter the TAMS-TKG task workspace" type="submit">{isSubmitting ? "Checking access..." : "Enter workspace"} <ShieldCheck size={18} /></button>
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

function Sidebar({ active, setActive, user }: { active: Section; setActive: (section: Section) => void; user: TeamMember }) {
  return <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white/90 px-4 py-5 shadow-sm backdrop-blur lg:block">
    <div className="mb-6 flex items-center gap-3 px-2"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white"><ClipboardList size={21} /></div><div><p className="text-sm font-semibold text-slate-950">TOS</p><p className="text-xs text-slate-500">Task Orchestration System</p></div></div>
    <nav className="space-y-1">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={(active === item.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950") + " flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition"} onClick={() => setActive(item.id)} type="button"><Icon size={18} />{item.label}</button>; })}</nav>
    <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">Firm workspace</p><p className="mt-2 text-sm font-semibold text-slate-900">{firm.name}</p><p className="mt-1 text-xs text-slate-500">{firm.status} - {firm.plan}</p></div>
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3"><p className="text-xs font-semibold uppercase text-blue-700">Signed in</p><p className="mt-2 text-sm font-semibold text-blue-950">{user.name}</p><p className="mt-1 text-xs text-blue-700">{user.platformRole === "Platform Owner" ? "Platform Owner" : user.firmRole}</p></div>
  </aside>;
}

function Header({ active, canCreateTask, logout, open, setActive, user }: { active: Section; canCreateTask: boolean; logout: () => void; open: (modal: Modal) => void; setActive: (section: Section) => void; user: TeamMember }) {
  const title = navItems.find((item) => item.id === active)?.label ?? "TOS";
  const nextModal: Modal = active === "clients" ? "client" : active === "team" ? "team" : "task";
  const canManageTeam = user.platformRole === "Platform Owner" || user.firmRole === "Firm Admin";
  const canUsePrimaryAction = active === "team" ? canManageTeam : active === "clients" ? canCreateTask : canCreateTask;
  const disabledReason = active === "team" ? "Only Platform Owner and Firm Admin can add users" : "Only Firm Admin, Partner, and Manager can create this record";
  return <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/86 px-4 py-3 backdrop-blur md:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-blue-700">TAMS-TKG workspace</p><h1 className="text-xl font-semibold text-slate-950 md:text-2xl">{title}</h1></div><div className="flex flex-wrap items-center gap-2"><span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:inline-flex">{user.name}</span><button aria-label="Notifications prepared for reminder layer" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400" disabled title="Notifications will activate with email reminders" type="button"><Bell size={18} /></button><button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" disabled={!canUsePrimaryAction} onClick={() => open(nextModal)} title={!canUsePrimaryAction ? disabledReason : undefined} type="button"><Plus size={18} />{active === "clients" ? "Add Client" : active === "team" ? "Add User" : "Create Task"}</button><button aria-label="Log out" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" onClick={logout} type="button"><LogOut size={18} /></button></div></div><nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Mobile workspace navigation">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={(active === item.id ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600") + " inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"} onClick={() => setActive(item.id)} type="button"><Icon size={16} />{item.label}</button>; })}</nav></header>;
}

function TasksView({ allTasks, clients, openTask, query, setQuery, setStatusFilter, setView, stats, statusFilter, tasks, team, user, view }: { allTasks: Task[]; clients: Client[]; openTask: (id: string) => void; query: string; setQuery: (value: string) => void; setStatusFilter: (value: "All" | TaskStatus) => void; setView: (value: ViewMode) => void; stats: { overdue: number; dueToday: number; underReview: number; closed: number }; statusFilter: "All" | TaskStatus; tasks: Task[]; team: TeamMember[]; user: TeamMember; view: ViewMode }) {
  return <div className="space-y-5"><div className="grid gap-3 md:grid-cols-4"><Metric label="Overdue" value={stats.overdue} icon={AlertTriangle} tone="red" /><Metric label="Due today" value={stats.dueToday} icon={CalendarDays} tone="amber" /><Metric label="Under review" value={stats.underReview} icon={Eye} tone="violet" /><Metric label="Closed" value={stats.closed} icon={CheckCircle2} tone="emerald" /></div><div className="rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4"><div><h2 className="font-semibold text-slate-950">My task queue</h2><p className="text-sm text-slate-500">{user.firmRole === "Article/Staff" ? "Update assigned work and move it to review." : "Create, assign, review, and close work."}</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex min-w-64 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Search size={17} className="text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search task, client, or status" value={query} onChange={(event) => setQuery(event.target.value)} /></div><select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "All" | TaskStatus)}><option>All</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select><div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1"><button className={(view === "list" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600") + " inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium"} onClick={() => setView("list")} type="button"><List size={16} />List</button><button className={(view === "kanban" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600") + " inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium"} onClick={() => setView("kanban")} type="button"><LayoutGrid size={16} />Kanban</button></div></div></div>{view === "list" ? <TaskTable clients={clients} openTask={openTask} tasks={tasks} team={team} /> : <Kanban clients={clients} openTask={openTask} tasks={allTasks} team={team} />}</div></div>;
}

function Metric({ icon: Icon, label, tone, value }: { icon: typeof AlertTriangle; label: string; tone: "red" | "amber" | "violet" | "emerald"; value: number }) {
  const toneClass = { red: "bg-red-50 text-red-700 border-red-100", amber: "bg-amber-50 text-amber-700 border-amber-100", violet: "bg-violet-50 text-violet-700 border-violet-100", emerald: "bg-emerald-50 text-emerald-700 border-emerald-100" }[tone];
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className={toneClass + " inline-flex h-9 w-9 items-center justify-center rounded-lg border"}><Icon size={18} /></span></div><p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p></div>;
}

function TaskTable({ clients, openTask, tasks, team }: { clients: Client[]; openTask: (id: string) => void; tasks: Task[]; team: TeamMember[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[980px] border-collapse text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3 font-semibold" title="Task title entered by the creator.">Task</th><th className="px-4 py-3 font-semibold" title="Client linked to the task.">Client</th><th className="px-4 py-3 font-semibold" title="Current workflow stage.">Status</th><th className="px-4 py-3 font-semibold" title="Due date and urgency.">Due</th><th className="px-4 py-3 font-semibold" title="People responsible for doing the work.">Assignees</th><th className="px-4 py-3 font-semibold" title="Person responsible for review and closure.">Reviewer</th><th className="px-4 py-3 font-semibold" title="Priority selected by the creator.">Priority</th><th className="px-4 py-3 font-semibold" title="Open the task detail panel.">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{tasks.length === 0 && <tr><td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={8}>No tasks yet. Add a client first, then create the first task with only the required details.</td></tr>}{tasks.map((task) => { const due = dueState(task); return <tr key={task.id} className="hover:bg-slate-50/70" title="Open this task to update status, notes, and review closure."><td className="px-4 py-3 font-medium text-slate-950">{task.title}</td><td className="px-4 py-3 text-slate-600">{clientName(clients, task.clientId)}</td><td className="px-4 py-3"><StatusPill status={task.status} /></td><td className="px-4 py-3"><span className={due.tone + " font-medium"}>{due.label}</span><div className="text-xs text-slate-500">{task.dueDate}</div></td><td className="px-4 py-3 text-slate-600">{task.assigneeIds.map((id) => userName(team, id)).join(", ")}</td><td className="px-4 py-3 text-slate-600">{userName(team, task.reviewerId)}</td><td className={priorityTone[task.priority] + " px-4 py-3 font-semibold"}>{task.priority}</td><td className="px-4 py-3"><button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => openTask(task.id)} title="View task details and workflow actions" type="button">View</button></td></tr>; })}</tbody></table></div>;
}

function Kanban({ clients, openTask, tasks, team }: { clients: Client[]; openTask: (id: string) => void; tasks: Task[]; team: TeamMember[] }) {
  return <div className="grid gap-3 overflow-x-auto p-4 lg:grid-cols-3 xl:grid-cols-6">{statuses.map((status) => <div key={status} className="min-h-72 rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-800">{status}</h3><span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">{tasks.filter((task) => task.status === status).length}</span></div><div className="space-y-2">{tasks.filter((task) => task.status === status).map((task) => <button key={task.id} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-blue-200 hover:bg-blue-50/40" onClick={() => openTask(task.id)} type="button"><p className="text-sm font-semibold text-slate-950">{task.title}</p><p className="mt-1 text-xs text-slate-500">{clientName(clients, task.clientId)}</p><p className="mt-2 text-xs text-slate-500">{task.assigneeIds.map((id) => userName(team, id)).join(", ")}</p><div className="mt-3 flex items-center justify-between text-xs"><span className={dueState(task).tone}>{dueState(task).label}</span><span className={priorityTone[task.priority]}>{task.priority}</span></div></button>)}</div></div>)}</div>;
}

function ClientsView({ clients, open, tasks }: { clients: Client[]; open: () => void; tasks: Task[] }) {
  return <Panel title="Client master" subtitle="Client name is required. PAN, GSTIN, email, and mobile stay optional." action="Add Client" onAction={open}><div className="divide-y divide-slate-100">{clients.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No clients added yet. Add the first client to unlock task creation against that client.</div>}{clients.map((client) => <div key={client.id} className="grid gap-2 p-4 md:grid-cols-[1.2fr_0.8fr_0.8fr_1fr_0.7fr]" title="Client record with optional statutory and contact details."><div><p className="font-semibold text-slate-950">{client.name}</p><p className="text-xs text-slate-500">{tasks.filter((task) => task.clientId === client.id).length} linked tasks</p></div><p className="text-sm text-slate-600">PAN: {client.pan ?? "Optional"}</p><p className="text-sm text-slate-600">GSTIN: {client.gstin ?? "Optional"}</p><p className="text-sm text-slate-600">{client.email ?? client.mobile ?? "No contact added"}</p><span className="inline-flex w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700" title="Client status">{client.status}</span></div>)}</div></Panel>;
}

function TeamView({ open, team, user }: { open: () => void; team: TeamMember[]; user: TeamMember }) {
  const canManage = user.platformRole === "Platform Owner" || user.firmRole === "Firm Admin";
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div><h2 className="font-semibold text-slate-950">Team and roles</h2><p className="text-sm text-slate-500">Firm Admin, Partner, Manager, and Article/Staff are active for Phase 1.</p></div><button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50" disabled={!canManage} onClick={open} type="button">Add User</button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{team.map((member) => <div key={member.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{member.name}</p><p className="mt-1 text-sm text-slate-500">{member.email}</p></div><UserCog className="text-blue-600" size={19} /></div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm"><span className="font-medium text-slate-700">{member.platformRole === "Platform Owner" ? "Platform Owner" : member.firmRole}</span><span className="text-slate-500">{member.lastActive}</span></div></div>)}</div></div>;
}

function ReportsView({ clients, tasks, team }: { clients: Client[]; tasks: Task[]; team: TeamMember[] }) {
  const active = tasks.filter((task) => task.status !== "Closed");
  const overdue = active.filter((task) => task.dueDate < todayIso).length;
  const busiest = tasks.length === 0 ? null : [...team].sort((a, b) => tasks.filter((task) => task.assigneeIds.includes(b.id)).length - tasks.filter((task) => task.assigneeIds.includes(a.id)).length)[0];
  return <div className="space-y-4"><div className="grid gap-3 md:grid-cols-4"><ReportPanel title="Active tasks" value={String(active.length)} detail="Open through review" icon={ClipboardList} /><ReportPanel title="Overdue" value={String(overdue)} detail="Needs attention" icon={AlertTriangle} /><ReportPanel title="Review queue" value={String(tasks.filter((task) => task.status === "Under Review").length)} detail="Pending closure" icon={Eye} /><ReportPanel title="Top workload" value={busiest?.name ?? "None"} detail="Assignee load" icon={Users} /></div><div className="grid gap-4 xl:grid-cols-2"><div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold text-slate-950">Status distribution</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{statuses.map((status) => <div key={status} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500">{status}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{tasks.filter((task) => task.status === status).length}</p></div>)}</div></div><div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold text-slate-950">Client-wise workload</h2><div className="mt-4 space-y-3">{clients.map((client) => <div key={client.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"><span className="font-medium text-slate-700">{client.name}</span><span className="font-semibold text-slate-950">{tasks.filter((task) => task.clientId === client.id && task.status !== "Closed").length} active</span></div>)}</div></div></div></div>;
}

function AdminView({ activity, clients, modules, openTeam, tasks, team, toggleModule, user }: { activity: ActivityEvent[]; clients: Client[]; modules: ModuleFlag[]; openTeam: () => void; tasks: Task[]; team: TeamMember[]; toggleModule: (id: string) => void; user: TeamMember }) {
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
          <h2 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight md:text-4xl">Control TAMS-TKG with visibility, governance, and calm operational discipline.</h2>
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
            <Sparkles className="animate-pulse text-amber-200" size={20} />
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

      <AdminPanel title="User Administration" subtitle="Role visibility, access readiness, and quick owner actions." icon={UserCog}>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45" disabled={!owner && user.firmRole !== "Firm Admin"} onClick={openTeam} title="Add a new team member" type="button"><UserPlus size={16} /> Add user</button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" disabled title="View-as mode is prepared for the next admin layer." type="button"><Eye size={16} /> View-as</button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" disabled title="Exports are planned for firm owner reporting." type="button"><FileDown size={16} /> Export</button>
        </div>
        <div className="mt-5 space-y-3">
          {roleRows.map((row) => <div key={row.role} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2" title={`${row.role}: ${row.users} user${row.users === 1 ? "" : "s"}`}>
            <div className="flex items-center gap-3"><RoleBadge role={row.role} /><span className="text-sm font-semibold text-slate-800">{row.role}</span></div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{row.users}</span>
          </div>)}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {team.map((member) => <div key={member.id} className="rounded-lg border border-slate-100 bg-white p-3" title="Team access and status">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-950">{member.name}</p><p className="mt-1 text-xs text-slate-500">{member.email}</p></div><span className={(member.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600") + " rounded-full px-2 py-1 text-xs font-semibold"}>{member.isActive ? "Active" : "Inactive"}</span></div>
            <p className="mt-3 text-xs font-medium text-slate-500">{member.platformRole === "Platform Owner" ? "Platform Owner" : member.firmRole} - {member.lastActive}</p>
          </div>)}
        </div>
      </AdminPanel>
    </section>

    <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <AdminPanel title="Module Governance" subtitle="Turn advanced modules on only when the firm is ready to use them." icon={SlidersHorizontal}>
        <div className="grid gap-3 md:grid-cols-2">
          {modules.map((item) => <ModuleControlCard key={item.id} item={item} owner={owner} toggleModule={toggleModule} />)}
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
        <ActivityTimeline activity={activity} team={team} />
      </AdminPanel>
      <AdminPanel title="Release Readiness" subtitle="Simple governance checklist for first client deployment." icon={Settings}>
        <div className="space-y-3">
          <ActionTile done label="Core task tracking" text="Create, assign, review, and close tasks." />
          <ActionTile done label="Client master" text="Minimum client record before task creation." />
          <ActionTile done={modules.find((module) => module.id === "m_reports")?.enabled ?? false} label="Reports visibility" text="Analytics visible to admin and manager roles." />
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

function ModuleControlCard({ item, owner, toggleModule }: { item: ModuleFlag; owner: boolean; toggleModule: (id: string) => void }) {
  return <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 transition hover:border-slate-200 hover:bg-white" title={`${item.name}: ${item.visibility}`}>
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-sm font-semibold text-slate-900">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.key}</p></div>
      <button className={(item.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700") + " rounded-full px-3 py-1 text-xs font-semibold transition hover:scale-105 disabled:hover:scale-100"} disabled={!owner} onClick={() => toggleModule(item.id)} title={owner ? `Toggle ${item.name}` : "Only Platform Owner can change module access"} type="button">{item.enabled ? "Enabled" : "Hidden"}</button>
    </div>
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white"><div className={(item.enabled ? "w-full bg-emerald-500" : "w-1/3 bg-slate-300") + " h-full rounded-full transition-all duration-500"} /></div>
  </div>;
}

function ActivityTimeline({ activity, team }: { activity: ActivityEvent[]; team: TeamMember[] }) {
  if (activity.length === 0) return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">No activity yet. User actions, task movements, and module changes will appear here automatically.</div>;
  return <div className="space-y-3">
    {activity.slice(0, 8).map((event) => <div key={event.id} className="relative rounded-lg border border-slate-100 bg-slate-50 p-3 pl-10 text-sm" title={`${event.action}: ${event.detail}`}>
      <span className="absolute left-3 top-4 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
      <p className="font-semibold text-slate-900">{event.action}</p>
      <p className="mt-1 text-slate-600">{event.detail}</p>
      <p className="mt-1 text-xs text-slate-500">{userName(team, event.actorId)} - {event.createdAt}</p>
    </div>)}
  </div>;
}

function ActionTile({ done, label, text }: { done: boolean; label: string; text: string }) {
  return <div className={(done ? "border-emerald-100 bg-emerald-50" : "border-amber-100 bg-amber-50") + " flex items-start gap-3 rounded-lg border p-3"} title={text}>
    <span className={(done ? "bg-emerald-600 text-white" : "bg-amber-500 text-white") + " mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full"}>{done ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}</span>
    <div><p className={(done ? "text-emerald-950" : "text-amber-950") + " text-sm font-semibold"}>{label}</p><p className={(done ? "text-emerald-700" : "text-amber-800") + " mt-1 text-xs leading-5"}>{text}</p></div>
  </div>;
}

function Panel({ action, children, onAction, subtitle, title }: { action: string; children: React.ReactNode; onAction: () => void; subtitle: string; title: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white shadow-sm" title={subtitle}><div className="flex items-center justify-between border-b border-slate-200 p-4"><div><h2 className="font-semibold text-slate-950">{title}</h2><p className="text-sm text-slate-500">{subtitle}</p></div><button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={onAction} title={action} type="button">{action}</button></div>{children}</div>;
}

function ReportPanel({ detail, icon: Icon, title, value }: { detail: string; icon: typeof ClipboardList; title: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" title={`${title}: ${detail}`}><Icon className="text-blue-600" size={20} /><p className="mt-4 text-sm font-medium text-slate-500">{title}</p><p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-sm text-slate-500">{detail}</p></div>;
}

function OwnerTool({ icon: Icon, label, text }: { icon: typeof Eye; label: string; text: string }) {
  return <div className="rounded-lg border border-slate-100 bg-slate-50 p-3" title={text}><Icon className="text-blue-600" size={18} /><p className="mt-3 text-sm font-semibold text-slate-950">{label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>;
}

function TaskModal({ clients, close, submit, team }: { clients: Client[]; close: () => void; submit: (event: FormEvent<HTMLFormElement>) => void; team: TeamMember[] }) {
  if (clients.length === 0) return <ModalFrame title="Create task" subtitle="Add one client before creating tasks." close={close}><div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900" title="Tasks must be linked to a client for clean tracking.">Guidance: First add the client in Client master. Then return here and create the task with only title, client, due date, assignee, and reviewer.</div><div className="mt-4 flex justify-end"><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={close} type="button">Close</button></div></ModalFrame>;
  return <ModalFrame title="Create task" subtitle="Required fields first. Optional details stay tucked away." close={close}><form className="space-y-4" onSubmit={submit}><Field label="Task title" name="title" required /><div className="grid gap-4 md:grid-cols-2"><Select label="Client" name="clientId" required><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select><Field label="Due date" name="dueDate" required type="date" /></div><div className="grid gap-4 md:grid-cols-2"><label className="block"><span className="text-sm font-medium text-slate-700">Assignees</span><select className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" name="assigneeIds" multiple required>{team.filter((member) => member.firmRole !== "Firm Admin").map((member) => <option key={member.id} value={member.id}>{member.name} - {member.firmRole}</option>)}</select><span className="mt-1 block text-xs text-slate-500">Hold Ctrl to select multiple people.</span></label><div className="space-y-4"><Select label="Reviewer" name="reviewerId" required><option value="">Select reviewer</option>{team.filter((member) => member.firmRole !== "Article/Staff").map((member) => <option key={member.id} value={member.id}>{member.name} - {member.firmRole}</option>)}</Select><Select label="Priority" name="priority"><option>Low</option><option>Normal</option><option>High</option><option>Urgent</option></Select></div></div><textarea className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" name="description" placeholder="More details, optional" /><Actions close={close} label="Create Task" /></form></ModalFrame>;
}

function ClientModal({ close, submit }: { close: () => void; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <ModalFrame title="Add client" subtitle="Only client name is compulsory." close={close}><form className="space-y-4" onSubmit={submit}><Field label="Client name" name="name" required /><div className="grid gap-4 md:grid-cols-2"><Field label="PAN" name="pan" /><Field label="GSTIN" name="gstin" /><Field label="Email" name="email" type="email" /><Field label="Mobile/contact" name="mobile" /></div><Actions close={close} label="Add Client" /></form></ModalFrame>;
}

function TeamModal({ close, submit }: { close: () => void; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <ModalFrame title="Add team member" subtitle="Use official TAMS email IDs only. Password is created by the user on first sign-in." close={close}><form className="space-y-4" onSubmit={submit}><Field label="Name" name="name" required /><Field label="TAMS email" name="email" pattern="^[^\\s@]+@tams\\.co\\.in$" placeholder="name@tams.co.in" required type="email" /><Select label="Role" name="firmRole"><option>Firm Admin</option><option>Partner</option><option>Manager</option><option>Article/Staff</option></Select><Actions close={close} label="Add User" /></form></ModalFrame>;
}

function TaskDrawer({ addNote, clients, close, moveTask, task, team, user }: { addNote: (taskId: string, note: string) => void; clients: Client[]; close: () => void; moveTask: (taskId: string, status: TaskStatus, remarks?: string) => void; task: Task; team: TeamMember[]; user: TeamMember }) {
  const [note, setNote] = useState("");
  const [remarks, setRemarks] = useState("");
  const assignee = task.assigneeIds.includes(user.id);
  const reviewer = task.reviewerId === user.id || user.firmRole === "Firm Admin" || user.platformRole === "Platform Owner";
  const canUpdate = assignee || reviewer || task.createdById === user.id;
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35"><aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><div><button className="mb-2 text-sm font-semibold text-slate-600 hover:text-slate-950" onClick={close} type="button">Back</button><h2 className="text-xl font-semibold text-slate-950">{task.title}</h2><p className="mt-1 text-sm text-slate-500">{clientName(clients, task.clientId)}</p></div><StatusPill status={task.status} /></div><div className="space-y-5 p-5"><div className="grid gap-3 md:grid-cols-2"><Info label="Due date" value={task.dueDate + " - " + dueState(task).label} /><Info label="Priority" value={task.priority} /><Info label="Assignees" value={task.assigneeIds.map((id) => userName(team, id)).join(", ")} /><Info label="Reviewer" value={userName(team, task.reviewerId)} /></div>{task.description && <Info label="Description" value={task.description} />}<div className="rounded-lg border border-slate-200 bg-white p-4"><h3 className="font-semibold text-slate-950">Workflow actions</h3><div className="mt-3 flex flex-wrap gap-2"><Workflow disabled={!canUpdate || task.status === "Closed"} label="Start / resume" action={() => moveTask(task.id, "In Progress")} /><Workflow disabled={!canUpdate || task.status === "Closed"} label="Pending client" action={() => moveTask(task.id, "Pending Client")} /><Workflow disabled={!canUpdate || task.status === "Closed"} label="Pending internal" action={() => moveTask(task.id, "Pending Internal")} /><Workflow disabled={!assignee || task.status === "Closed"} label="Move to review" action={() => moveTask(task.id, "Under Review")} /><Workflow disabled={!reviewer || task.status !== "Under Review"} label="Send back" action={() => moveTask(task.id, "In Progress")} /></div><div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3"><label className="block text-sm font-medium text-slate-700">Closure remarks</label><textarea className="mt-2 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Required before reviewer closes the task" /><button className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50" disabled={!reviewer || task.status !== "Under Review" || !remarks.trim()} onClick={() => moveTask(task.id, "Closed", remarks.trim())} type="button">Close after review</button></div></div><div className="rounded-lg border border-slate-200 bg-white p-4"><h3 className="font-semibold text-slate-950">Progress notes</h3><form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); addNote(task.id, note); setNote(""); }}><input className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" disabled={!canUpdate} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add progress note" /><button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!canUpdate || !note.trim()} type="submit">Add</button></form><div className="mt-4 space-y-3">{task.notes.map((item) => <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"><p className="text-slate-700">{item.text}</p><p className="mt-2 text-xs text-slate-500">{item.authorId ? userName(team, item.authorId) : item.author} - {item.createdAt}{item.newStatus ? " - " + (item.oldStatus ?? "Status") + " to " + item.newStatus : ""}</p></div>)}</div></div>{task.closureRemarks && <Info label="Closure remarks" value={task.closureRemarks} />}</div></aside></div>;
}

function ModalFrame({ children, close, subtitle, title }: { children: React.ReactNode; close: () => void; subtitle: string; title: string }) {
  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 sm:items-center"><div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"><div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-lg font-semibold text-slate-950">{title}</h2><p className="text-sm text-slate-500">{subtitle}</p></div><button aria-label="Close modal" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={close} type="button"><X size={18} /></button></div><div className="overflow-y-auto p-5">{children}</div></div></div>;
}

function Field({ label, name, pattern, placeholder, required, type = "text" }: { label: string; name: string; pattern?: string; placeholder?: string; required?: boolean; type?: string }) {
  return <label className="block" title={required ? `${label} is required.` : `${label} is optional.`}><span className="text-sm font-medium text-slate-700">{label}{required ? " *" : ""}</span><input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" name={name} pattern={pattern} placeholder={placeholder ?? (required ? "Required" : "Optional")} required={required} title={required ? `${label} is required.` : `${label} is optional.`} type={type} /></label>;
}

function Select({ children, label, name, required }: { children: React.ReactNode; label: string; name: string; required?: boolean }) {
  return <label className="block" title={required ? `${label} is required.` : `${label} is optional.`}><span className="text-sm font-medium text-slate-700">{label}{required ? " *" : ""}</span><select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" defaultValue="" name={name} required={required} title={required ? `${label} is required.` : `${label} is optional.`}>{children}</select></label>;
}

function Actions({ close, label }: { close: () => void; label: string }) {
  return <div className="sticky bottom-0 -mx-5 -mb-5 mt-2 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4"><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={close} title="Close without saving" type="button">Cancel</button><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" title={label} type="submit">{label}</button></div>;
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

function userName(team: TeamMember[], id: string) {
  return team.find((member) => member.id === id)?.name ?? "Unknown user";
}

function taskTitle(tasks: Task[], id: string) {
  return tasks.find((task) => task.id === id)?.title ?? "Task";
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

function isTamsEmail(email: string) {
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+$/.test(normalized) && normalized.endsWith(tamsEmailDomain);
}

async function digestPassword(email: string, password: string) {
  const bytes = new TextEncoder().encode(`${normalizeEmail(email)}:${password}`);
  if (!crypto?.subtle) return fallbackDigest(bytes);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fallbackDigest(bytes: Uint8Array) {
  let hash = 2166136261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return `local-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
