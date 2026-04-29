"use client";

import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileDown,
  LayoutGrid,
  List,
  LockKeyhole,
  LogOut,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  clients as seedClients,
  initialFirmProfile,
  initialActivityEvents,
  initialModuleFlags,
  plans,
  statuses,
  tasks as seedTasks,
  teamMembers as seedTeam,
  type ActivityEvent,
  type Client,
  type FirmProfile,
  type FirmRole,
  type ModuleFlag,
  type Task,
  type TaskStatus,
  type TeamMember,
} from "@/lib/demo-data";
import {
  emailMatchesDomain,
  normalizeDomain,
  validateFirmDomain,
  validateUserForFirm,
  type GuardResult,
} from "@/lib/tenant-guard";

type Section = "tasks" | "clients" | "team" | "reports" | "admin";
type ViewMode = "list" | "kanban";
type Modal = "task" | "client" | "team" | "firm" | "firmCreate" | null;

type FirmWorkspace = {
  firm: FirmProfile;
  tasks: Task[];
  clients: Client[];
  team: TeamMember[];
  activity: ActivityEvent[];
  modules: ModuleFlag[];
};

type WorkspaceStore = {
  activeFirmId: string;
  firms: Record<string, FirmWorkspace>;
};

type ApiResult<T = unknown> = {
  ok: boolean;
  message?: string;
  data?: T;
};

const todayIso = "2026-04-26";
const uatStorageKey = "tos-workspace-v2";
const creatorRoles: FirmRole[] = ["Firm Admin", "Partner", "Manager"];

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

function buildWorkspace(firm: FirmProfile, withSeedData = false): FirmWorkspace {
  return {
    firm,
    tasks: withSeedData ? seedTasks : [],
    clients: withSeedData ? seedClients : [],
    team: withSeedData
      ? seedTeam
      : [{
        id: "u_owner",
        name: "Platform Owner",
        email: "owner@tos.local",
        firmRole: "Firm Admin",
        role: "Firm Admin",
        platformRole: "Platform Owner",
        lastActive: "Today",
        isActive: true,
      }],
    activity: withSeedData ? initialActivityEvents : [],
    modules: initialModuleFlags.map((item) => ({ ...item })),
  };
}

export default function Home() {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("tasks");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [modal, setModal] = useState<Modal>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | TaskStatus>("All");
  const [teamFormError, setTeamFormError] = useState<string>("");
  const [firmFormError, setFirmFormError] = useState<string>("");
  const [activeFirmId, setActiveFirmId] = useState<string>(initialFirmProfile.id);
  const [firmWorkspaces, setFirmWorkspaces] = useState<Record<string, FirmWorkspace>>({
    [initialFirmProfile.id]: buildWorkspace(initialFirmProfile, true),
  });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(uatStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WorkspaceStore> & { firm?: FirmProfile; tasks?: Task[]; clients?: Client[]; team?: TeamMember[]; activity?: ActivityEvent[]; modules?: ModuleFlag[] };
        if (parsed.firms && parsed.activeFirmId && parsed.firms[parsed.activeFirmId]) {
          setActiveFirmId(parsed.activeFirmId);
          setFirmWorkspaces(parsed.firms);
        } else {
          const legacyFirm = parsed.firm ?? initialFirmProfile;
          const legacyWorkspace: FirmWorkspace = {
            firm: legacyFirm,
            tasks: parsed.tasks ?? seedTasks,
            clients: parsed.clients ?? seedClients,
            team: parsed.team ?? seedTeam,
            activity: parsed.activity ?? initialActivityEvents,
            modules: parsed.modules ?? initialModuleFlags,
          };
          setActiveFirmId(legacyFirm.id);
          setFirmWorkspaces({ [legacyFirm.id]: legacyWorkspace });
        }
      }
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const payload: WorkspaceStore = {
      activeFirmId,
      firms: firmWorkspaces,
    };
    window.localStorage.setItem(uatStorageKey, JSON.stringify(payload));
  }, [activeFirmId, firmWorkspaces, isHydrated]);

  const activeWorkspace = firmWorkspaces[activeFirmId] ?? buildWorkspace(initialFirmProfile, true);
  const firmProfile = activeWorkspace.firm;
  const taskList = activeWorkspace.tasks;
  const clientList = activeWorkspace.clients;
  const teamList = activeWorkspace.team;
  const activity = activeWorkspace.activity;
  const modules = activeWorkspace.modules;

  const user = teamList.find((member) => member.id === sessionUserId) ?? null;
  const selectedTask = taskList.find((task) => task.id === selectedTaskId) ?? null;
  const isPlatformOwner = user?.platformRole === "Platform Owner";
  const canCreateTask = Boolean(user && creatorRoles.includes(user.firmRole));
  const canManageMaster = Boolean(user && (user.platformRole === "Platform Owner" || user.firmRole === "Firm Admin"));
  const shouldForceFirmSetup = Boolean(canManageMaster && !firmProfile.onboardingCompleted);
  const requiredFirmDomain = normalizeDomain(firmProfile.emailDomain);

  function updateActiveWorkspace(next: (current: FirmWorkspace) => FirmWorkspace) {
    setFirmWorkspaces((current) => ({
      ...current,
      [activeFirmId]: next(current[activeFirmId] ?? buildWorkspace(initialFirmProfile, true)),
    }));
  }

  function switchFirm(nextFirmId: string) {
    if (nextFirmId === activeFirmId || !firmWorkspaces[nextFirmId]) return;
    setActiveFirmId(nextFirmId);
    setSessionUserId(null);
    setSelectedTaskId(null);
    setTeamFormError("");
    setFirmFormError("");
    setModal(null);
    setActiveSection("tasks");
    setStatusFilter("All");
    setQuery("");
  }

  async function validateUserOnServer(email: string, firmDomain: string, isOwner = false): Promise<GuardResult> {
    try {
      const response = await fetch("/api/tenant/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "user", payload: { email, firmDomain, isPlatformOwner: isOwner } }),
      });
      const result = await response.json() as GuardResult;
      return result;
    } catch {
      return validateUserForFirm(email, firmDomain, isOwner);
    }
  }

  async function validateDomainOnServer(domain: string): Promise<GuardResult> {
    try {
      const response = await fetch("/api/tenant/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "domain", payload: { domain } }),
      });
      const result = await response.json() as GuardResult;
      return result;
    } catch {
      return validateFirmDomain(domain);
    }
  }

  async function requestApi<T>(url: string, method: "POST" | "PATCH", body: unknown): Promise<ApiResult<T>> {
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json() as Record<string, unknown>;
      if (response.ok) {
        return { ok: true, data: json as T };
      }
      return { ok: false, message: String(json.message ?? "Request failed.") };
    } catch {
      return { ok: false, message: "Network error." };
    }
  }

  async function loginToWorkspace(memberId: string): Promise<GuardResult> {
    const member = teamList.find((item) => item.id === memberId);
    if (!member) {
      return { ok: false, message: "User not found in selected firm workspace." };
    }
    const accessCheck = await requestApi(`/api/firms/${activeFirmId}/access`, "POST", { userId: memberId });
    if (!accessCheck.ok && accessCheck.message && accessCheck.message !== "DATABASE_URL is not configured.") {
      return { ok: false, message: accessCheck.message };
    }
    const validation = await validateUserOnServer(member.email, requiredFirmDomain, member.platformRole === "Platform Owner");
    if (!validation.ok) {
      return validation;
    }
    setSessionUserId(memberId);
    return { ok: true };
  }

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
    updateActiveWorkspace((current) => ({
      ...current,
      activity: [{ id: "a_" + Date.now(), actorId, action, entity, detail, createdAt: "Just now" }, ...current.activity],
    }));
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
    updateActiveWorkspace((current) => ({ ...current, tasks: [nextTask, ...current.tasks] }));
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
    updateActiveWorkspace((current) => ({ ...current, clients: [nextClient, ...current.clients] }));
    log(user.id, "Created client", "Client", name);
    setModal(null);
  }

  async function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const firmRole = String(form.get("firmRole") || "Article/Staff") as FirmRole;
    if (!name || !email) return;
    const validation = await validateUserOnServer(email, requiredFirmDomain, false);
    if (!validation.ok) {
      setTeamFormError(validation.message ?? "User validation failed.");
      return;
    }
    const apiResult = await requestApi<{ member?: TeamMember }>(`/api/firms/${activeFirmId}/members`, "POST", {
      name,
      email,
      firmRole,
    });
    if (!apiResult.ok && apiResult.message && apiResult.message !== "DATABASE_URL is not configured.") {
      setTeamFormError(apiResult.message);
      return;
    }
    const nextMember: TeamMember = apiResult.data?.member ?? { id: "u_" + Date.now(), name, email, firmRole, role: firmRole, platformRole: "Standard", lastActive: "Invited", isActive: true };
    updateActiveWorkspace((current) => ({ ...current, team: [nextMember, ...current.team] }));
    log(user.id, "Created user", "User", name + " · " + firmRole);
    setTeamFormError("");
    setModal(null);
  }

  function addNote(taskId: string, text: string) {
    if (!user || !text.trim()) return;
    updateActiveWorkspace((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? {
      ...task,
      updatedAt: "Just now",
      notes: [{ id: "n_" + Date.now(), authorId: user.id, text: text.trim(), createdAt: "Just now" }, ...task.notes],
    } : task) }));
    log(user.id, "Added progress note", "Task", taskTitle(taskList, taskId));
  }

  function moveTask(taskId: string, nextStatus: TaskStatus, remarks?: string) {
    if (!user) return;
    const before = taskList.find((task) => task.id === taskId);
    if (!before || before.status === nextStatus) return;
    updateActiveWorkspace((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? {
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
    } : task) }));
    log(user.id, "Moved task to " + nextStatus, "Task", before.title);
  }

  function toggleModule(moduleId: string) {
    if (!user || !isPlatformOwner) return;
    const item = modules.find((module) => module.id === moduleId);
    updateActiveWorkspace((current) => ({ ...current, modules: current.modules.map((module) => module.id === moduleId ? {
      ...module,
      enabled: !module.enabled,
      visibility: module.enabled ? "Hidden" : "Visible",
    } : module) }));
    log(user.id, "Changed module access", "ModuleFlag", item?.name ?? "Module");
  }

  async function setupFirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const city = String(form.get("city") || "").trim();
    const plan = String(form.get("plan") || "").trim();
    const emailDomain = normalizeDomain(String(form.get("emailDomain") || ""));
    const status = String(form.get("status") || "Trial") as FirmProfile["status"];
    if (!name || !city || !plan) return;
    const domainValidation = await validateDomainOnServer(emailDomain);
    if (!domainValidation.ok) {
      setFirmFormError(domainValidation.message ?? "Invalid domain.");
      return;
    }
    const apiResult = await requestApi<{ firm?: FirmProfile }>(`/api/firms/${activeFirmId}`, "PATCH", {
      name,
      city,
      plan,
      status,
      emailDomain,
    });
    if (!apiResult.ok && apiResult.message && apiResult.message !== "DATABASE_URL is not configured.") {
      setFirmFormError(apiResult.message);
      return;
    }
    updateActiveWorkspace((current) => ({
      ...current,
      firm: apiResult.data?.firm ?? {
        ...current.firm,
        name,
        city,
        plan,
        status,
        emailDomain,
        onboardingCompleted: true,
      },
    }));
    log(user.id, "Updated firm master setup", "Firm", name);
    setFirmFormError("");
    setModal(null);
  }

  async function createFirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || user.platformRole !== "Platform Owner") return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const city = String(form.get("city") || "").trim();
    const plan = String(form.get("plan") || "").trim();
    const emailDomain = normalizeDomain(String(form.get("emailDomain") || ""));
    const status = String(form.get("status") || "Trial") as FirmProfile["status"];
    if (!name || !city || !plan) return;
    const domainValidation = await validateDomainOnServer(emailDomain);
    if (!domainValidation.ok) {
      setFirmFormError(domainValidation.message ?? "Invalid domain.");
      return;
    }
    const apiResult = await requestApi<{ firm?: FirmProfile }>("/api/firms", "POST", {
      name,
      city,
      plan,
      status,
      emailDomain,
    });
    if (!apiResult.ok && apiResult.message && apiResult.message !== "DATABASE_URL is not configured.") {
      setFirmFormError(apiResult.message);
      return;
    }
    const id = apiResult.data?.firm?.id ?? ("firm_" + Date.now());
    const nextFirm: FirmProfile = apiResult.data?.firm ?? {
      id,
      name,
      city,
      plan,
      status,
      emailDomain,
      onboardingCompleted: true,
    };
    setFirmWorkspaces((current) => ({
      ...current,
      [id]: buildWorkspace(nextFirm, false),
    }));
    setActiveFirmId(id);
    setSessionUserId(null);
    setSelectedTaskId(null);
    setFirmFormError("");
    setModal(null);
  }

  if (!user) return <LoginScreen
    activeFirmId={activeFirmId}
    firm={firmProfile}
    firms={Object.values(firmWorkspaces).map((workspace) => workspace.firm)}
    onFirmChange={switchFirm}
    onLogin={loginToWorkspace}
    team={teamList}
  />;

  return (
    <main className="min-h-screen text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar active={activeSection} firm={firmProfile} setActive={setActiveSection} user={user} />
        <section className="flex min-w-0 flex-1 flex-col">
          <Header
            active={activeSection}
            canCreateTask={canCreateTask}
            firm={firmProfile}
            firms={Object.values(firmWorkspaces).map((workspace) => workspace.firm)}
            activeFirmId={activeFirmId}
            onFirmChange={switchFirm}
            open={setModal}
            user={user}
            logout={() => setSessionUserId(null)}
          />
          <div className="p-4 md:p-6">
            {activeSection === "tasks" && <TasksView stats={stats} tasks={visibleTasks} allTasks={taskList} clients={clientList} team={teamList} query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} view={viewMode} setView={setViewMode} openTask={setSelectedTaskId} user={user} />}
            {activeSection === "clients" && <ClientsView clients={clientList} tasks={taskList} open={() => setModal("client")} />}
            {activeSection === "team" && <TeamView team={teamList} user={user} open={() => { setTeamFormError(""); setModal("team"); }} />}
            {activeSection === "reports" && <ReportsView tasks={taskList} clients={clientList} team={teamList} />}
            {activeSection === "admin" && <AdminView
              user={user}
              firm={firmProfile}
              firms={Object.values(firmWorkspaces).map((workspace) => workspace.firm)}
              activeFirmId={activeFirmId}
              onFirmChange={switchFirm}
              tasks={taskList}
              clients={clientList}
              team={teamList}
              activity={activity}
              modules={modules}
              toggleModule={toggleModule}
              openFirmSetup={() => { setFirmFormError(""); setModal("firm"); }}
              openCreateFirm={() => { setFirmFormError(""); setModal("firmCreate"); }}
            />}
          </div>
        </section>
      </div>
      {modal === "task" && <TaskModal clients={clientList} team={teamList} close={() => setModal(null)} submit={createTask} />}
      {modal === "client" && <ClientModal close={() => setModal(null)} submit={createClient} />}
      {modal === "team" && <TeamModal close={() => { setTeamFormError(""); setModal(null); }} domain={requiredFirmDomain} error={teamFormError} submit={createMember} />}
      {(modal === "firm" || shouldForceFirmSetup) && <FirmSetupModal close={() => { setFirmFormError(""); setModal(null); }} firm={firmProfile} error={firmFormError} submit={setupFirm} />}
      {modal === "firmCreate" && <FirmCreateModal close={() => { setFirmFormError(""); setModal(null); }} error={firmFormError} submit={createFirm} />}
      {selectedTask && <TaskDrawer task={selectedTask} team={teamList} clients={clientList} user={user} close={() => setSelectedTaskId(null)} addNote={addNote} moveTask={moveTask} />}
    </main>
  );
}

function LoginScreen({ activeFirmId, firm, firms, onFirmChange, onLogin, team }: { activeFirmId: string; firm: FirmProfile; firms: FirmProfile[]; onFirmChange: (firmId: string) => void; onLogin: (id: string) => Promise<GuardResult>; team: TeamMember[] }) {
  const [id, setId] = useState(team[0]?.id ?? "");
  const [loginError, setLoginError] = useState("");
  const selectedId = team.some((member) => member.id === id) ? id : (team[0]?.id ?? "");
  const selected = team.find((member) => member.id === selectedId);
  const requiredDomain = normalizeDomain(firm.emailDomain);
  const selectedAllowed = selected ? (selected.platformRole === "Platform Owner" || emailMatchesDomain(selected.email, requiredDomain)) : false;

  async function submitLogin() {
    if (!selectedId || !selectedAllowed) return;
    const result = await onLogin(selectedId);
    if (!result.ok) {
      setLoginError(result.message ?? "Login blocked by policy.");
      return;
    }
    setLoginError("");
  }
  return <main className="flex min-h-screen items-center justify-center p-4">
    <section className="grid w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl md:grid-cols-[1.1fr_0.9fr]">
      <div className="bg-blue-700 p-8 text-white md:p-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/15"><ClipboardList size={24} /></div>
        <h1 className="mt-8 max-w-lg text-3xl font-semibold leading-tight md:text-4xl">Task Orchestration System for CA/CPA firms.</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-blue-100">Structured task execution, reviewer control, and partner visibility with multi-firm readiness from day one.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3"><Mini label="Visible" value="Tasks" /><Mini label="Ready" value="SaaS" /><Mini label="Control" value="Admin" /></div>
      </div>
      <div className="p-6 md:p-8">
        <p className="text-xs font-semibold uppercase text-blue-700">Workspace access</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Choose a role</h2>
        <p className="mt-2 text-sm text-slate-500">{firm.name} · {firm.city}</p>
        <label className="mt-4 block text-sm font-medium text-slate-700">Firm workspace</label>
        <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={activeFirmId} onChange={(event) => { setLoginError(""); onFirmChange(event.target.value); }}>{firms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <label className="mt-6 block text-sm font-medium text-slate-700">User</label>
        <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={selectedId} onChange={(event) => { setLoginError(""); setId(event.target.value); }}>{team.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.platformRole === "Platform Owner" ? "Platform Owner" : member.firmRole}</option>)}</select>
        {selected && <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="font-semibold text-slate-950">{selected.name}</p><p className="mt-1 text-sm text-slate-600">{selected.email}</p>{requiredDomain && !selectedAllowed && <p className="mt-2 text-xs font-medium text-red-600">Access blocked: this user must use @{requiredDomain} for this firm.</p>}</div>}
        {loginError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{loginError}</p>}
        <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50" disabled={!selectedId || !selectedAllowed} onClick={submitLogin} type="button">Enter workspace <ShieldCheck size={18} /></button>
      </div>
    </section>
  </main>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/15 bg-white/10 p-3"><p className="text-xs text-blue-100">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}

function Sidebar({ active, firm, setActive, user }: { active: Section; firm: FirmProfile; setActive: (section: Section) => void; user: TeamMember }) {
  return <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white/90 px-4 py-5 shadow-sm backdrop-blur lg:block">
    <div className="mb-6 flex items-center gap-3 px-2"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white"><ClipboardList size={21} /></div><div><p className="text-sm font-semibold text-slate-950">TOS</p><p className="text-xs text-slate-500">Task Orchestration System</p></div></div>
    <nav className="space-y-1">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={(active === item.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950") + " flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition"} onClick={() => setActive(item.id)} type="button"><Icon size={18} />{item.label}</button>; })}</nav>
    <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">Firm workspace</p><p className="mt-2 text-sm font-semibold text-slate-900">{firm.name}</p><p className="mt-1 text-xs text-slate-500">{firm.status} · {firm.plan}</p></div>
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3"><p className="text-xs font-semibold uppercase text-blue-700">Signed in</p><p className="mt-2 text-sm font-semibold text-blue-950">{user.name}</p><p className="mt-1 text-xs text-blue-700">{user.platformRole === "Platform Owner" ? "Platform Owner" : user.firmRole}</p></div>
  </aside>;
}

function Header({ active, activeFirmId, canCreateTask, firm, firms, logout, onFirmChange, open, user }: { active: Section; activeFirmId: string; canCreateTask: boolean; firm: FirmProfile; firms: FirmProfile[]; logout: () => void; onFirmChange: (firmId: string) => void; open: (modal: Modal) => void; user: TeamMember }) {
  const title = navItems.find((item) => item.id === active)?.label ?? "TOS";
  const nextModal: Modal = active === "clients" ? "client" : active === "team" ? "team" : "task";
  return <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/86 px-4 py-3 backdrop-blur md:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-blue-700">{firm.name}</p><h1 className="text-xl font-semibold text-slate-950 md:text-2xl">{title}</h1></div><div className="flex flex-wrap items-center gap-2">{user.platformRole === "Platform Owner" && <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" value={activeFirmId} onChange={(event) => onFirmChange(event.target.value)}>{firms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}<span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:inline-flex">{user.name}</span><button className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" type="button"><Bell size={18} /></button><button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" disabled={active === "tasks" && !canCreateTask} onClick={() => open(nextModal)} type="button"><Plus size={18} />{active === "clients" ? "Add Client" : active === "team" ? "Add User" : "Create Task"}</button><button className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" onClick={logout} type="button"><LogOut size={18} /></button></div></div></header>;
}

function TasksView({ allTasks, clients, openTask, query, setQuery, setStatusFilter, setView, stats, statusFilter, tasks, team, user, view }: { allTasks: Task[]; clients: Client[]; openTask: (id: string) => void; query: string; setQuery: (value: string) => void; setStatusFilter: (value: "All" | TaskStatus) => void; setView: (value: ViewMode) => void; stats: { overdue: number; dueToday: number; underReview: number; closed: number }; statusFilter: "All" | TaskStatus; tasks: Task[]; team: TeamMember[]; user: TeamMember; view: ViewMode }) {
  return <div className="space-y-5"><div className="grid gap-3 md:grid-cols-4"><Metric label="Overdue" value={stats.overdue} icon={AlertTriangle} tone="red" /><Metric label="Due today" value={stats.dueToday} icon={CalendarDays} tone="amber" /><Metric label="Under review" value={stats.underReview} icon={Eye} tone="violet" /><Metric label="Closed" value={stats.closed} icon={CheckCircle2} tone="emerald" /></div><div className="rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4"><div><h2 className="font-semibold text-slate-950">My task queue</h2><p className="text-sm text-slate-500">{user.firmRole === "Article/Staff" ? "Update assigned work and move it to review." : "Create, assign, review, and close work."}</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex min-w-64 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Search size={17} className="text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search task, client, or status" value={query} onChange={(event) => setQuery(event.target.value)} /></div><select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "All" | TaskStatus)}><option>All</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select><div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1"><button className={(view === "list" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600") + " inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium"} onClick={() => setView("list")} type="button"><List size={16} />List</button><button className={(view === "kanban" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600") + " inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium"} onClick={() => setView("kanban")} type="button"><LayoutGrid size={16} />Kanban</button></div></div></div>{view === "list" ? <TaskTable clients={clients} openTask={openTask} tasks={tasks} team={team} /> : <Kanban clients={clients} openTask={openTask} tasks={allTasks} team={team} />}</div></div>;
}

function Metric({ icon: Icon, label, tone, value }: { icon: typeof AlertTriangle; label: string; tone: "red" | "amber" | "violet" | "emerald"; value: number }) {
  const toneClass = { red: "bg-red-50 text-red-700 border-red-100", amber: "bg-amber-50 text-amber-700 border-amber-100", violet: "bg-violet-50 text-violet-700 border-violet-100", emerald: "bg-emerald-50 text-emerald-700 border-emerald-100" }[tone];
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className={toneClass + " inline-flex h-9 w-9 items-center justify-center rounded-lg border"}><Icon size={18} /></span></div><p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p></div>;
}

function TaskTable({ clients, openTask, tasks, team }: { clients: Client[]; openTask: (id: string) => void; tasks: Task[]; team: TeamMember[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[980px] border-collapse text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3 font-semibold">Task</th><th className="px-4 py-3 font-semibold">Client</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Due</th><th className="px-4 py-3 font-semibold">Assignees</th><th className="px-4 py-3 font-semibold">Reviewer</th><th className="px-4 py-3 font-semibold">Priority</th><th className="px-4 py-3 font-semibold">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{tasks.map((task) => { const due = dueState(task); return <tr key={task.id} className="hover:bg-slate-50/70"><td className="px-4 py-3 font-medium text-slate-950">{task.title}</td><td className="px-4 py-3 text-slate-600">{clientName(clients, task.clientId)}</td><td className="px-4 py-3"><StatusPill status={task.status} /></td><td className="px-4 py-3"><span className={due.tone + " font-medium"}>{due.label}</span><div className="text-xs text-slate-500">{task.dueDate}</div></td><td className="px-4 py-3 text-slate-600">{task.assigneeIds.map((id) => userName(team, id)).join(", ")}</td><td className="px-4 py-3 text-slate-600">{userName(team, task.reviewerId)}</td><td className={priorityTone[task.priority] + " px-4 py-3 font-semibold"}>{task.priority}</td><td className="px-4 py-3"><button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => openTask(task.id)} type="button">Open</button></td></tr>; })}</tbody></table></div>;
}

function Kanban({ clients, openTask, tasks, team }: { clients: Client[]; openTask: (id: string) => void; tasks: Task[]; team: TeamMember[] }) {
  return <div className="grid gap-3 overflow-x-auto p-4 lg:grid-cols-3 xl:grid-cols-6">{statuses.map((status) => <div key={status} className="min-h-72 rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-800">{status}</h3><span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">{tasks.filter((task) => task.status === status).length}</span></div><div className="space-y-2">{tasks.filter((task) => task.status === status).map((task) => <button key={task.id} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-blue-200 hover:bg-blue-50/40" onClick={() => openTask(task.id)} type="button"><p className="text-sm font-semibold text-slate-950">{task.title}</p><p className="mt-1 text-xs text-slate-500">{clientName(clients, task.clientId)}</p><p className="mt-2 text-xs text-slate-500">{task.assigneeIds.map((id) => userName(team, id)).join(", ")}</p><div className="mt-3 flex items-center justify-between text-xs"><span className={dueState(task).tone}>{dueState(task).label}</span><span className={priorityTone[task.priority]}>{task.priority}</span></div></button>)}</div></div>)}</div>;
}

function ClientsView({ clients, open, tasks }: { clients: Client[]; open: () => void; tasks: Task[] }) {
  return <Panel title="Client master" subtitle="Client name is required. PAN, GSTIN, email, and mobile stay optional." action="Add Client" onAction={open}><div className="divide-y divide-slate-100">{clients.map((client) => <div key={client.id} className="grid gap-2 p-4 md:grid-cols-[1.2fr_0.8fr_0.8fr_1fr_0.7fr]"><div><p className="font-semibold text-slate-950">{client.name}</p><p className="text-xs text-slate-500">{tasks.filter((task) => task.clientId === client.id).length} linked tasks</p></div><p className="text-sm text-slate-600">PAN: {client.pan ?? "Optional"}</p><p className="text-sm text-slate-600">GSTIN: {client.gstin ?? "Optional"}</p><p className="text-sm text-slate-600">{client.email ?? client.mobile ?? "No contact added"}</p><span className="inline-flex w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{client.status}</span></div>)}</div></Panel>;
}

function TeamView({ open, team, user }: { open: () => void; team: TeamMember[]; user: TeamMember }) {
  const canManage = user.platformRole === "Platform Owner" || user.firmRole === "Firm Admin";
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div><h2 className="font-semibold text-slate-950">Team and roles</h2><p className="text-sm text-slate-500">Firm Admin, Partner, Manager, and Article/Staff are active for Phase 1.</p></div><button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50" disabled={!canManage} onClick={open} type="button">Add User</button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{team.map((member) => <div key={member.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{member.name}</p><p className="mt-1 text-sm text-slate-500">{member.email}</p></div><UserCog className="text-blue-600" size={19} /></div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm"><span className="font-medium text-slate-700">{member.platformRole === "Platform Owner" ? "Platform Owner" : member.firmRole}</span><span className="text-slate-500">{member.lastActive}</span></div></div>)}</div></div>;
}

function ReportsView({ clients, tasks, team }: { clients: Client[]; tasks: Task[]; team: TeamMember[] }) {
  const active = tasks.filter((task) => task.status !== "Closed");
  const overdue = active.filter((task) => task.dueDate < todayIso).length;
  const busiest = [...team].sort((a, b) => tasks.filter((task) => task.assigneeIds.includes(b.id)).length - tasks.filter((task) => task.assigneeIds.includes(a.id)).length)[0];
  return <div className="space-y-4"><div className="grid gap-3 md:grid-cols-4"><ReportPanel title="Active tasks" value={String(active.length)} detail="Open through review" icon={ClipboardList} /><ReportPanel title="Overdue" value={String(overdue)} detail="Needs attention" icon={AlertTriangle} /><ReportPanel title="Review queue" value={String(tasks.filter((task) => task.status === "Under Review").length)} detail="Pending closure" icon={Eye} /><ReportPanel title="Top workload" value={busiest?.name ?? "None"} detail="Assignee load" icon={Users} /></div><div className="grid gap-4 xl:grid-cols-2"><div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold text-slate-950">Status distribution</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{statuses.map((status) => <div key={status} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500">{status}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{tasks.filter((task) => task.status === status).length}</p></div>)}</div></div><div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold text-slate-950">Client-wise workload</h2><div className="mt-4 space-y-3">{clients.map((client) => <div key={client.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"><span className="font-medium text-slate-700">{client.name}</span><span className="font-semibold text-slate-950">{tasks.filter((task) => task.clientId === client.id && task.status !== "Closed").length} active</span></div>)}</div></div></div></div>;
}

function AdminView({ activity, clients, firm, firms, activeFirmId, onFirmChange, modules, openFirmSetup, openCreateFirm, tasks, team, toggleModule, user }: { activity: ActivityEvent[]; clients: Client[]; firm: FirmProfile; firms: FirmProfile[]; activeFirmId: string; onFirmChange: (firmId: string) => void; modules: ModuleFlag[]; openFirmSetup: () => void; openCreateFirm: () => void; tasks: Task[]; team: TeamMember[]; toggleModule: (id: string) => void; user: TeamMember }) {
  const owner = user.platformRole === "Platform Owner";
  return <div className="space-y-4"><div className="rounded-lg border border-blue-200 bg-blue-50 p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 text-blue-700" size={20} /><div><h2 className="font-semibold text-blue-950">Platform Owner Control Room</h2><p className="mt-1 text-sm text-blue-800">Powerful controls stay away from daily task screens. Sensitive actions are logged.</p></div></div></div><div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-950">Firm master setup</h2><p className="text-sm text-slate-500">Set core identity for each onboarded CA/CPA firm.</p></div><div className="flex items-center gap-2">{owner && <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={openCreateFirm} type="button">Add firm</button>}<button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={openFirmSetup} type="button">{firm.onboardingCompleted ? "Edit setup" : "Complete setup"}</button></div></div><div className="mt-3 grid gap-3 md:grid-cols-4"><Info label="Firm" value={firm.name} /><Info label="City" value={firm.city} /><Info label="Plan" value={firm.plan} /><Info label="Domain" value={firm.emailDomain || "Not set"} /></div>{owner && <div className="mt-3"><label className="text-xs font-semibold uppercase text-slate-500">Switch firm</label><select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 md:w-80" value={activeFirmId} onChange={(event) => onFirmChange(event.target.value)}>{firms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}</div>{!owner && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Firm-level admin view active. Platform-wide controls require Platform Owner.</div>}<div className="grid gap-3 md:grid-cols-4"><ReportPanel title="Firms" value={String(firms.length)} detail={firm.status + " · " + firm.plan} icon={Building2} /><ReportPanel title="Users" value={String(team.length)} detail="Active workspace" icon={Users} /><ReportPanel title="Clients" value={String(clients.length)} detail="Client master" icon={Building2} /><ReportPanel title="Tasks" value={String(tasks.length)} detail="All statuses" icon={ClipboardList} /></div><div className="grid gap-4 xl:grid-cols-2"><div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-950">Module controls</h2><p className="text-sm text-slate-500">Build C, show A through owner-controlled flags.</p></div><SlidersHorizontal className="text-blue-600" size={20} /></div><div className="mt-4 space-y-3">{modules.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"><div><p className="text-sm font-semibold text-slate-900">{item.name}</p><p className="text-xs text-slate-500">{item.key} · {item.visibility}</p></div><button className={(item.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700") + " rounded-full px-3 py-1 text-xs font-semibold"} disabled={!owner} onClick={() => toggleModule(item.id)} type="button">{item.enabled ? "Enabled" : "Hidden"}</button></div>)}</div></div><div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold text-slate-950">Plans and billing readiness</h2><p className="text-sm text-slate-500">Prepared, hidden from firm users until activated.</p><div className="mt-4 space-y-3">{plans.map((plan) => <div key={plan.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3"><div className="flex items-center justify-between"><p className="font-semibold text-slate-950">{plan.name}</p><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600">{plan.status}</span></div><p className="mt-1 text-sm text-slate-600">{plan.price}</p><p className="mt-1 text-xs text-slate-500">{plan.limits}</p></div>)}</div></div></div><div className="grid gap-4 xl:grid-cols-2"><div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold text-slate-950">Activity monitor</h2><div className="mt-4 space-y-3">{activity.slice(0, 8).map((event) => <div key={event.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"><p className="font-semibold text-slate-900">{event.action}</p><p className="mt-1 text-slate-600">{event.detail}</p><p className="mt-1 text-xs text-slate-500">{userName(team, event.actorId)} · {event.createdAt}</p></div>)}</div></div><div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-semibold text-slate-950">Owner tools</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><OwnerTool icon={Eye} label="View-as mode" text="Prepared with visible banner and audit logging." /><OwnerTool icon={FileDown} label="Data exports" text="Firm, user, task, client, and activity exports planned." /><OwnerTool icon={LockKeyhole} label="Audit tools" text="Sensitive actions create activity entries." /><OwnerTool icon={Mail} label="Email reminders" text="Daily summary and overdue alerts are structured." /></div></div></div></div>;
}

function Panel({ action, children, onAction, subtitle, title }: { action: string; children: React.ReactNode; onAction: () => void; subtitle: string; title: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 p-4"><div><h2 className="font-semibold text-slate-950">{title}</h2><p className="text-sm text-slate-500">{subtitle}</p></div><button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={onAction} type="button">{action}</button></div>{children}</div>;
}

function ReportPanel({ detail, icon: Icon, title, value }: { detail: string; icon: typeof ClipboardList; title: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><Icon className="text-blue-600" size={20} /><p className="mt-4 text-sm font-medium text-slate-500">{title}</p><p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-sm text-slate-500">{detail}</p></div>;
}

function OwnerTool({ icon: Icon, label, text }: { icon: typeof Eye; label: string; text: string }) {
  return <div className="rounded-lg border border-slate-100 bg-slate-50 p-3"><Icon className="text-blue-600" size={18} /><p className="mt-3 text-sm font-semibold text-slate-950">{label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>;
}

function TaskModal({ clients, close, submit, team }: { clients: Client[]; close: () => void; submit: (event: FormEvent<HTMLFormElement>) => void; team: TeamMember[] }) {
  return <ModalFrame title="Create task" subtitle="Required fields first. Optional details stay tucked away." close={close}><form className="space-y-4" onSubmit={submit}><Field label="Task title" name="title" required /><div className="grid gap-4 md:grid-cols-2"><Select label="Client" name="clientId" required><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select><Field label="Due date" name="dueDate" required type="date" /></div><div className="grid gap-4 md:grid-cols-2"><label className="block"><span className="text-sm font-medium text-slate-700">Assignees</span><select className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" name="assigneeIds" multiple required>{team.filter((member) => member.firmRole !== "Firm Admin").map((member) => <option key={member.id} value={member.id}>{member.name} · {member.firmRole}</option>)}</select><span className="mt-1 block text-xs text-slate-500">Hold Ctrl to select multiple people.</span></label><div className="space-y-4"><Select label="Reviewer" name="reviewerId" required><option value="">Select reviewer</option>{team.filter((member) => member.firmRole !== "Article/Staff").map((member) => <option key={member.id} value={member.id}>{member.name} · {member.firmRole}</option>)}</Select><Select label="Priority" name="priority"><option>Low</option><option>Normal</option><option>High</option><option>Urgent</option></Select></div></div><textarea className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" name="description" placeholder="More details, optional" /><Actions close={close} label="Create Task" /></form></ModalFrame>;
}

function ClientModal({ close, submit }: { close: () => void; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <ModalFrame title="Add client" subtitle="Only client name is compulsory." close={close}><form className="space-y-4" onSubmit={submit}><Field label="Client name" name="name" required /><div className="grid gap-4 md:grid-cols-2"><Field label="PAN" name="pan" /><Field label="GSTIN" name="gstin" /><Field label="Email" name="email" type="email" /><Field label="Mobile/contact" name="mobile" /></div><Actions close={close} label="Add Client" /></form></ModalFrame>;
}

function TeamModal({ close, domain, error, submit }: { close: () => void; domain: string; error: string; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <ModalFrame title="Add team member" subtitle="Simple role labels first; custom roles can come later." close={close}><form className="space-y-4" onSubmit={submit}><Field label="Name" name="name" required /><Field label="Email" name="email" required type="email" />{domain && <p className="text-xs text-slate-500">Allowed domain for this firm: @{domain}</p>}{error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}<Select label="Role" name="firmRole"><option>Firm Admin</option><option>Partner</option><option>Manager</option><option>Article/Staff</option></Select><Actions close={close} label="Add User" /></form></ModalFrame>;
}

function FirmSetupModal({ close, error, firm, submit }: { close: () => void; error: string; firm: FirmProfile; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <ModalFrame title="Firm master setup" subtitle="Configure this workspace for the onboarded firm." close={close}><form className="space-y-4" onSubmit={submit}><Field label="Firm name" name="name" required type="text" defaultValue={firm.name} /><div className="grid gap-4 md:grid-cols-2"><Field label="City" name="city" required type="text" defaultValue={firm.city} /><Field label="Plan name" name="plan" required type="text" defaultValue={firm.plan} /><Field label="Default email domain (optional)" name="emailDomain" type="text" defaultValue={firm.emailDomain} /><Select label="Workspace status" name="status" defaultValue={firm.status}><option value="Trial">Trial</option><option value="Active">Active</option><option value="Paused">Paused</option></Select></div>{error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}<Actions close={close} label={firm.onboardingCompleted ? "Update setup" : "Complete setup"} /></form></ModalFrame>;
}

function FirmCreateModal({ close, error, submit }: { close: () => void; error: string; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <ModalFrame title="Create new firm workspace" subtitle="Add the next CA/CPA firm with a clean, isolated workspace." close={close}><form className="space-y-4" onSubmit={submit}><Field label="Firm name" name="name" required type="text" /><div className="grid gap-4 md:grid-cols-2"><Field label="City" name="city" required type="text" /><Field label="Plan name" name="plan" required type="text" defaultValue="Professional Trial" /><Field label="Default email domain (optional)" name="emailDomain" type="text" /><Select label="Workspace status" name="status" defaultValue="Trial"><option value="Trial">Trial</option><option value="Active">Active</option><option value="Paused">Paused</option></Select></div>{error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}<Actions close={close} label="Create firm workspace" /></form></ModalFrame>;
}

function TaskDrawer({ addNote, clients, close, moveTask, task, team, user }: { addNote: (taskId: string, note: string) => void; clients: Client[]; close: () => void; moveTask: (taskId: string, status: TaskStatus, remarks?: string) => void; task: Task; team: TeamMember[]; user: TeamMember }) {
  const [note, setNote] = useState("");
  const [remarks, setRemarks] = useState("");
  const assignee = task.assigneeIds.includes(user.id);
  const reviewer = task.reviewerId === user.id || user.firmRole === "Firm Admin" || user.platformRole === "Platform Owner";
  const canUpdate = assignee || reviewer || task.createdById === user.id;
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35"><aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><div><button className="mb-2 text-sm font-semibold text-slate-600 hover:text-slate-950" onClick={close} type="button">Back</button><h2 className="text-xl font-semibold text-slate-950">{task.title}</h2><p className="mt-1 text-sm text-slate-500">{clientName(clients, task.clientId)}</p></div><StatusPill status={task.status} /></div><div className="space-y-5 p-5"><div className="grid gap-3 md:grid-cols-2"><Info label="Due date" value={task.dueDate + " · " + dueState(task).label} /><Info label="Priority" value={task.priority} /><Info label="Assignees" value={task.assigneeIds.map((id) => userName(team, id)).join(", ")} /><Info label="Reviewer" value={userName(team, task.reviewerId)} /></div>{task.description && <Info label="Description" value={task.description} />}<div className="rounded-lg border border-slate-200 bg-white p-4"><h3 className="font-semibold text-slate-950">Workflow actions</h3><div className="mt-3 flex flex-wrap gap-2"><Workflow disabled={!canUpdate || task.status === "Closed"} label="Start / resume" action={() => moveTask(task.id, "In Progress")} /><Workflow disabled={!canUpdate || task.status === "Closed"} label="Pending client" action={() => moveTask(task.id, "Pending Client")} /><Workflow disabled={!canUpdate || task.status === "Closed"} label="Pending internal" action={() => moveTask(task.id, "Pending Internal")} /><Workflow disabled={!assignee || task.status === "Closed"} label="Move to review" action={() => moveTask(task.id, "Under Review")} /><Workflow disabled={!reviewer || task.status !== "Under Review"} label="Send back" action={() => moveTask(task.id, "In Progress")} /></div><div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3"><label className="block text-sm font-medium text-slate-700">Closure remarks</label><textarea className="mt-2 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Required before reviewer closes the task" /><button className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50" disabled={!reviewer || task.status !== "Under Review" || !remarks.trim()} onClick={() => moveTask(task.id, "Closed", remarks.trim())} type="button">Close after review</button></div></div><div className="rounded-lg border border-slate-200 bg-white p-4"><h3 className="font-semibold text-slate-950">Progress notes</h3><form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); addNote(task.id, note); setNote(""); }}><input className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" disabled={!canUpdate} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add progress note" /><button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!canUpdate || !note.trim()} type="submit">Add</button></form><div className="mt-4 space-y-3">{task.notes.map((item) => <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"><p className="text-slate-700">{item.text}</p><p className="mt-2 text-xs text-slate-500">{item.authorId ? userName(team, item.authorId) : item.author} · {item.createdAt}{item.newStatus ? " · " + (item.oldStatus ?? "Status") + " to " + item.newStatus : ""}</p></div>)}</div></div>{task.closureRemarks && <Info label="Closure remarks" value={task.closureRemarks} />}</div></aside></div>;
}

function ModalFrame({ children, close, subtitle, title }: { children: React.ReactNode; close: () => void; subtitle: string; title: string }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-lg font-semibold text-slate-950">{title}</h2><p className="text-sm text-slate-500">{subtitle}</p></div><button className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={close} type="button"><X size={18} /></button></div><div className="p-5">{children}</div></div></div>;
}

function Field({ defaultValue, label, name, required, type = "text" }: { defaultValue?: string; label: string; name: string; required?: boolean; type?: string }) {
  return <label className="block"><span className="text-sm font-medium text-slate-700">{label}</span><input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" defaultValue={defaultValue} name={name} required={required} type={type} /></label>;
}

function Select({ children, defaultValue = "", label, name, required }: { children: React.ReactNode; defaultValue?: string; label: string; name: string; required?: boolean }) {
  return <label className="block"><span className="text-sm font-medium text-slate-700">{label}</span><select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" defaultValue={defaultValue} name={name} required={required}>{children}</select></label>;
}

function Actions({ close, label }: { close: () => void; label: string }) {
  return <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={close} type="button">Cancel</button><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" type="submit">{label}</button></div>;
}

function Workflow({ action, disabled, label }: { action: () => void; disabled: boolean; label: string }) {
  return <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50" disabled={disabled} onClick={action} type="button">{label}</button>;
}

function StatusPill({ status }: { status: TaskStatus }) {
  return <span className={statusTone[status] + " inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold"}>{status}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-900">{value}</p></div>;
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
