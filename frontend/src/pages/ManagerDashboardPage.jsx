import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import StatusPill from "../components/StatusPill";
import { deleteData, getData, patchData, postData, putData } from "../lib/api";
import { useAuth } from "../lib/auth";
import logo from "./logo.png";

const MENUS = {
  owner: [
    { id: "owner-dashboard", label: "Dashboard" },
    { id: "owner-roles", label: "Roles" },
    { id: "owner-users", label: "Users" },
    { id: "owner-projects", label: "Projects" },
    { id: "owner-tasks", label: "Tasks & Analytics" },
    { id: "owner-company", label: "Company Settings" }
  ],
  manager: [
    { id: "manager-dashboard", label: "Dashboard" },
    { id: "manager-users", label: "Users" },
    { id: "manager-roles", label: "Roles" },
    { id: "manager-projects", label: "Projects" },
    { id: "manager-tasks", label: "Tasks" },
    { id: "manager-attendance", label: "Attendance & Leave" }
  ],
  employee: [
    { id: "employee-dashboard", label: "Dashboard" },
    { id: "employee-attendance", label: "Attendance & Leave" }
  ],
  hr: [
    { id: "hr-dashboard", label: "Dashboard" },
    { id: "hr-roles", label: "Roles" },
    { id: "hr-attendance", label: "Attendance, Leave, Review" }
  ],
  client: [{ id: "client-dashboard", label: "Dashboard" }]
};

const ROLE_PERMISSION_FIELDS = [
  "can_manage_company",
  "can_manage_roles",
  "can_manage_users",
  "can_create_project",
  "can_assign_task",
  "can_view_all_tasks",
  "can_view_team_tasks",
  "can_view_assigned_tasks",
  "can_update_task_status",
  "can_view_project_progress",
  "can_manage_hr",
  "can_approve_leave",
  "can_view_attendance",
  "can_manage_payroll"
];

const EMPTY_OWNER_OVERVIEW = {
  total_clients: 0,
  total_employees: 0,
  total_projects: 0,
  total_tasks: 0,
  completed_tasks: 0,
  pending_tasks: 0,
  completion_rate: 0,
  overdue_tasks: 0
};

const EMPTY_MANAGER_OVERVIEW = {
  total_projects: 0,
  total_tasks: 0,
  completed_tasks: 0,
  pending_tasks: 0,
  in_progress_tasks: 0,
  overdue_tasks: 0,
  team_members_count: 0
};

const EMPTY_TASK_ANALYTICS = {
  total_tasks: 0,
  completed_tasks: 0,
  overdue_tasks: 0
};

const EMPTY_HR_OVERVIEW = {
  total_employees: 0,
  attendance: {
    present: 0,
    absent: 0,
    half_day: 0,
    on_leave: 0,
    attendance_percentage: 0
  },
  leave_summary: {
    approved: 0,
    pending: 0,
    rejected: 0
  }
};

function toArray(value) {
  if (Array.isArray(value)) return value;

  if (value && typeof value === "object") {
    const nestedCollections = [
      value.results,
      value.data,
      value.items,
      value.users,
      value.projects,
      value.tasks,
      value.leaves,
      value.attendance
    ];

    for (const candidate of nestedCollections) {
      if (Array.isArray(candidate)) return candidate;
    }
  }

  return [];
}

function toObject(value, fallback) {
  if (Array.isArray(value)) {
    return value[0] || fallback;
  }
  if (value && typeof value === "object") {
    return value;
  }
  return fallback;
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function compactPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== "" && value !== null && value !== undefined)
  );
}

function extractError(err) {
  if (err?.response?.data) {
    if (typeof err.response.data === "string") return err.response.data;
    return JSON.stringify(err.response.data);
  }
  return err?.message || "Request failed";
}

function makeInviteLink(inviteToken) {
  if (!inviteToken) return "";
  const appBase = import.meta.env.VITE_APP_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:5173");
  return `${appBase.replace(/\/$/, "")}/set-password/${inviteToken}`;
}

function getEntityId(value) {
  if (value && typeof value === "object") {
    if (value.id !== undefined && value.id !== null) return value.id;
    return "";
  }
  return value ?? "";
}

function getUserDisplayName(userRow) {
  const directName = String(userRow?.name || "").trim();
  if (directName) return directName;

  const first = String(userRow?.first_name || userRow?.user?.first_name || "").trim();
  const last = String(userRow?.last_name || userRow?.user?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;

  const email = String(userRow?.email || userRow?.user?.email || "").trim();
  return email || "User";
}

function getRoleText(row) {
  const roleValue = row?.role;
  return String(
    row?.role_name ||
    (roleValue && typeof roleValue === "object" ? roleValue.name || roleValue.slug : roleValue) ||
    ""
  )
    .trim()
    .toLowerCase();
}

function getLinkedCompanyUserId(row) {
  const candidates = [
    row?.company_user_id,
    row?.company_user,
    row?.employee_id,
    row?.employee,
    row?.user_id,
    row?.user,
    row?.member_id,
    row?.member
  ];

  for (const candidate of candidates) {
    const id = getEntityId(candidate);
    if (id !== "" && id !== null && id !== undefined) {
      return String(id);
    }
  }

  return "";
}

function buildHrFallbackUserRows(attendanceRows, leaveRows, currentProfile) {
  const mergedRows = [...toArray(attendanceRows), ...toArray(leaveRows)];
  const userMap = new Map();

  for (const row of mergedRows) {
    const linkedId = getLinkedCompanyUserId(row);
    if (!linkedId || userMap.has(String(linkedId))) continue;

    userMap.set(String(linkedId), {
      id: Number.isNaN(Number(linkedId)) ? linkedId : Number(linkedId),
      name: String(row?.employee_name || getUserDisplayName(row) || "").trim() || "User",
      email: String(row?.employee_email || row?.email || row?.user?.email || "").trim(),
      role: String(row?.employee_role || row?.role_name || row?.role || "").trim() || "-",
      status: String(row?.user_status || row?.status || "ACTIVE").trim() || "ACTIVE"
    });
  }

  const currentId = currentProfile?.id;
  if (currentId !== undefined && currentId !== null && !userMap.has(String(currentId))) {
    userMap.set(String(currentId), {
      id: currentId,
      name: getUserDisplayName(currentProfile),
      email: String(currentProfile?.email || "").trim(),
      role: String(currentProfile?.role || "").trim() || "-",
      status: String(currentProfile?.status || "ACTIVE").trim() || "ACTIVE"
    });
  }

  return Array.from(userMap.values());
}

function buildProjectsWithTaskProgress(projectRows, taskRows) {
  const projects = toArray(projectRows);
  const tasks = toArray(taskRows);
  const statsByProjectId = {};

  for (const task of tasks) {
    const projectId = String(getEntityId(task?.project) || "");
    if (!projectId) continue;

    if (!statsByProjectId[projectId]) {
      statsByProjectId[projectId] = { total: 0, completed: 0 };
    }

    statsByProjectId[projectId].total += 1;

    const status = String(task?.status || "").trim().toUpperCase();
    const parsedProgress = numberOrNull(task?.progress);
    if (status === "COMPLETED" || (parsedProgress !== null && parsedProgress >= 100)) {
      statsByProjectId[projectId].completed += 1;
    }
  }

  return projects.map((project) => {
    const projectId = String(project?.id || "");
    const stats = statsByProjectId[projectId];

    if (!stats || stats.total === 0) {
      const existingProgress = numberOrNull(project?.progress);
      return {
        ...project,
        progress: existingProgress !== null ? `${existingProgress}%` : "-"
      };
    }

    const completion = Math.round((stats.completed / stats.total) * 100);
    return {
      ...project,
      progress: `${completion}% (${stats.completed}/${stats.total})`
    };
  });
}

function mapTaskToUpdateForm(task) {
  return {
    task_id: String(task?.id ?? ""),
    title: String(task?.title || ""),
    description: String(task?.description || ""),
    assigned_to: String(getEntityId(task?.assigned_to) || ""),
    project: String(getEntityId(task?.project) || ""),
    status: String(task?.status || "PENDING"),
    priority: String(task?.priority || "MEDIUM"),
    due_date: String(task?.due_date || ""),
    progress: String(task?.progress ?? 0),
    reference_link: String(task?.reference_link || "")
  };
}

function detectDashboardType(profile) {
  const role = String(profile?.role || "").toLowerCase();
  const permissions = profile?.permissions || {};

  if (role.includes("owner") || permissions.can_manage_company) return "owner";
  if (role.includes("manager")) return "manager";
  if (role.includes("hr")) return "hr";
  if (role.includes("client")) return "client";

  if (permissions.can_view_team_tasks) return "manager";
  if (permissions.can_manage_hr) return "hr";
  if (permissions.can_view_project_progress && !permissions.can_view_assigned_tasks) return "client";

  return "employee";
}

function canAccessMenu(roleType, menuId, permissions) {
  if (roleType === "owner") {
    if (menuId === "owner-dashboard") return true;
    if (menuId === "owner-roles") return permissions.can_manage_roles || permissions.can_manage_company;
    if (menuId === "owner-users") return permissions.can_manage_users || permissions.can_manage_company;
    if (menuId === "owner-projects") return permissions.can_manage_company || permissions.can_create_project || permissions.can_view_all_tasks;
    if (menuId === "owner-tasks") return permissions.can_view_all_tasks || permissions.can_manage_company;
    if (menuId === "owner-company") return permissions.can_manage_company;
  }

  if (roleType === "manager") {
    if (menuId === "manager-dashboard") return true;
    if (menuId === "manager-users") return permissions.can_manage_users || permissions.can_view_team_tasks;
    if (menuId === "manager-roles") return permissions.can_manage_roles;
    if (menuId === "manager-projects") return true;
    if (menuId === "manager-tasks") return true;
    if (menuId === "manager-attendance") return true;
  }

  if (roleType === "employee") {
    if (menuId === "employee-dashboard") return true;
    if (menuId === "employee-attendance") return true;
  }

  if (roleType === "hr") {
    return true;
  }

  if (roleType === "client") {
    return true;
  }

  return true;
}

function StatCard({ label, value, accent }) {
  const color = accent || "#1d4ed8";
  return (
    <article className="rounded-2xl p-4" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)", border: "1px solid #d9e3f2", borderLeft: `4px solid ${color}`, position: "relative", overflow: "hidden", boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)" }}>
      <div style={{ position: "absolute", top: -12, right: -12, width: 48, height: 48, borderRadius: "50%", background: color + "14", pointerEvents: "none" }} />
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#5b728d" }}>{label}</p>
      <p className="mt-2 text-3xl font-extrabold" style={{ fontFamily: "'Georgia', serif", color }}>{value ?? 0}</p>
    </article>
  );
}

function SectionTitle({ title }) {
  return (
    <header className="mb-4 flex items-center gap-2.5">
      <span className="inline-block h-4 w-1 rounded-full" style={{ background: "linear-gradient(180deg, #3ecf8e, #4b9ef5)" }} />
      <h2 className="text-xl font-extrabold" style={{ fontFamily: "'Georgia', serif", letterSpacing: "-0.01em", color: "#16304f" }}>{title}</h2>
    </header>
  );
}

function DashboardThemeStyles() {
  return (
    <style>{`
      .dashboard-shell .btn-primary,
      .dashboard-shell .btn-secondary,
      .dashboard-shell .btn {
        border-radius: 12px;
      }

      .dashboard-shell .btn-primary {
        background: linear-gradient(135deg, #2563eb, #3b82f6) !important;
        color: #ffffff !important;
        box-shadow: 0 14px 24px rgba(37, 99, 235, 0.16) !important;
      }

      .dashboard-shell .btn-secondary {
        background: #ffffff !important;
        color: #16304f !important;
        border: 1px solid #c7d7ee !important;
      }
    `}</style>
  );
}

export default function ManagerDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [roleType, setRoleType] = useState("employee");
  const [activeMenu, setActiveMenu] = useState("employee-dashboard");

  const [busyKey, setBusyKey] = useState("");
  const [errorText, setErrorText] = useState("");
  const [noticeText, setNoticeText] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  const [ownerOverview, setOwnerOverview] = useState(EMPTY_OWNER_OVERVIEW);
  const [managerOverview, setManagerOverview] = useState(EMPTY_MANAGER_OVERVIEW);
  const [hrOverview, setHrOverview] = useState(EMPTY_HR_OVERVIEW);
  const [taskAnalytics, setTaskAnalytics] = useState(EMPTY_TASK_ANALYTICS);

  const [companies, setCompanies] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  const [managerProjects, setManagerProjects] = useState([]);
  const [ownerProjects, setOwnerProjects] = useState([]);
  const [employeeProjects, setEmployeeProjects] = useState([]);
  const [clientProjects, setClientProjects] = useState([]);

  const [myTasks, setMyTasks] = useState([]);
  const [teamTasks, setTeamTasks] = useState([]);
  const [ownerTasks, setOwnerTasks] = useState([]);
  const [employeeTasks, setEmployeeTasks] = useState([]);
  const [managerProjectTasks, setManagerProjectTasks] = useState([]);
  const [managerScopedTasks, setManagerScopedTasks] = useState([]);
  const [myLeaves, setMyLeaves] = useState([]);
  const [hrLeaves, setHrLeaves] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [managerProjectTeamsByProjectId, setManagerProjectTeamsByProjectId] = useState({});

  const [createUserForm, setCreateUserForm] = useState({ company_id: "", first_name: "", email: "", role_id: "" });

  const [createRoleForm, setCreateRoleForm] = useState({
    company: "",
    name: "",
    slug: "",
    level: "90",
    can_manage_company: false,
    can_manage_roles: true,
    can_manage_users: true,
    can_create_project: true,
    can_assign_task: true,
    can_view_all_tasks: true,
    can_view_team_tasks: true,
    can_view_assigned_tasks: true,
    can_update_task_status: true,
    can_view_project_progress: false,
    can_manage_hr: true,
    can_approve_leave: true,
    can_view_attendance: true,
    can_manage_payroll: false
  });

  const [createProjectForm, setCreateProjectForm] = useState({
    name: "",
    description: "",
    manager: "",
    client: "",
    status: "ACTIVE",
    priority: "MEDIUM",
    start_date: "",
    end_date: "",
    budget: "",
    actual_cost: "",
    is_active: true
  });

  const [assignClientForm, setAssignClientForm] = useState({ project_id: "", client: "" });
  const [deactivateProjectForm, setDeactivateProjectForm] = useState({ project_id: "" });
  const [deleteProjectForm, setDeleteProjectForm] = useState({ project_id: "" });
  const [updateProjectForm, setUpdateProjectForm] = useState({
    project_id: "",
    name: "",
    description: "",
    manager: "",
    client: "",
    status: "ACTIVE",
    priority: "MEDIUM",
    start_date: "",
    end_date: "",
    budget: "",
    actual_cost: "",
    is_active: true
  });

  const [createTaskForm, setCreateTaskForm] = useState({
    title: "",
    description: "",
    assigned_to: "",
    project: "",
    status: "PENDING",
    priority: "HIGH",
    due_date: "",
    progress: "0",
    reference_link: "",
    attachment: null,
    image: null
  });

  const [projectTaskForm, setProjectTaskForm] = useState({ project_id: "" });

  const [managerUpdateTaskForm, setManagerUpdateTaskForm] = useState({
    task_id: "",
    title: "",
    description: "",
    assigned_to: "",
    project: "",
    status: "IN_PROGRESS",
    priority: "HIGH",
    due_date: "",
    progress: "70",
    reference_link: ""
  });
  const [ownerUpdateTaskForm, setOwnerUpdateTaskForm] = useState({
    task_id: "",
    title: "",
    description: "",
    assigned_to: "",
    project: "",
    status: "IN_PROGRESS",
    priority: "HIGH",
    due_date: "",
    progress: "70",
    reference_link: ""
  });
  const [employeeUpdateTaskForm, setEmployeeUpdateTaskForm] = useState({
    task_id: "",
    title: "",
    description: "",
    assigned_to: "",
    project: "",
    status: "IN_PROGRESS",
    priority: "HIGH",
    due_date: "",
    progress: "70",
    reference_link: ""
  });

  const [leaveApplyForm, setLeaveApplyForm] = useState({
    start_date: "",
    end_date: "",
    reason: ""
  });

  const [leaveStatusForm, setLeaveStatusForm] = useState({ leave_id: "", status: "APPROVED" });
  const [reviewForm, setReviewForm] = useState({ employee_id: "", rating: "4", feedback: "" });
  const [departmentForm, setDepartmentForm] = useState({ name: "", description: "" });

  const [companySettingsForm, setCompanySettingsForm] = useState({
    id: "",
    name: "",
    email: "",
    phone: "",
    size: "",
    address: "",
    logo: "",
    logo_file: null,
    owner: "",
    last_user_number: ""
  });

  const [updateRoleForm, setUpdateRoleForm] = useState({
    role_id: "",
    company: "",
    name: "",
    slug: "",
    level: "",
    ...Object.fromEntries(ROLE_PERMISSION_FIELDS.map((field) => [field, false]))
  });
  const [updateUserForm, setUpdateUserForm] = useState({ user_id: "", name: "", role: "", status: "ACTIVE" });

  const [expandedTaskProgressId, setExpandedTaskProgressId] = useState("");
  const [employeeTaskUpdateVisible, setEmployeeTaskUpdateVisible] = useState(false);

  const permissions = useMemo(() => currentUser?.permissions || {}, [currentUser]);

  const platformName = "WorkZen";

  const dashboardUserName = useMemo(
    () =>
      getUserDisplayName({
        ...user,
        ...currentUser,
        name: currentUser?.name || user?.name || "",
        email: currentUser?.email || user?.email || ""
      }),
    [currentUser, user]
  );

  const dashboardUserRole = useMemo(
    () => String(currentUser?.role || user?.role || roleType || "User"),
    [currentUser, roleType, user]
  );

  const dashboardCompanyInfo = useMemo(() => {
    const directName = String(
      currentUser?.company?.name ||
      currentUser?.company_name ||
      user?.company?.name ||
      (typeof currentUser?.company === "string" ? currentUser.company : "") ||
      (typeof user?.company === "string" ? user.company : "") ||
      ""
    ).trim();

    const directLogo = String(
      companySettingsForm.logo ||
      currentUser?.company?.logo ||
      currentUser?.company_logo ||
      user?.company?.logo ||
      (typeof user?.company_logo === "string" ? user.company_logo : "") ||
      ""
    ).trim();

    let name = directName;
    let logo = directLogo;

    const companyId = String(
      currentUser?.company_id || currentUser?.company?.id || user?.company_id || user?.company?.id || ""
    );

    if ((!name || !logo) && companyId) {
      const row = companies.find((company) => String(company?.id) === companyId);
      if (row) {
        if (!name && row?.name) name = String(row.name).trim();
        if (!logo && row?.logo) logo = String(row.logo).trim();
      }
    }

    if (!name) {
      const fallbackName = companies.find((company) => String(company?.name || "").trim())?.name;
      name = String(fallbackName || "Company").trim();
    }

    const normalizedLogo = (() => {
      const value = String(logo || "").trim();
      if (!value) return "";
      if (/^(https?:|data:|blob:)/i.test(value)) return value;

      const mediaBase = String(import.meta.env.VITE_API_BASE_URL || "")
        .replace(/\/api\/?$/, "")
        .replace(/\/$/, "");

      return mediaBase ? `${mediaBase}${value.startsWith("/") ? "" : "/"}${value}` : value;
    })();

    return { name, logo: normalizedLogo };
  }, [companies, companySettingsForm.logo, currentUser, user]);

  const roleBackedCompanyId = useMemo(() => {
    for (const role of roles) {
      const roleCompanyId = numberOrNull(getEntityId(role?.company));
      if (roleCompanyId !== null) return roleCompanyId;
    }

    return null;
  }, [roles]);

  const defaultScopedCompanyId = useMemo(
    () =>
      numberOrNull(
        currentUser?.company_id ||
        currentUser?.company?.id ||
        user?.company_id ||
        user?.company?.id ||
        roleBackedCompanyId ||
        companies.find((company) => numberOrNull(company?.id) !== null)?.id
      ),
    [companies, currentUser, roleBackedCompanyId, user]
  );

  const menus = useMemo(() => {
    const base = MENUS[roleType] || MENUS.employee;
    const filtered = base.filter((item) => canAccessMenu(roleType, item.id, permissions));
    return filtered.length ? filtered : base;
  }, [roleType, permissions]);

  const persistActiveMenu = (menuId) => {
    if (typeof window === "undefined" || !menuId) return;
    window.localStorage.setItem("dashboard.activeMenu", menuId);

    const targetHash = `#${menuId}`;
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${targetHash}`);
    }
  };

  const getInitialMenuForType = (type, permissionMap) => {
    const base = MENUS[type] || MENUS.employee;
    const filtered = base.filter((item) => canAccessMenu(type, item.id, permissionMap || {}));
    const allowedMenus = filtered.length ? filtered : base;

    if (typeof window === "undefined") {
      return allowedMenus[0]?.id || "employee-dashboard";
    }

    const hashMenu = String(window.location.hash || "").replace(/^#/, "");
    const storedMenu = String(window.localStorage.getItem("dashboard.activeMenu") || "");
    const preferredMenu = hashMenu || storedMenu;

    if (preferredMenu && allowedMenus.some((item) => item.id === preferredMenu)) {
      return preferredMenu;
    }

    return allowedMenus[0]?.id || "employee-dashboard";
  };

  useEffect(() => {
    if (!menus.find((m) => m.id === activeMenu) && menus.length > 0) {
      const fallbackMenu = menus[0].id;
      setActiveMenu(fallbackMenu);
      persistActiveMenu(fallbackMenu);
    }
  }, [menus, activeMenu]);

  const fetchOr = async (url, fallback) => {
    try {
      return await getData(url);
    } catch {
      return fallback;
    }
  };

  const runAction = async (key, task, successMessage = "") => {
    setBusyKey(key);
    setErrorText("");
    setNoticeText("");

    try {
      await task();
      if (successMessage) setNoticeText(successMessage);
    } catch (err) {
      setErrorText(extractError(err));
    } finally {
      setBusyKey("");
    }
  };

  const loadOwnerData = async () => {
    const [overviewRes, rolesRes, usersRes, projectsRes, tasksRes, analyticsRes, companyRes, companySingleRes] = await Promise.all([
      fetchOr("/overview/", EMPTY_OWNER_OVERVIEW),
      fetchOr("/roles/", []),
      fetchOr("/users/", []),
      fetchOr("/all-projects/", []),
      fetchOr("/all-tasks/", []),
      fetchOr("/task-analytics/", EMPTY_TASK_ANALYTICS),
      fetchOr("/companies/", []),
      fetchOr("/company/", null)
    ]);

    const companyList = (() => {
      const list = toArray(companyRes);
      if (list.length) return list;
      if (Array.isArray(companySingleRes)) return companySingleRes;
      if (companySingleRes && typeof companySingleRes === "object") return [companySingleRes];
      return [];
    })();

    const ownerUserId = Number(user?.user_id || 0);
    const ownerCompanyName = String(user?.company || "").trim().toLowerCase();

    const selectedCompany =
      companyList.find((company) => Number(company.owner) === ownerUserId) ||
      companyList.find(
        (company) => String(company.name || "").trim().toLowerCase() === ownerCompanyName
      ) ||
      companyList[0] ||
      null;

    setOwnerOverview(toObject(overviewRes, EMPTY_OWNER_OVERVIEW));
    setCompanies(selectedCompany ? [selectedCompany] : companyList);
    setRoles(toArray(rolesRes));
    setUsers(toArray(usersRes));
    setOwnerProjects(toArray(projectsRes));
    setOwnerTasks(toArray(tasksRes));
    setTaskAnalytics(toObject(analyticsRes, EMPTY_TASK_ANALYTICS));

    if (selectedCompany) {
      setCompanySettingsForm({
        id: String(selectedCompany.id || ""),
        name: selectedCompany.name || "",
        email: selectedCompany.email || "",
        phone: selectedCompany.phone || "",
        size: selectedCompany.size || "",
        address: selectedCompany.address || "",
        logo: selectedCompany.logo || "",
        logo_file: null,
        owner: selectedCompany.owner ? String(selectedCompany.owner) : "",
        last_user_number: selectedCompany.last_user_number
          ? String(selectedCompany.last_user_number)
          : "0"
      });
    }
  };

  const loadManagerData = async () => {
    const [overviewRes, projectsRes, myTaskRes, leaveRes, attendanceRes, userRes, roleRes, managerTaskRes] = await Promise.all([
      fetchOr("/manager-overview/", EMPTY_MANAGER_OVERVIEW),
      fetchOr("/manager-projects/", []),
      fetchOr("/my-tasks/", []),
      fetchOr("/my-leaves/", []),
      fetchOr("/attendance/", []),
      fetchOr("/users/", []),
      fetchOr("/roles/", []),
      fetchOr("/all-tasks/", [])
    ]);

    setManagerOverview(toObject(overviewRes, EMPTY_MANAGER_OVERVIEW));
    setManagerProjects(toArray(projectsRes));
    setMyTasks(toArray(myTaskRes));
    setMyLeaves(toArray(leaveRes));
    setAttendanceRecords(toArray(attendanceRes));
    setUsers(toArray(userRes));
    setTeamMembers([]);
    setTeamTasks([]);
    setManagerProjectTeamsByProjectId({});
    setRoles(toArray(roleRes));
    setManagerScopedTasks(toArray(managerTaskRes));
  };

  const loadEmployeeData = async () => {
    const [taskRes, projectRes, leaveRes, attendanceRes] = await Promise.all([
      fetchOr("/my-tasks/", []),
      fetchOr("/my-projects/", []),
      fetchOr("/my-leaves/", []),
      fetchOr("/attendance/", [])
    ]);

    setEmployeeTasks(toArray(taskRes));
    setEmployeeProjects(toArray(projectRes));
    setMyLeaves(toArray(leaveRes));
    setAttendanceRecords(toArray(attendanceRes));
  };

  const loadHrData = async () => {
    const [overviewRes, userRes, attendanceRes, leaveRes, deptRes, roleRes] = await Promise.all([
      fetchOr("/hr-dashboard/", EMPTY_HR_OVERVIEW),
      fetchOr("/users/", []),
      fetchOr("/attendance/", []),
      fetchOr("/team-leaves/", []),
      fetchOr("/departments/", []),
      fetchOr("/roles/", [])
    ]);

    setHrOverview(toObject(overviewRes, EMPTY_HR_OVERVIEW));
    setUsers(toArray(userRes));
    setAttendanceRecords(toArray(attendanceRes));
    setHrLeaves(toArray(leaveRes));
    setDepartments(toArray(deptRes));
    setRoles(toArray(roleRes));
  };

  const loadClientData = async (profile = currentUser) => {
    const [clientProjectsRes, allProjectsRes] = await Promise.all([
      fetchOr("/client-projects/", []),
      fetchOr("/projects/", [])
    ]);

    let projects = toArray(clientProjectsRes);

    if (!projects.length) {
      const currentCompanyUserId = Number(profile?.id || 0);
      projects = toArray(allProjectsRes).filter((project) => {
        const rawClient = project?.client;
        const clientId = rawClient && typeof rawClient === "object" ? rawClient.id : rawClient;
        return Number(clientId) === currentCompanyUserId;
      });
    }

    setClientProjects(projects);
  };

  const refreshByRole = async (type, profile = currentUser) => {
    if (type === "owner") return loadOwnerData();
    if (type === "manager") return loadManagerData();
    if (type === "hr") return loadHrData();
    if (type === "client") return loadClientData(profile);
    return loadEmployeeData();
  };

  const bootstrap = async () => {
    await runAction("bootstrap", async () => {
      const me = await getData("/current-user/");
      setCurrentUser(me);
      const type = detectDashboardType(me);
      const menuId = getInitialMenuForType(type, me?.permissions || {});
      setRoleType(type);
      setActiveMenu(menuId);
      persistActiveMenu(menuId);
      await refreshByRole(type, me);
    }, "");
  };

  useEffect(() => {
    bootstrap();
  }, []);
  useEffect(() => {
    if (defaultScopedCompanyId === null) return;

    const defaultValue = String(defaultScopedCompanyId);
    setCreateUserForm((prev) => (prev.company_id ? prev : { ...prev, company_id: defaultValue }));
    setCreateRoleForm((prev) => (prev.company ? prev : { ...prev, company: defaultValue }));
  }, [defaultScopedCompanyId]);

  const createUserCompanyId = useMemo(
    () =>
      numberOrNull(
        createUserForm.company_id ||
        currentUser?.company_id ||
        currentUser?.company?.id ||
        user?.company_id ||
        user?.company?.id ||
        roleBackedCompanyId ||
        createRoleForm.company
      ),
    [createRoleForm.company, createUserForm.company_id, currentUser, roleBackedCompanyId, user]
  );

  const createUserRoleOptions = useMemo(() => {
    const seen = new Set();
    const options = [];

    for (const role of roles) {
      const roleId = role?.id;
      if (roleId === undefined || roleId === null) continue;

      const roleCompanyId = numberOrNull(getEntityId(role?.company));
      if (createUserCompanyId !== null && roleCompanyId !== null && roleCompanyId !== createUserCompanyId) continue;

      const key = String(roleId);
      if (seen.has(key)) continue;
      seen.add(key);

      const labelBase = String(role?.name || role?.slug || "Role").trim();
      const levelText =
        role?.level !== undefined && role?.level !== null && role?.level !== "" ? ` (L${role.level})` : "";

      options.push({ id: key, label: `${labelBase}${levelText}` });
    }

    return options;
  }, [createUserCompanyId, roles]);

  const companyOptions = useMemo(() => {
    const seen = new Set();
    const options = [];

    for (const company of companies) {
      const id = company?.id;
      if (id === undefined || id === null) continue;

      const key = String(id);
      if (seen.has(key)) continue;
      seen.add(key);

      options.push({
        id: key,
        label: `${company?.name || "Company"}`
      });
    }

    for (const role of roles) {
      const roleCompanyId = getEntityId(role?.company);
      if (roleCompanyId === undefined || roleCompanyId === null || roleCompanyId === "") continue;

      const key = String(roleCompanyId);
      if (seen.has(key)) continue;
      seen.add(key);

      const matchedCompany = companies.find((company) => String(company?.id) === key);
      options.push({
        id: key,
        label: `${matchedCompany?.name || dashboardCompanyInfo.name || "Company"}`
      });
    }

    const fallbackCompanyId = numberOrNull(
      currentUser?.company_id ||
      currentUser?.company?.id ||
      user?.company_id ||
      user?.company?.id ||
      roleBackedCompanyId
    );

    if (fallbackCompanyId !== null) {
      const key = String(fallbackCompanyId);
      if (!seen.has(key)) {
        options.push({ id: key, label: `${dashboardCompanyInfo.name || "Company"}` });
      }
    }

    return options;
  }, [companies, currentUser, dashboardCompanyInfo.name, roleBackedCompanyId, roles, user]);

  const companyUserOptions = useMemo(() => {
    const sourceRows = activeMenu === "manager-tasks" && teamMembers.length ? teamMembers : users;

    const seen = new Set();
    const options = [];

    for (const row of sourceRows) {
      const id = row?.id;
      if (id === undefined || id === null) continue;

      const key = String(id);
      if (seen.has(key)) continue;
      seen.add(key);

      const roleValue = row?.role;
      const roleText = String(
        row?.role_name ||
        (roleValue && typeof roleValue === "object" ? roleValue.name || roleValue.slug : roleValue) ||
        ""
      )
        .trim()
        .toLowerCase();

      options.push({
        id: key,
        label: `${getUserDisplayName(row)}`,
        roleText
      });
    }

    return options;
  }, [activeMenu, teamMembers, users]);

  const managerUserOptions = useMemo(() => {
    return companyUserOptions.filter((option) => option.roleText.includes("manager") || option.roleText.includes("owner"));
  }, [companyUserOptions]);

  const clientUserOptions = useMemo(() => {
    return companyUserOptions.filter((option) => option.roleText.includes("client"));
  }, [companyUserOptions]);

  const updateRoleOptions = useMemo(
    () =>
      roles
        .filter((role) => role?.id !== undefined && role?.id !== null)
        .map((role) => ({
          id: String(role.id),
          label: `${role?.name || role?.slug || "Role"} (L${role?.level ?? "-"})`
        })),
    [roles]
  );

  const updateUserOptions = useMemo(() => {
    const merged = [...toArray(users), ...toArray(teamMembers)];
    const seen = new Set();
    const options = [];

    for (const row of merged) {
      const id = row?.id;
      if (id === undefined || id === null) continue;

      const key = String(id);
      if (seen.has(key)) continue;
      seen.add(key);

      options.push({
        id: key,
        label: `${getUserDisplayName(row)}`
      });
    }

    return options;
  }, [teamMembers, users]);

  useEffect(() => {
    if (!createUserForm.role_id) return;

    const selectedRoleId = String(createUserForm.role_id);
    const isValidRole = createUserRoleOptions.some((option) => option.id === selectedRoleId);

    if (!isValidRole) {
      setCreateUserForm((prev) => ({ ...prev, role_id: "" }));
    }
  }, [createUserForm.role_id, createUserRoleOptions]);
  useEffect(() => {
    if (activeMenu === "owner-tasks" || activeMenu === "manager-tasks") return;
    setExpandedTaskProgressId("");
  }, [activeMenu]);

  useEffect(() => {
    if (activeMenu === "employee-dashboard") return;
    setEmployeeTaskUpdateVisible(false);
  }, [activeMenu]);

  useEffect(() => {
    let intervalId;

    if (activeMenu === "owner-tasks" && roleType === "owner") {
      intervalId = setInterval(() => {
        loadOwnerData().catch(() => { });
      }, 15000);
    }

    if (activeMenu === "manager-tasks" && roleType === "manager") {
      intervalId = setInterval(() => {
        loadManagerData().catch(() => { });
      }, 15000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeMenu, roleType]);
  useEffect(() => {
    let active = true;

    if (roleType !== "manager" || !managerProjects.length) {
      setManagerProjectTeamsByProjectId({});
      return () => {
        active = false;
      };
    }

    const loadProjectTeams = async () => {
      const entries = await Promise.all(
        managerProjects.map(async (project) => {
          const projectId = String(project?.id || "");
          if (!projectId) return [projectId, []];

          const teamRows = await fetchOr(`/projects/${projectId}/team/`, []);
          return [projectId, toArray(teamRows)];
        })
      );

      if (!active) return;
      setManagerProjectTeamsByProjectId(Object.fromEntries(entries.filter(([projectId]) => projectId)));
    };

    loadProjectTeams().catch(() => {
      if (active) setManagerProjectTeamsByProjectId({});
    });

    return () => {
      active = false;
    };
  }, [managerProjects, roleType]);

  const submitCreateUser = async (e) => {
    e.preventDefault();
    setInviteLink("");

    const companyId = createUserCompanyId;
    const roleId = numberOrNull(createUserForm.role_id);

    if (companyId === null) {
      setErrorText("Valid company_id is required.");
      return;
    }

    if (roleId === null) {
      setErrorText("Please select a role.");
      return;
    }

    await runAction("create-user", async () => {
      const response = await postData("/create-user/", {
        company_id: companyId,
        first_name: String(createUserForm.first_name || "").trim(),
        email: String(createUserForm.email || "").trim(),
        role_id: roleId
      });

      const token = response?.invite_token;
      setInviteLink(makeInviteLink(token));

      setCreateUserForm({ company_id: String(companyId), first_name: "", email: "", role_id: "" });
      await refreshByRole(roleType);
    }, "✅ User invited successfully! Invite link generated.");
  };

  const submitCreateRole = async (e) => {
    e.preventDefault();

    const companyId = numberOrNull(
      createRoleForm.company ||
      createUserForm.company_id ||
      currentUser?.company_id ||
      currentUser?.company?.id ||
      user?.company_id ||
      user?.company?.id ||
      roleBackedCompanyId
    );

    if (companyId === null) {
      setErrorText("Valid company id is required for role creation.");
      return;
    }

    const level = Number(createRoleForm.level);
    if (Number.isNaN(level)) {
      setErrorText("Role level must be numeric.");
      return;
    }

    const slugSource = String(createRoleForm.slug || createRoleForm.name || "").trim().toLowerCase();
    const normalizedSlug = slugSource
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");

    if (!normalizedSlug) {
      setErrorText("Role slug is required.");
      return;
    }

    await runAction("create-role", async () => {
      await postData("/roles/", {
        ...createRoleForm,
        company: companyId,
        slug: normalizedSlug,
        level
      });
      setCreateRoleForm((prev) => ({
        ...prev,
        company: String(companyId),
        name: "",
        slug: "",
        level: String(level)
      }));
      await refreshByRole(roleType);
    }, "✅ Role created successfully!");
  };

  const updateRoleFromList = (roleRow) => {
    const roleId = roleRow?.id;
    if (!roleId) return;

    const nextState = {
      role_id: String(roleId),
      company: String(getEntityId(roleRow?.company) || createRoleForm.company || createUserForm.company_id || ""),
      name: String(roleRow?.name || ""),
      slug: String(roleRow?.slug || ""),
      level: String(roleRow?.level ?? "")
    };

    for (const field of ROLE_PERMISSION_FIELDS) {
      nextState[field] = Boolean(roleRow?.[field]);
    }

    setUpdateRoleForm(nextState);

  };

  const handleUpdateRoleSelection = (roleId) => {
    const selectedId = String(roleId || "");
    const roleRow = roles.find((row) => String(row?.id) === selectedId);

    if (!roleRow) {
      setUpdateRoleForm((prev) => ({ ...prev, role_id: selectedId }));
      return;
    }

    updateRoleFromList(roleRow);
  };
  const submitUpdateRole = async (e) => {
    e.preventDefault();

    const roleId = numberOrNull(updateRoleForm.role_id);
    if (roleId === null) {
      setErrorText("Please select a role to update.");
      return;
    }

    const level = Number(updateRoleForm.level);
    if (Number.isNaN(level)) {
      setErrorText("Role level must be numeric.");
      return;
    }

    const slugSource = String(updateRoleForm.slug || updateRoleForm.name || "").trim().toLowerCase();
    const normalizedSlug = slugSource
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");

    if (!normalizedSlug) {
      setErrorText("Role slug is required.");
      return;
    }

    const payload = compactPayload({
      name: String(updateRoleForm.name || "").trim() || undefined,
      slug: normalizedSlug || undefined,
      level,
      company: numberOrNull(updateRoleForm.company),
      ...Object.fromEntries(ROLE_PERMISSION_FIELDS.map((field) => [field, Boolean(updateRoleForm[field])]))
    });

    await runAction(`update-role-${roleId}`, async () => {
      await patchData(`/roles/${roleId}/`, payload);
      await refreshByRole(roleType);
    }, "✅ Role updated successfully!");
  };

  const deleteRoleFromList = async (roleRow) => {
    const roleId = roleRow?.id;
    if (!roleId) return;

    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(`Delete role \"${roleRow?.name || roleId}\"?`);

    if (!confirmed) return;

    await runAction(`delete-role-${roleId}`, async () => {
      await deleteData(`/roles/${roleId}/`);
      await refreshByRole(roleType);
    }, "✅ Role deleted.");
  };

  const updateUserFromList = (userRow) => {
    const userId = userRow?.id;
    if (!userId) return;

    if (!permissions.can_manage_users) {
      setErrorText("You do not have permission to manage users.");
      return;
    }

    let defaultRoleId = "";
    if (typeof userRow?.role === "number") {
      defaultRoleId = String(userRow.role);
    } else if (userRow?.role && typeof userRow.role === "object" && userRow.role.id !== undefined) {
      defaultRoleId = String(userRow.role.id);
    } else {
      const roleName = String(userRow?.role_name || userRow?.role || "").trim().toLowerCase();
      if (roleName && roleIdByName[roleName] !== undefined) {
        defaultRoleId = String(roleIdByName[roleName]);
      }
    }

    setUpdateUserForm({
      user_id: String(userId),
      name: String(userRow?.name || userRow?.first_name || "").trim(),
      role: defaultRoleId,
      status: String(userRow?.status || "ACTIVE").trim()
    });


  };

  const handleUpdateUserSelection = (userId) => {
    const selectedId = String(userId || "");
    const sourceRows = [...toArray(users), ...toArray(teamMembers)];
    const userRow = sourceRows.find((row) => String(row?.id) === selectedId);

    if (!userRow) {
      setUpdateUserForm((prev) => ({ ...prev, user_id: selectedId }));
      return;
    }

    updateUserFromList(userRow);
  };
  const submitUpdateUser = async (e) => {
    e.preventDefault();

    if (!permissions.can_manage_users) {
      setErrorText("You do not have permission to manage users.");
      return;
    }

    const userId = numberOrNull(updateUserForm.user_id);
    if (userId === null) {
      setErrorText("Please select a user to update.");
      return;
    }

    const roleId = numberOrNull(updateUserForm.role);
    if (roleId === null) {
      setErrorText("Please select a role.");
      return;
    }

    const payload = compactPayload({
      name: String(updateUserForm.name || "").trim() || undefined,
      role: roleId,
      status: String(updateUserForm.status || "").trim() || undefined
    });

    await runAction(`update-user-${userId}`, async () => {
      await patchData(`/update-user/${userId}/`, payload);
      await refreshByRole(roleType);
    }, "✅ User updated successfully!");
  };

  const deleteUserFromList = async (userRow) => {
    const userId = userRow?.id;
    if (!userId) return;

    if (!permissions.can_manage_users) {
      setErrorText("You do not have permission to manage users.");
      return;
    }

    const label = userRow?.name || userRow?.email || userId;
    const confirmed = typeof window === "undefined" ? true : window.confirm(`Delete user \"${label}\"?`);
    if (!confirmed) return;

    await runAction(`delete-user-${userId}`, async () => {
      await deleteData(`/delete-user/${userId}/`);
      await refreshByRole(roleType);
    }, "✅ User deleted.");
  };

  const submitCreateProject = async (e) => {
    e.preventDefault();
    await runAction("create-project", async () => {
      await postData(
        "/projects/",
        compactPayload({
          name: createProjectForm.name,
          description: createProjectForm.description,
          manager: numberOrNull(createProjectForm.manager),
          client: numberOrNull(createProjectForm.client),
          status: createProjectForm.status,
          priority: createProjectForm.priority,
          start_date: createProjectForm.start_date,
          end_date: createProjectForm.end_date,
          budget: numberOrNull(createProjectForm.budget),
          actual_cost: numberOrNull(createProjectForm.actual_cost),
          is_active: createProjectForm.is_active
        })
      );
      setCreateProjectForm({
        name: "",
        description: "",
        manager: "",
        client: "",
        status: "ACTIVE",
        priority: "MEDIUM",
        start_date: "",
        end_date: "",
        budget: "",
        actual_cost: "",
        is_active: true
      });
      await refreshByRole(roleType);
    }, "✅ Project created successfully!");
  };

  const submitAssignClient = async (e) => {
    e.preventDefault();
    await runAction("assign-client", async () => {
      await patchData(`/projects/${assignClientForm.project_id}/assign_client/`, {
        client: Number(assignClientForm.client)
      });
      await refreshByRole(roleType);
    }, "✅ Client assigned to project!");
  };

  const submitDeactivateProject = async (e) => {
    e.preventDefault();
    await runAction("deactivate-project", async () => {
      await patchData(`/projects/${deactivateProjectForm.project_id}/deactivate/`, {});
      await refreshByRole(roleType);
    }, "✅ Project deactivated.");
  };

  const submitUpdateProject = async (e) => {
    e.preventDefault();

    if (!String(updateProjectForm.project_id || "").trim()) {
      setErrorText("Select a project to update.");
      return;
    }

    await runAction("update-project", async () => {
      await patchData(
        `/projects/${updateProjectForm.project_id}/`,
        compactPayload({
          name: updateProjectForm.name,
          description: updateProjectForm.description,
          manager: numberOrNull(updateProjectForm.manager),
          client: numberOrNull(updateProjectForm.client),
          status: updateProjectForm.status,
          priority: updateProjectForm.priority,
          start_date: updateProjectForm.start_date,
          end_date: updateProjectForm.end_date,
          budget: numberOrNull(updateProjectForm.budget),
          actual_cost: numberOrNull(updateProjectForm.actual_cost),
          is_active: updateProjectForm.is_active
        })
      );
      await refreshByRole(roleType);
    }, "✅ Project updated successfully!");
  };

  const submitDeleteProject = async (e) => {
    e.preventDefault();
    await runAction("delete-project", async () => {
      await deleteData(`/projects/${deleteProjectForm.project_id}/`);
      setDeleteProjectForm({ project_id: "" });
      await refreshByRole(roleType);
    }, "✅ Project deleted.");
  };

  const assignClientFromProjectRow = async (projectRow) => {
    const projectId = projectRow?.id;
    if (!projectId) return;

    const currentClient =
      typeof projectRow?.client === "number"
        ? String(projectRow.client)
        : projectRow?.client && typeof projectRow.client === "object" && projectRow.client.id !== undefined
          ? String(projectRow.client.id)
          : String(projectRow?.client_id || "");

    const nextClient =
      typeof window !== "undefined"
        ? window.prompt("Assign client number", currentClient)
        : currentClient;
    if (nextClient === null) return;

    const parsedClient = Number(String(nextClient || "").trim());
    if (Number.isNaN(parsedClient)) {
      setErrorText("Client number must be numeric.");
      return;
    }

    await runAction(`assign-project-client-${projectId}`, async () => {
      await patchData(`/projects/${projectId}/assign_client/`, { client: parsedClient });
      await refreshByRole(roleType);
    }, "✅ Client assigned to project!");
  };

  const updateProjectFromList = async (projectRow) => {
    const projectId = projectRow?.id;
    if (!projectId) return;

    const currentName = String(projectRow?.name || "");
    const currentDescription = String(projectRow?.description || "");
    const currentStartDate = String(projectRow?.start_date || "");
    const currentEndDate = String(projectRow?.end_date || "");
    const currentClient =
      typeof projectRow?.client === "number"
        ? String(projectRow.client)
        : projectRow?.client && typeof projectRow.client === "object" && projectRow.client.id !== undefined
          ? String(projectRow.client.id)
          : String(projectRow?.client_id || "");
    const currentActive = projectRow?.is_active ?? true;

    const nextName =
      typeof window !== "undefined" ? window.prompt("Edit project name", currentName) : currentName;
    if (nextName === null) return;

    const nextDescription =
      typeof window !== "undefined"
        ? window.prompt("Edit description", currentDescription)
        : currentDescription;
    if (nextDescription === null) return;

    const nextStartDate =
      typeof window !== "undefined"
        ? window.prompt("Edit start date (YYYY-MM-DD)", currentStartDate)
        : currentStartDate;
    if (nextStartDate === null) return;

    const nextEndDate =
      typeof window !== "undefined"
        ? window.prompt("Edit end date (YYYY-MM-DD)", currentEndDate)
        : currentEndDate;
    if (nextEndDate === null) return;

    const nextClient =
      typeof window !== "undefined"
        ? window.prompt("Edit client number (blank to keep current)", currentClient)
        : currentClient;
    if (nextClient === null) return;

    const nextActive =
      typeof window !== "undefined"
        ? window.prompt("is_active (true/false, blank to keep current)", String(currentActive))
        : String(currentActive);
    if (nextActive === null) return;

    const activeInput = String(nextActive || "").trim().toLowerCase();
    let parsedActive;
    if (activeInput !== "") {
      if (["true", "1", "yes", "y"].includes(activeInput)) parsedActive = true;
      else if (["false", "0", "no", "n"].includes(activeInput)) parsedActive = false;
      else {
        setErrorText("is_active must be true or false.");
        return;
      }
    }

    const payload = compactPayload({
      name: String(nextName || "").trim() || undefined,
      description: String(nextDescription || "").trim() || undefined,
      start_date: String(nextStartDate || "").trim() || undefined,
      end_date: String(nextEndDate || "").trim() || undefined,
      client: String(nextClient || "").trim() ? Number(nextClient) : undefined,
      is_active: parsedActive
    });

    if (payload.client !== undefined && Number.isNaN(payload.client)) {
      setErrorText("Client number must be numeric.");
      return;
    }

    if (Object.keys(payload).length === 0) {

      return;
    }

    await runAction(`update-project-${projectId}`, async () => {
      await patchData(`/projects/${projectId}/`, payload);
      await refreshByRole(roleType);
    }, "✅ Project updated successfully!");
  };

  const deleteProjectFromList = async (projectRow) => {
    const projectId = projectRow?.id;
    if (!projectId) return;

    const label = projectRow?.name || projectId;
    const confirmed = typeof window === "undefined" ? true : window.confirm(`Delete project \"${label}\"?`);
    if (!confirmed) return;

    await runAction(`delete-project-${projectId}`, async () => {
      try {
        await deleteData(`/projects/${projectId}/`);
      } catch {
        await deleteData(`/projects/${projectId}/deactivate/`);
      }
      await refreshByRole(roleType);
    }, "✅ Project deleted.");
  };

  const submitCreateTask = async (e) => {
    e.preventDefault();
    await runAction("create-task", async () => {
      const payload = new FormData();
      payload.append("title", String(createTaskForm.title || "").trim());
      payload.append("description", String(createTaskForm.description || "").trim());
      const assignedToId = numberOrNull(createTaskForm.assigned_to);
      if (assignedToId === null) {
        setErrorText("Please select an assignee.");
        return;
      }

      payload.append("assigned_to", String(assignedToId));

      const projectId = numberOrNull(createTaskForm.project);
      if (projectId !== null) {
        payload.append("project", String(projectId));
      }

      payload.append("status", String(createTaskForm.status || "PENDING"));
      payload.append("priority", String(createTaskForm.priority || "HIGH"));

      if (String(createTaskForm.due_date || "").trim()) {
        payload.append("due_date", String(createTaskForm.due_date).trim());
      }

      const parsedProgress = numberOrNull(createTaskForm.progress);
      if (parsedProgress !== null) {
        payload.append("progress", String(parsedProgress));
      }

      if (String(createTaskForm.reference_link || "").trim()) {
        payload.append("reference_link", String(createTaskForm.reference_link).trim());
      }

      if (createTaskForm.attachment) {
        payload.append("attachment", createTaskForm.attachment);
      }

      if (createTaskForm.image) {
        payload.append("image", createTaskForm.image);
      }

      await postData("/tasks/", payload);
      setCreateTaskForm({
        title: "",
        description: "",
        assigned_to: "",
        project: "",
        status: "PENDING",
        priority: "HIGH",
        due_date: "",
        progress: "0",
        reference_link: "",
        attachment: null,
        image: null
      });
      await refreshByRole(roleType);
    }, "✅ Task created successfully!");
  };

  const submitLoadManagerProjectTasks = async (e) => {
    e.preventDefault();
    await runAction("manager-project-tasks", async () => {
      const result = await getData(`/all-tasks/?project_id=${projectTaskForm.project_id}`);
      setManagerProjectTasks(toArray(result));
    }, "");
  };

  const buildTaskUpdatePayload = (form) => ({
    title: form.title,
    description: form.description,
    assigned_to: Number(form.assigned_to),
    project: numberOrNull(form.project),
    status: form.status,
    priority: form.priority,
    due_date: form.due_date,
    progress: Number(form.progress),
    reference_link: form.reference_link
  });

  const submitManagerUpdateTask = async (e) => {
    e.preventDefault();

    const canUpdateTask = managerTaskOptions.some((task) => String(task?.id) === String(managerUpdateTaskForm.task_id || ""));
    if (!canUpdateTask) {
      setErrorText("You can only update tasks created by you.");
      return;
    }

    await runAction("manager-update-task", async () => {
      await putData(`/tasks/${managerUpdateTaskForm.task_id}/`, buildTaskUpdatePayload(managerUpdateTaskForm));
      await refreshByRole(roleType);
    }, "✅ Task updated successfully!");
  };

  const submitOwnerUpdateTask = async (e) => {
    e.preventDefault();
    await runAction("owner-update-task", async () => {
      await putData(`/tasks/${ownerUpdateTaskForm.task_id}/`, buildTaskUpdatePayload(ownerUpdateTaskForm));
      await refreshByRole(roleType);
    }, "✅ Task updated successfully!");
  };

  const deleteTaskFromList = async (taskRow) => {
    const taskId = taskRow?.id;
    if (!taskId) return;

    const label = taskRow?.title || taskId;
    const confirmed = typeof window === "undefined" ? true : window.confirm(`Delete task "${label}"?`);
    if (!confirmed) return;

    const numericTaskId = Number(taskId);

    await runAction(`delete-task-${taskId}`, async () => {
      await deleteData(`/tasks/${taskId}/`);
      await refreshByRole(roleType);

      if (String(projectTaskForm.project_id || "").trim()) {
        try {
          const result = await getData(`/all-tasks/?project_id=${projectTaskForm.project_id}`);
          setManagerProjectTasks(toArray(result));
        } catch {
          setManagerProjectTasks((prev) => prev.filter((task) => Number(task?.id) !== numericTaskId));
        }
      } else {
        setManagerProjectTasks((prev) => prev.filter((task) => Number(task?.id) !== numericTaskId));
      }
    }, "✅ Task deleted.");
  };

  const openTaskDetails = (taskRow) => {
    const taskId = taskRow?.id;
    if (taskId === undefined || taskId === null) return;
    navigate(`/task/${taskId}`, { state: { task: taskRow } });
  };

  const openProjectDetails = (projectRow) => {
    const projectId = projectRow?.id;
    if (projectId === undefined || projectId === null) return;
    navigate(`/project/${projectId}`, { state: { project: projectRow } });
  };

  const openUserDetails = (userRow) => {
    const userId = userRow?.id;
    if (userId === undefined || userId === null) return;
    navigate(`/user/${userId}`, { state: { user: userRow } });
  };

  const submitEmployeeUpdateTask = async (e) => {
    e.preventDefault();

    const canUpdateTask = employeeTaskOptions.some((task) => String(task?.id) === String(employeeUpdateTaskForm.task_id || ""));
    if (!canUpdateTask) {
      setErrorText("You can only update tasks assigned to you.");
      return;
    }

    await runAction("employee-update-task", async () => {
      await putData(`/tasks/${employeeUpdateTaskForm.task_id}/`, buildTaskUpdatePayload(employeeUpdateTaskForm));
      await refreshByRole(roleType);
    }, "✅ Task updated successfully!");
  };

  const submitCheckIn = async () => {
    await runAction("checkin", async () => {
      await postData("/attendance/checkin/", {});
      await refreshByRole(roleType);
    }, "✅ Checked in successfully!");
  };

  const submitCheckOut = async () => {
    await runAction("checkout", async () => {
      await postData("/attendance/checkout/", {});
      await refreshByRole(roleType);
    }, "✅ Checked out successfully!");
  };

  const submitLeaveApply = async (e) => {
    e.preventDefault();
    await runAction("apply-leave", async () => {
      await postData("/leave/apply/", leaveApplyForm);
      setLeaveApplyForm({ start_date: "", end_date: "", reason: "" });
      await refreshByRole(roleType);
    }, "✅ Leave application submitted!");
  };

  const updateHrLeaveStatus = async (leaveRow, status) => {
    const leaveId = leaveRow?.id;
    const nextStatus = String(status || "").trim().toUpperCase();
    if (!leaveId || !nextStatus) return;

    await runAction(`hr-leave-${leaveId}-${nextStatus.toLowerCase()}`, async () => {
      await patchData(`/leave/${leaveId}/status/`, { status: nextStatus });
      await loadHrData();
    }, `Leave ${nextStatus.toLowerCase()}`);
  };

  const submitLeaveStatus = async (e) => {
    e.preventDefault();
    await runAction("hr-leave-status", async () => {
      await patchData(`/leave/${leaveStatusForm.leave_id}/status/`, { status: leaveStatusForm.status });
      await loadHrData();
    }, `✅ Leave status updated to ${leaveStatusForm.status}!`);
  };

  const submitPerformanceReview = async (e) => {
    e.preventDefault();
    await runAction("hr-review", async () => {
      await postData(`/review/${reviewForm.employee_id}/`, {
        rating: Number(reviewForm.rating),
        feedback: reviewForm.feedback
      });
      setReviewForm({ employee_id: "", rating: "4", feedback: "" });
    }, "✅ Performance review submitted!");
  };

  const submitCreateDepartment = async (e) => {
    e.preventDefault();
    await runAction("create-department", async () => {
      await postData("/departments/", departmentForm);
      setDepartmentForm({ name: "", description: "" });
      await loadHrData();
    }, "✅ Department created successfully!");
  };

  const handleCompanyLogoChange = (e) => {
    const file = e.target.files?.[0] || null;

    if (!file) {
      setCompanySettingsForm((s) => ({ ...s, logo_file: null }));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setCompanySettingsForm((s) => ({
        ...s,
        logo_file: file,
        logo: typeof reader.result === "string" ? reader.result : s.logo
      }));
    };
    reader.readAsDataURL(file);
  };

  const submitUpdateCompany = async (e) => {
    e.preventDefault();
    await runAction("update-company", async () => {
      const payload = new FormData();
      payload.append("name", companySettingsForm.name);
      payload.append("email", companySettingsForm.email);
      payload.append("phone", companySettingsForm.phone);
      payload.append("size", companySettingsForm.size);
      payload.append("address", companySettingsForm.address);

      const ownerId = numberOrNull(companySettingsForm.owner);
      if (ownerId !== null) payload.append("owner", String(ownerId));
      payload.append("last_user_number", String(Number(companySettingsForm.last_user_number || 0)));

      if (companySettingsForm.logo_file) {
        payload.append("logo", companySettingsForm.logo_file);
      }

      try {
        await putData(`/companies/${companySettingsForm.id}/`, payload);
      } catch {
        await putData(`/company/${companySettingsForm.id}/`, payload);
      }

      await loadOwnerData();
    }, "✅ Company settings saved!");
  };

  const companyColumns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "size", label: "Size" },
    { key: "last_user_number", label: "Users" }
  ];

  const roleColumns = [
    { key: "name", label: "Name" },
    { key: "slug", label: "Slug" },
    { key: "level", label: "Level" },
    {
      key: "actions",
      label: "Actions",
      render: (_, row) => {
        const rowId = row?.id;
        const updating = busyKey === `update-role-${rowId}`;
        const deleting = busyKey === `delete-role-${rowId}`;
        const disabled = !rowId || updating || deleting;

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary !px-2 !py-1 text-xs"
              onClick={() => updateRoleFromList(row)}
              disabled={disabled}
            >
              {updating ? "Saving..." : "Edit"}
            </button>
            <button
              type="button"
              className="btn !bg-rose-600 !px-2 !py-1 text-xs text-white hover:!bg-rose-700"
              onClick={() => deleteRoleFromList(row)}
              disabled={disabled}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        );
      }
    }
  ];

  const roleLevelLookup = useMemo(() => {
    const lookup = {};

    for (const role of roles) {
      const level = role?.level;
      if (role?.id !== undefined && role?.id !== null) lookup[`id:${role.id}`] = level;
      if (role?.name) lookup[String(role.name).trim().toLowerCase()] = level;
      if (role?.slug) lookup[`slug:${String(role.slug).trim().toLowerCase()}`] = level;
    }

    return lookup;
  }, [roles]);

  const roleIdByName = useMemo(() => {
    const lookup = {};

    for (const role of roles) {
      if (role?.id === undefined || role?.id === null) continue;

      if (role?.name) lookup[String(role.name).trim().toLowerCase()] = role.id;
      if (role?.slug) lookup[String(role.slug).trim().toLowerCase()] = role.id;
    }

    return lookup;
  }, [roles]);

  const roleNameById = useMemo(() => {
    const lookup = {};

    for (const role of roles) {
      if (role?.id === undefined || role?.id === null) continue;
      lookup[String(role.id)] = String(role?.name || role?.slug || "").trim().toLowerCase();
    }

    return lookup;
  }, [roles]);
  const createTaskProjectOptions = useMemo(() => {
    const sourceRows =
      activeMenu === "manager-tasks"
        ? managerProjects.length
          ? managerProjects
          : ownerProjects
        : ownerProjects;

    const seen = new Set();
    const options = [];

    for (const row of sourceRows) {
      const id = row?.id;
      if (id === undefined || id === null) continue;

      const key = String(id);
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({
        id: key,
        label: `${row?.name || "Project"}`
      });
    }

    return options;
  }, [activeMenu, managerProjects, ownerProjects]);

  const createTaskAssigneeOptions = useMemo(() => {
    const sourceRows = activeMenu === "manager-tasks" && teamMembers.length ? teamMembers : users;

    const seen = new Set();
    const allOptions = [];
    const employeeOptions = [];

    for (const row of sourceRows) {
      const id = row?.id;
      if (id === undefined || id === null) continue;

      const key = String(id);
      if (seen.has(key)) continue;
      seen.add(key);

      const option = {
        id: key,
        label: `${getUserDisplayName(row)}`
      };

      allOptions.push(option);

      const roleValue = row?.role;
      const roleId =
        typeof roleValue === "number"
          ? roleValue
          : roleValue && typeof roleValue === "object" && roleValue.id !== undefined
            ? roleValue.id
            : null;

      const roleText = String(
        row?.role_name ||
        (roleValue && typeof roleValue === "object" ? roleValue.name || roleValue.slug : roleValue) ||
        (roleId !== null ? roleNameById[String(roleId)] : "") ||
        ""
      )
        .trim()
        .toLowerCase();

      if (roleText.includes("employee")) {
        employeeOptions.push(option);
      }
    }

    return employeeOptions.length ? employeeOptions : allOptions;
  }, [activeMenu, teamMembers, users, roleNameById]);

  const ownerTaskOptions = useMemo(() => toArray(ownerTasks), [ownerTasks]);

  const managerTaskOptions = useMemo(() => {
    const currentCompanyUserId = String(getEntityId(currentUser?.id) || "");
    const seen = new Set();
    const rows = [];

    for (const task of toArray(managerScopedTasks)) {
      const id = task?.id;
      if (id === undefined || id === null) continue;

      const createdBy = String(getEntityId(task?.created_by) || "");
      if (currentCompanyUserId && createdBy !== currentCompanyUserId) continue;

      const key = String(id);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(task);
    }

    return rows;
  }, [currentUser, managerScopedTasks]);

  const employeeTaskOptions = useMemo(() => toArray(employeeTasks), [employeeTasks]);

  const employeeUpdateAssigneeOptions = useMemo(() => {
    const allowedIds = new Set();

    for (const task of employeeTaskOptions) {
      const assignedId = getEntityId(task?.assigned_to);
      if (assignedId === undefined || assignedId === null || assignedId === "") continue;
      allowedIds.add(String(assignedId));
    }

    const filtered = createTaskAssigneeOptions.filter((option) => allowedIds.has(String(option?.id)));
    if (filtered.length) return filtered;

    return Array.from(allowedIds).map((id) => ({
      id,
      label: `User`
    }));
  }, [createTaskAssigneeOptions, employeeTaskOptions]);

  const employeeUpdateProjectOptions = useMemo(() => {
    const allowedIds = new Set();

    for (const task of employeeTaskOptions) {
      const projectId = getEntityId(task?.project);
      if (projectId === undefined || projectId === null || projectId === "") continue;
      allowedIds.add(String(projectId));
    }

    const seen = new Set();
    const options = [];

    for (const row of employeeProjects) {
      const id = row?.id;
      if (id === undefined || id === null) continue;

      const key = String(id);
      if (!allowedIds.has(key) || seen.has(key)) continue;

      seen.add(key);
      options.push({
        id: key,
        label: `${row?.name || "Project"}`
      });
    }

    for (const id of allowedIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      options.push({ id, label: `Project` });
    }

    return options;
  }, [employeeProjects, employeeTaskOptions]);

  const employeeAssignedProjectRows = useMemo(() => {
    const projectIds = new Set();
    const fallbackProjectNames = {};

    for (const task of employeeTaskOptions) {
      const projectValue = task?.project;
      const projectId = String(getEntityId(projectValue) || "");
      if (!projectId) continue;

      projectIds.add(projectId);

      if (projectValue && typeof projectValue === "object" && projectValue.name) {
        fallbackProjectNames[projectId] = String(projectValue.name);
      }
    }

    if (!projectIds.size) return [];

    const seen = new Set();
    const rows = [];

    for (const row of employeeProjects) {
      const id = row?.id;
      if (id === undefined || id === null) continue;

      const key = String(id);
      if (!projectIds.has(key) || seen.has(key)) continue;

      seen.add(key);
      rows.push(row);
    }

    for (const projectId of projectIds) {
      if (seen.has(projectId)) continue;
      seen.add(projectId);
      rows.push({
        id: projectId,
        name: fallbackProjectNames[projectId] || "Project",
        status: "-",
        priority: "-",
        start_date: "-",
        end_date: "-",
        progress: "-"
      });
    }

    return buildProjectsWithTaskProgress(rows, employeeTasks);
  }, [employeeProjects, employeeTaskOptions, employeeTasks]);

  const employeeDashboardMetrics = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    const rows = toArray(employeeTasks);

    const total = rows.length;
    const completed = rows.filter((task) => String(task?.status || "").toUpperCase() === "COMPLETED").length;
    const pending = rows.filter((task) => String(task?.status || "").toUpperCase() === "PENDING").length;
    const overdue = rows.filter((task) => {
      const dueDate = String(task?.due_date || "");
      const status = String(task?.status || "").toUpperCase();
      return dueDate && dueDate < todayISO && (status === "PENDING" || status === "IN_PROGRESS");
    }).length;

    return {
      total_tasks: total,
      completed_tasks: completed,
      pending_tasks: pending,
      overdue_tasks: overdue,
      total_projects: employeeAssignedProjectRows.length
    };
  }, [employeeAssignedProjectRows.length, employeeTasks]);

  const employeeAttendanceRows = useMemo(
    () =>
      [...toArray(attendanceRecords)].sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || ""))),
    [attendanceRecords]
  );
  const handleOwnerTaskSelection = (taskId) => {
    const selectedId = String(taskId || "");
    const task = ownerTaskOptions.find((row) => String(row?.id) === selectedId);

    if (!task) {
      setOwnerUpdateTaskForm((prev) => ({ ...prev, task_id: selectedId }));
      return;
    }

    setOwnerUpdateTaskForm(mapTaskToUpdateForm(task));
  };

  const handleManagerTaskSelection = (taskId) => {
    const selectedId = String(taskId || "");
    const task = managerTaskOptions.find((row) => String(row?.id) === selectedId);

    if (!task) {
      setManagerUpdateTaskForm((prev) => ({ ...prev, task_id: selectedId }));
      return;
    }

    setManagerUpdateTaskForm(mapTaskToUpdateForm(task));
  };

  const handleEmployeeTaskSelection = (taskId) => {
    const selectedId = String(taskId || "");
    const task = employeeTaskOptions.find((row) => String(row?.id) === selectedId);

    if (!task) {
      setEmployeeUpdateTaskForm((prev) => ({ ...prev, task_id: selectedId }));
      return;
    }

    setEmployeeUpdateTaskForm(mapTaskToUpdateForm(task));
  };

  const handleEmployeeTaskRowClick = (row) => {
    const taskId = String(row?.id || "");
    if (!taskId) return;

    handleEmployeeTaskSelection(taskId);
    setEmployeeTaskUpdateVisible(true);
  };
  const handleManagerProjectSelection = (projectId) => {
    const selectedId = String(projectId || "");
    const project = managerProjectRows.find((row) => String(row?.id) === selectedId);

    if (!project) {
      setUpdateProjectForm((prev) => ({ ...prev, project_id: selectedId }));
      return;
    }

    setUpdateProjectForm({
      project_id: selectedId,
      name: String(project?.name || ""),
      description: String(project?.description || ""),
      manager: String(getEntityId(project?.manager) || ""),
      client: String(getEntityId(project?.client) || ""),
      status: String(project?.status || "ACTIVE"),
      priority: String(project?.priority || "MEDIUM"),
      start_date: String(project?.start_date || ""),
      end_date: String(project?.end_date || ""),
      budget: project?.budget !== undefined && project?.budget !== null ? String(project.budget) : "",
      actual_cost: project?.actual_cost !== undefined && project?.actual_cost !== null ? String(project.actual_cost) : "",
      is_active: project?.is_active ?? true
    });
  };

  const ownerTaskMetrics = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);

    const derivedTotal = ownerTasks.length;
    const derivedCompleted = ownerTasks.filter((task) => String(task?.status || "").toUpperCase() === "COMPLETED").length;
    const derivedOverdue = ownerTasks.filter((task) => {
      const dueDate = String(task?.due_date || "");
      const status = String(task?.status || "").toUpperCase();
      return dueDate && dueDate < todayISO && (status === "PENDING" || status === "IN_PROGRESS");
    }).length;

    const apiTotal = Number(taskAnalytics?.total_tasks || 0);
    const apiCompleted = Number(taskAnalytics?.completed_tasks || 0);
    const apiOverdue = Number(taskAnalytics?.overdue_tasks || 0);

    return {
      total_tasks: apiTotal > 0 ? apiTotal : derivedTotal,
      completed_tasks: apiCompleted > 0 ? apiCompleted : derivedCompleted,
      overdue_tasks: apiOverdue > 0 ? apiOverdue : derivedOverdue
    };
  }, [taskAnalytics, ownerTasks]);

  const managerAllTasks = useMemo(() => {
    const merged = [...toArray(managerScopedTasks), ...toArray(myTasks)];
    const seen = new Set();
    const rows = [];

    for (const task of merged) {
      const id = task?.id;
      if (id === undefined || id === null) continue;

      const key = String(id);
      if (seen.has(key)) continue;

      seen.add(key);
      rows.push(task);
    }

    return rows;
  }, [managerScopedTasks, myTasks]);

  const managerOwnTaskRows = useMemo(() => {
    const managerUserId = String(getEntityId(currentUser?.id) || "");
    if (!managerUserId) return [];

    return toArray(myTasks).filter((task) => String(getEntityId(task?.assigned_to) || "") === managerUserId);
  }, [currentUser, myTasks]);

  const managerTeamTaskRows = useMemo(() => {
    const managerUserId = String(getEntityId(currentUser?.id) || "");
    const teamMemberIds = new Set(
      toArray(teamMembers)
        .map((member) => String(member?.id || ""))
        .filter(Boolean)
    );
    const seen = new Set();
    const rows = [];

    for (const task of toArray(teamTasks)) {
      const taskId = String(task?.id || "");
      const assignedId = String(getEntityId(task?.assigned_to) || "");
      if (!taskId || !assignedId || assignedId === managerUserId || !teamMemberIds.has(assignedId) || seen.has(taskId)) continue;
      seen.add(taskId);
      rows.push(task);
    }

    return rows;
  }, [currentUser, teamMembers, teamTasks]);

  const managerVisibleTaskRows = useMemo(() => toArray(managerAllTasks), [managerAllTasks]);

  const managerTaskMetrics = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    const rows = managerVisibleTaskRows;

    const total = rows.length;
    const completed = rows.filter((task) => String(task?.status || "").toUpperCase() === "COMPLETED").length;
    const pending = rows.filter((task) => String(task?.status || "").toUpperCase() === "PENDING").length;
    const inProgress = rows.filter((task) => String(task?.status || "").toUpperCase() === "IN_PROGRESS").length;
    const overdue = rows.filter((task) => {
      const dueDate = String(task?.due_date || "");
      const status = String(task?.status || "").toUpperCase();
      return dueDate && dueDate < todayISO && (status === "PENDING" || status === "IN_PROGRESS");
    }).length;

    return {
      total_tasks: total,
      completed_tasks: completed,
      pending_tasks: pending,
      in_progress_tasks: inProgress,
      overdue_tasks: overdue
    };
  }, [managerVisibleTaskRows]);

  const managerProjectRows = useMemo(
    () => (managerProjects.length ? managerProjects : ownerProjects),
    [managerProjects, ownerProjects]
  );

  const ownerProjectsWithProgress = useMemo(
    () => buildProjectsWithTaskProgress(ownerProjects, ownerTasks),
    [ownerProjects, ownerTasks]
  );

  const clientProjectsWithProgress = useMemo(
    () => buildProjectsWithTaskProgress(clientProjects, []),
    [clientProjects]
  );

  const managerProjectRowsWithProgress = useMemo(
    () => buildProjectsWithTaskProgress(managerProjectRows, managerScopedTasks),
    [managerProjectRows, managerScopedTasks]
  );

  const managerProjectTeamGroups = useMemo(
    () =>
      managerProjectRowsWithProgress.map((project) => ({
        ...project,
        teamMembers: toArray(managerProjectTeamsByProjectId[String(project?.id || "")])
      })),
    [managerProjectRowsWithProgress, managerProjectTeamsByProjectId]
  );

  const managerOverviewCards = useMemo(() => {
    const apiOverview = toObject(managerOverview, EMPTY_MANAGER_OVERVIEW);
    const teamMemberIds = new Set();

    for (const project of managerProjectTeamGroups) {
      for (const member of toArray(project?.teamMembers)) {
        const memberId = String(member?.member_id || member?.id || "");
        if (memberId) teamMemberIds.add(memberId);
      }
    }

    return {
      total_projects:
        managerProjectRows.length > 0 ? managerProjectRows.length : Number(apiOverview.total_projects || 0),
      total_tasks: managerTaskMetrics.total_tasks,
      completed_tasks: managerTaskMetrics.completed_tasks,
      pending_tasks: managerTaskMetrics.pending_tasks,
      in_progress_tasks: managerTaskMetrics.in_progress_tasks,
      overdue_tasks: managerTaskMetrics.overdue_tasks,
      team_members_count:
        users.length > 0
          ? users.length
          : teamMemberIds.size > 0
            ? teamMemberIds.size
            : Number(apiOverview.team_members_count || 0)
    };
  }, [managerOverview, managerProjectRows, managerProjectTeamGroups, managerTaskMetrics, users]);

  const userColumns = [
    {
      key: "name",
      label: "Name",
      render: (_, row) => {
        const rowName = String(row?.name || "").trim();
        if (rowName) return rowName;

        const first = String(row?.first_name || row?.user?.first_name || "").trim();
        const last = String(row?.last_name || row?.user?.last_name || "").trim();
        const full = `${first} ${last}`.trim();

        if (full) return full;
        if (first) return first;

        return "-";
      }
    },
    {
      key: "email",
      label: "Email",
      render: (_, row) => {
        const email =
          row?.email || row?.user_email || row?.user?.email || row?.user_details?.email || "";
        return String(email || "-");
      }
    },
    {
      key: "role",
      label: "Role",
      render: (value, row) => {
        if (value && typeof value === "object") {
          return value?.name || value?.slug || value?.id || "-";
        }
        const roleName = row?.role_name || value;
        return roleName === undefined || roleName === null || roleName === "" ? "-" : String(roleName);
      }
    },
    {
      key: "role_level",
      label: "Level",
      render: (_, row) => {
        const directLevel = row?.level ?? row?.role_level ?? row?.roleLevel ?? row?.role?.level;
        const roleValue = row?.role;

        let mappedLevel;

        if (typeof roleValue === "number") {
          mappedLevel = roleLevelLookup[`id:${roleValue}`];
        } else if (roleValue && typeof roleValue === "object") {
          mappedLevel =
            roleValue.level ??
            (roleValue.id !== undefined ? roleLevelLookup[`id:${roleValue.id}`] : undefined) ??
            (roleValue.name ? roleLevelLookup[String(roleValue.name).trim().toLowerCase()] : undefined);
        } else {
          const roleName = String(row?.role_name || roleValue || "").trim().toLowerCase();
          if (roleName) {
            mappedLevel = roleLevelLookup[roleName] ?? roleLevelLookup[`slug:${roleName}`];
          }
        }

        if (mappedLevel !== undefined && mappedLevel !== null && mappedLevel !== "") {
          return String(mappedLevel);
        }

        if (directLevel !== undefined && directLevel !== null && directLevel !== "") {
          return String(directLevel);
        }

        return "-";
      }
    },
    { key: "status", label: "Status", render: (value) => <StatusPill value={value} /> },
    {
      key: "actions",
      label: "Actions",
      render: (_, row) => {
        const rowId = row?.id;
        const updating = busyKey === `update-user-${rowId}`;
        const deleting = busyKey === `delete-user-${rowId}`;
        const disabled = !permissions.can_manage_users || !rowId || updating || deleting;

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary !px-2 !py-1 text-xs"
              onClick={(e) => { e.stopPropagation(); updateUserFromList(row); }}
              disabled={disabled}
              title={permissions.can_manage_users ? "Edit user" : "No permission"}
            >
              {updating ? "Saving..." : "Edit"}
            </button>
            <button
              type="button"
              className="btn !bg-rose-600 !px-2 !py-1 text-xs text-white hover:!bg-rose-700"
              onClick={(e) => { e.stopPropagation(); deleteUserFromList(row); }}
              disabled={disabled}
              title={permissions.can_manage_users ? "Delete user" : "No permission"}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        );
      }
    }
  ];

  const projectColumns = [
    { key: "name", label: "Name" },
    { key: "status", label: "Status", render: (value) => <StatusPill value={value} /> },
    { key: "priority", label: "Priority", render: (value) => <StatusPill value={value} /> },
    { key: "start_date", label: "Start" },
    { key: "end_date", label: "End" },
    { key: "progress", label: "Progress" }
  ];

  const managerProjectColumns = [
    ...projectColumns,
    {
      key: "actions",
      label: "Actions",
      render: (_, row) => {
        const rowId = row?.id;
        const deleting = busyKey === `delete-project-${rowId}`;
        const disabled = !rowId || deleting;

        return (
          <button
            type="button"
            className="btn !bg-rose-600 !px-2 !py-1 text-xs text-white hover:!bg-rose-700"
            onClick={(e) => { e.stopPropagation(); deleteProjectFromList(row); }}
            disabled={disabled}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        );
      }
    }
  ];

  const readOnlyUserColumns = userColumns.filter((column) => column.key !== "actions");
  
  const managerUserListColumns = readOnlyUserColumns.filter((column) =>
    ["name", "email", "role", "status"].includes(String(column?.key || ""))
  );

  const userListColumns = userColumns.map((column) => {
    if (column.key !== "actions") return column;

    return {
      ...column,
      render: (_, row) => {
        const rowId = row?.id;
        const deleting = busyKey === `delete-user-${rowId}`;
        const disabled = !permissions.can_manage_users || !rowId || deleting;

        return (
          <button
            type="button"
            className="btn !bg-rose-600 !px-2 !py-1 text-xs text-white hover:!bg-rose-700"
            onClick={(e) => { e.stopPropagation(); deleteUserFromList(row); }}
            disabled={disabled}
            title={permissions.can_manage_users ? "Delete user" : "No permission"}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        );
      }
    };
  });

  const managerUserMetrics = useMemo(() => {
    const rows = toArray(users);
    const roleTexts = rows.map((row) => getRoleText(row));

    return {
      total_users: rows.length,
      active_users: rows.filter((row) => String(row?.status || "").toUpperCase() === "ACTIVE").length,
      managers: roleTexts.filter((text) => text.includes("manager")).length,
      employees: roleTexts.filter((text) => text.includes("employee")).length
    };
  }, [users]);

  const ownerProjectMetrics = useMemo(() => {
    const rows = ownerProjectsWithProgress;

    return {
      total_projects: rows.length,
      active_projects: rows.filter((project) => String(project?.status || "").toUpperCase() === "ACTIVE").length,
      completed_projects: rows.filter((project) => String(project?.status || "").toUpperCase() === "COMPLETED").length,
      on_hold_projects: rows.filter((project) => String(project?.status || "").toUpperCase() === "ON_HOLD").length
    };
  }, [ownerProjectsWithProgress]);

  const hrVisibleUsers = useMemo(() => {
    const directRows = toArray(users);
    if (directRows.length) return directRows;

    return buildHrFallbackUserRows(attendanceRecords, hrLeaves, currentUser);
  }, [attendanceRecords, currentUser, hrLeaves, users]);

  const hrEmployeeRows = useMemo(() => {
    const rows = toArray(hrVisibleUsers);
    const filtered = rows.filter((row) => {
      const roleText = getRoleText(row);
      return roleText.includes("employee") || roleText.includes("manager");
    });
    return filtered.length ? filtered : rows;
  }, [hrVisibleUsers]);

  const hrUserNameById = useMemo(() => {
    const lookup = {};

    for (const row of hrEmployeeRows) {
      const id = row?.id;
      if (id === undefined || id === null) continue;
      lookup[String(id)] = getUserDisplayName(row);
    }

    return lookup;
  }, [hrEmployeeRows]);

  const hrUserRoleById = useMemo(() => {
    const lookup = {};

    for (const row of hrEmployeeRows) {
      const id = row?.id;
      if (id === undefined || id === null) continue;
      lookup[String(id)] = String(row?.role || "-");
    }

    return lookup;
  }, [hrEmployeeRows]);

  const resolveHrUserName = (row) => {
    const directName = String(row?.employee_name || row?.company_user_name || row?.user_name || row?.name || "").trim();
    if (directName) return directName;

    const userId = getLinkedCompanyUserId(row);
    return userId ? hrUserNameById[userId] || "-" : "-";
  };

  const resolveHrUserRole = (row) => {
    const directRole = String(row?.employee_role || row?.role_name || row?.role || "").trim();
    if (directRole) return directRole;

    const userId = getLinkedCompanyUserId(row);
    return userId ? hrUserRoleById[userId] || "-" : "-";
  };

  const hrAttendanceColumns = [
    { key: "employee_name", label: "Employee", render: (_, row) => resolveHrUserName(row) },
    { key: "role", label: "Role", render: (_, row) => resolveHrUserRole(row) },
    { key: "date", label: "Date" },
    { key: "check_in", label: "Check-in" },
    { key: "check_out", label: "Check-out" },
    { key: "status", label: "Status", render: (value) => <StatusPill value={value} /> }
  ];

  const hrLeaveApprovalColumns = [
    { key: "employee_name", label: "Name", render: (_, row) => resolveHrUserName(row) },
    { key: "role", label: "Role", render: (_, row) => resolveHrUserRole(row) },
    { key: "start_date", label: "From Date" },
    { key: "end_date", label: "End Date" },
    { key: "reason", label: "Reason" },
    {
      key: "actions",
      label: "Actions",
      render: (_, row) => {
        const leaveId = row?.id;
        const status = String(row?.status || "").trim().toUpperCase();
        const approving = busyKey === `hr-leave-${leaveId}-approved`;
        const rejecting = busyKey === `hr-leave-${leaveId}-rejected`;

        if (status === "APPROVED") {
          return <StatusPill value="APPROVED" />;
        }

        if (status === "REJECTED") {
          return <StatusPill value="REJECTED" />;
        }

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-primary !px-2 !py-1 text-xs"
              onClick={(e) => { e.stopPropagation(); updateHrLeaveStatus(row, "APPROVED"); }}
              disabled={!leaveId || approving || rejecting}
            >
              {approving ? "Approving..." : "Approve"}
            </button>
            <button
              type="button"
              className="btn !bg-rose-600 !px-2 !py-1 text-xs text-white hover:!bg-rose-700"
              onClick={(e) => { e.stopPropagation(); updateHrLeaveStatus(row, "REJECTED"); }}
              disabled={!leaveId || approving || rejecting}
            >
              {rejecting ? "Rejecting..." : "Reject"}
            </button>
          </div>
        );
      }
    }
  ];

  const managerProjectMetrics = useMemo(() => {
    const rows = managerProjectRowsWithProgress;

    return {
      total_projects: rows.length,
      active_projects: rows.filter((project) => String(project?.status || "").toUpperCase() === "ACTIVE").length,
      completed_projects: rows.filter((project) => String(project?.status || "").toUpperCase() === "COMPLETED").length,
      on_hold_projects: rows.filter((project) => String(project?.status || "").toUpperCase() === "ON_HOLD").length
    };
  }, [managerProjectRowsWithProgress]);

  const projectTeamColumns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    {
      key: "role",
      label: "Project Role",
      render: (value) => String(value || "-")
    }
  ];
  const taskUserLabelById = useMemo(() => {
    const merged = [...toArray(users), ...toArray(teamMembers)];
    const lookup = {};

    for (const row of merged) {
      const id = row?.id;
      if (id === undefined || id === null) continue;
      lookup[String(id)] = getUserDisplayName(row);
    }

    return lookup;
  }, [teamMembers, users]);

  const taskProjectLabelById = useMemo(() => {
    const merged = [
      ...toArray(ownerProjects),
      ...toArray(managerProjects),
      ...toArray(employeeProjects),
      ...toArray(clientProjects)
    ];

    const lookup = {};

    for (const row of merged) {
      const id = row?.id;
      if (id === undefined || id === null) continue;
      lookup[String(id)] = String(row?.name || "Project");
    }

    return lookup;
  }, [clientProjects, employeeProjects, managerProjects, ownerProjects]);

  const employeeUserIds = useMemo(() => {
    const rows = [...toArray(users), ...toArray(teamMembers)];
    const ids = new Set();

    for (const row of rows) {
      const rowId = row?.id;
      if (rowId === undefined || rowId === null) continue;

      const roleValue = row?.role;
      const roleId =
        typeof roleValue === "number"
          ? roleValue
          : roleValue && typeof roleValue === "object" && roleValue.id !== undefined
            ? roleValue.id
            : null;

      const roleText = String(
        row?.role_name ||
        (roleValue && typeof roleValue === "object" ? roleValue.name || roleValue.slug : roleValue) ||
        (roleId !== null ? roleNameById[String(roleId)] : "") ||
        ""
      )
        .trim()
        .toLowerCase();

      if (!roleText.includes("employee")) continue;
      ids.add(String(rowId));
    }

    return ids;
  }, [roleNameById, teamMembers, users]);

  const currentCompanyUserId = useMemo(
    () => String(getEntityId(currentUser?.id) || ""),
    [currentUser]
  );

  const ownerMyTaskRows = useMemo(() => {
    if (!currentCompanyUserId) return [];
    return toArray(ownerTasks).filter(
      (task) => String(getEntityId(task?.assigned_to) || "") === currentCompanyUserId
    );
  }, [currentCompanyUserId, ownerTasks]);

  const ownerTeamTaskRows = useMemo(() => {
    if (!currentCompanyUserId) return toArray(ownerTasks);
    return toArray(ownerTasks).filter(
      (task) => String(getEntityId(task?.assigned_to) || "") !== currentCompanyUserId
    );
  }, [currentCompanyUserId, ownerTasks]);

  const ownerEmployeeTaskRows = useMemo(
    () =>
      toArray(ownerTasks).filter((task) => {
        const assignedId = String(getEntityId(task?.assigned_to) || "");
        return assignedId && employeeUserIds.has(assignedId);
      }),
    [employeeUserIds, ownerTasks]
  );

  const managerMyTaskRows = useMemo(() => {
    if (!currentCompanyUserId) return [];
    return toArray(managerAllTasks).filter(
      (task) => String(getEntityId(task?.assigned_to) || "") === currentCompanyUserId
    );
  }, [currentCompanyUserId, managerAllTasks]);

  const managerEmployeeTaskRows = useMemo(
    () =>
      toArray(managerAllTasks).filter((task) => {
        const assignedId = String(getEntityId(task?.assigned_to) || "");
        return assignedId && employeeUserIds.has(assignedId);
      }),
    [employeeUserIds, managerAllTasks]
  );

  const taskProgressSourceRows = useMemo(() => {
    if (activeMenu === "owner-tasks") return toArray(ownerTasks);
    if (activeMenu === "manager-tasks") return toArray(managerAllTasks);
    return [];
  }, [activeMenu, managerAllTasks, ownerTasks]);

  const taskProgressRows = useMemo(() => {
    const grouped = {};

    for (const task of taskProgressSourceRows) {
      const assignedId = String(getEntityId(task?.assigned_to) || "");
      if (!assignedId) continue;
      if (!employeeUserIds.has(assignedId)) continue;

      if (!grouped[assignedId]) grouped[assignedId] = [];
      grouped[assignedId].push(task);
    }

    return Object.entries(grouped)
      .map(([employeeId, tasks]) => ({
        employeeId,
        employeeName: taskUserLabelById[employeeId] || "Employee",
        tasks
      }))
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [employeeUserIds, taskProgressSourceRows, taskUserLabelById]);

  const renderTaskProgressSection = () => (
    <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
      <SectionTitle title="Task Progress" />
      {!taskProgressRows.length ? (
        <p className="text-sm text-slate-500">No employee task mapping found.</p>
      ) : (
        <div className="space-y-3">
          {taskProgressRows.map((row) => {
            const expandedTask =
              row.tasks.find((task) => String(task?.id || "") === String(expandedTaskProgressId || "")) || null;

            return (
              <div key={row.employeeId} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{row.employeeName}</p>
                  {row.tasks.map((task) => {
                    const taskId = String(task?.id || "");
                    const isSelected = String(expandedTaskProgressId || "") === taskId;

                    return (
                      <button
                        key={taskId}
                        type="button"
                        className={isSelected ? "btn bg-brand-600 text-white" : "btn-secondary"}
                        onClick={() =>
                          setExpandedTaskProgressId((prev) => (String(prev || "") === taskId ? "" : taskId))
                        }
                      >
                        {task?.title || "Task"}
                      </button>
                    );
                  })}
                </div>

                {expandedTask ? (
                  <div className="mt-3 rounded border border-slate-200 bg-white p-3">
                    <p className="text-sm font-medium text-slate-900">Description</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{expandedTask.description || "No description"}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Status: {expandedTask.status || "-"} | Priority: {expandedTask.priority || "-"} | Progress: {expandedTask.progress ?? "-"}%
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  const taskColumns = [
    { key: "title", label: "Title" },
    { key: "description", label: "Description" },
    {
      key: "assigned_to",
      label: "Assigned To",
      render: (value) => {
        const id = String(getEntityId(value) || "");
        if (!id) return "-";
        return `${taskUserLabelById[id] || "User"}`;
      }
    },
    {
      key: "created_by",
      label: "Created By",
      render: (value, row) => {
        const directName = String(row?.created_by_name || "").trim();
        if (directName) return directName;
        const id = String(getEntityId(value) || "");
        if (!id) return "-";
        return `${taskUserLabelById[id] || "User"}`;
      }
    },
    { key: "company", label: "Company" },
    {
      key: "project",
      label: "Project",
      render: (value) => {
        const id = String(getEntityId(value) || "");
        if (!id) return "-";
        return `${taskProjectLabelById[id] || "Project"}`;
      }
    },
    { key: "status", label: "Status", render: (value) => <StatusPill value={value} /> },
    { key: "priority", label: "Priority", render: (value) => <StatusPill value={value} /> },
    { key: "due_date", label: "Due Date" },
    { key: "progress", label: "Progress" },
    {
      key: "reference_link",
      label: "Reference",
      render: (value) => {
        if (!value) return "-";
        return <a href={String(value)} className="underline text-sky-700" target="_blank" rel="noreferrer">Open</a>;
      }
    },
    {
      key: "attachment",
      label: "Attachment",
      render: (value) => {
        if (!value) return "-";
        return <a href={String(value)} className="underline text-sky-700" target="_blank" rel="noreferrer">File</a>;
      }
    },
    {
      key: "image",
      label: "Image",
      render: (value) => {
        if (!value) return "-";
        return <a href={String(value)} className="underline text-sky-700" target="_blank" rel="noreferrer">Image</a>;
      }
    },
    { key: "created_at", label: "Created At" }
  ];

  const dashboardTaskListColumns = [
    { key: "title", label: "Name" },
    { key: "status", label: "Status", render: (value) => <StatusPill value={value} /> },
    { key: "progress", label: "Progress" },
    { key: "created_at", label: "Created Date" },
    { key: "due_date", label: "Due Date" },
    {
      key: "created_by",
      label: "Created By",
      render: (value, row) => {
        const directName = String(row?.created_by_name || "").trim();
        if (directName) return directName;
        const id = String(getEntityId(value) || "");
        if (!id) return "-";
        return `${taskUserLabelById[id] || "User"}`;
      }
    },
    { key: "priority", label: "Priority", render: (value) => <StatusPill value={value} /> }
  ];
  const managerTaskColumns = [
    ...taskColumns,
    {
      key: "actions",
      label: "Actions",
      render: (_, row) => {
        const rowId = row?.id;
        const deleting = busyKey === `delete-task-${rowId}`;
        const disabled = !rowId || deleting;

        return (
          <button
            type="button"
            className="btn !bg-rose-600 !px-2 !py-1 text-xs text-white hover:!bg-rose-700"
            onClick={(e) => { e.stopPropagation(); deleteTaskFromList(row); }}
            disabled={disabled}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        );
      }
    }
  ];

  const leaveColumns = [
    { key: "start_date", label: "Start" },
    { key: "end_date", label: "End" },
    { key: "reason", label: "Reason" },
    { key: "status", label: "Status", render: (value) => <StatusPill value={value} /> }
  ];

  const attendanceColumns = [
    { key: "date", label: "Date" },
    { key: "check_in", label: "Check-in" },
    { key: "check_out", label: "Check-out" },
    { key: "status", label: "Status", render: (value) => <StatusPill value={value} /> }
  ];
  const renderManagerProjectTeamSections = () => (
    <>
      {!managerProjectTeamGroups.length ? (
        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <SectionTitle title="Project Teams" />
          <p className="text-sm text-slate-500">No project teams found.</p>
        </section>
      ) : (
        managerProjectTeamGroups.map((project) => (
          <section key={project.id || project.name} className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
            <SectionTitle title={project.name || "Project"} subtitle="GET /api/projects/:project_id/team/" />
            <p className="mb-3 text-sm text-slate-500">
              Status: {project.status || "-"} | Progress: {project.progress || "-"}
            </p>
            <DataTable columns={projectTeamColumns} rows={project.teamMembers} emptyText="No team members for this project" />
          </section>
        ))
      )}
    </>
  );

  const renderAttendanceAndLeaveSections = () => (
    <>
      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <SectionTitle title="Attendance Actions" />
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-900 disabled:opacity-60" onClick={submitCheckIn} disabled={busyKey === "checkin"}>Mark Check-in</button>
          <button className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900 transition hover:bg-blue-100" onClick={submitCheckOut} disabled={busyKey === "checkout"}>Mark Checkout</button>
        </div>
      </section>
      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <SectionTitle title="Attendance History" />
        <DataTable columns={attendanceColumns} rows={employeeAttendanceRows} emptyText="No attendance records" />
      </section>
      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <SectionTitle title="Leaves Applied Status" />
        <DataTable columns={leaveColumns} rows={myLeaves} emptyText="No leave history" />
      </section>
      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <SectionTitle title="Leave Application Form" />
        <form className="grid gap-3 md:grid-cols-2" onSubmit={submitLeaveApply}>
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="date" value={leaveApplyForm.start_date} onChange={(e) => setLeaveApplyForm((s) => ({ ...s, start_date: e.target.value }))} required />
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="date" value={leaveApplyForm.end_date} onChange={(e) => setLeaveApplyForm((s) => ({ ...s, end_date: e.target.value }))} required />
          <label className="space-y-1 text-sm text-slate-700 md:col-span-2"><span className="font-medium">Reason</span><textarea className="input min-h-24 md:col-span-2" value={leaveApplyForm.reason} onChange={(e) => setLeaveApplyForm((s) => ({ ...s, reason: e.target.value }))} required /></label>
          <button className="btn-primary md:col-span-2" disabled={busyKey === "apply-leave"}>{busyKey === "apply-leave" ? "Submitting..." : "Apply Leave"}</button>
        </form>
      </section>
    </>
  );

  return (
    <div className="dashboard-shell">
      <DashboardThemeStyles />
    <main className="min-h-screen" style={{ background: "linear-gradient(180deg, #f8fbff 0%, #f3f7fc 100%)" }}>
      <header className="mb-0 overflow-hidden shadow-xl" style={{ background: "linear-gradient(135deg, #eef4ff 0%, #f8fbff 55%, #ffffff 100%)", borderBottom: "1px solid #d7e4f5", position: "relative" }}>
        <div style={{ position: "absolute", top: -25, right: 80, width: 110, height: 110, borderRadius: "50%", background: "rgba(37,99,235,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 8, right: 30, width: 55, height: 55, borderRadius: "50%", background: "rgba(59,130,246,0.1)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -15, left: 300, width: 70, height: 70, borderRadius: "50%", background: "rgba(22,163,74,0.09)", pointerEvents: "none" }} />
        <div className="relative flex flex-wrap items-center justify-between gap-3 px-6 py-4 md:px-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-white/30" style={{ boxShadow: "0 0 0 4px rgba(30,77,183,0.35)" }}>
              <img src={logo} alt="WorkZen" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-wide" style={{ fontFamily: "'Georgia', serif" }}>{platformName}</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <p className="text-xs font-semibold" style={{ color: "#93c5fd" }}>{dashboardCompanyInfo.name || "Company Dashboard"}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg px-4 py-2 text-sm font-semibold transition hover:bg-blue-50" style={{ background: "#ffffff", border: "1px solid #c7d7ee", color: "#16304f" }} onClick={logout}>Logout</button>
          </div>
        </div>
      </header>

      <div className="grid gap-0 lg:grid-cols-[260px_1fr]" style={{ minHeight: "calc(100vh - 67px)" }}>
        <aside className="border-r border-blue-100/50 p-5 shadow-sm lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto" style={{ background: "rgba(219, 234, 254, 0.5)", backdropFilter: "blur(10px)" }}>
          <div className="mb-5 pb-5" style={{ borderBottom: "1px solid rgba(30,64,175,0.15)" }}>
            {(() => {
              const sidebarRoleStyles = {
                owner: { bg: "linear-gradient(135deg, #eef4ff 0%, #dbeafe 100%)", greet: "#2563eb", badge: "#ffffff", badgeText: "#2563eb" },
                manager: { bg: "linear-gradient(135deg, #eef6ff 0%, #dbeafe 100%)", greet: "#2563eb", badge: "#ffffff", badgeText: "#2563eb" },
                hr: { bg: "linear-gradient(135deg, #ecfeff 0%, #dbeafe 100%)", greet: "#0284c7", badge: "#ffffff", badgeText: "#0369a1" },
                employee: { bg: "linear-gradient(135deg, #eff6ff 0%, #e0edff 100%)", greet: "#1d4ed8", badge: "#ffffff", badgeText: "#1d4ed8" },
                client: { bg: "linear-gradient(135deg, #f0f9ff 0%, #dbeafe 100%)", greet: "#0284c7", badge: "#ffffff", badgeText: "#0369a1" },
              };
              const s = sidebarRoleStyles[roleType] || sidebarRoleStyles.employee;
              return (
                <div className="rounded-xl px-4 py-3 shadow-sm" style={{ background: s.bg, border: "1px solid #d9e3f2" }}>
                  <p className="text-sm font-bold mb-0.5" style={{ color: s.greet }}>Hello!</p>
                  <p className="font-extrabold text-xl leading-tight text-slate-900" style={{ fontFamily: "'Georgia', serif" }}>{dashboardUserName}</p>
                  <span className="inline-block mt-2 rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: s.badge, color: s.badgeText, letterSpacing: "0.06em", border: "1px solid #cfe0fb" }}>{dashboardUserRole}</span>
                </div>
              );
            })()}
          </div>
          <p className="mb-3 text-xs font-extrabold uppercase tracking-widest text-blue-900/40">Navigation</p>
          <div className="space-y-1.5">
            {menus.map((item) => (
              <button
                key={item.id}
                className="w-full rounded-lg px-4 py-3 text-left text-sm font-bold transition-all"
                style={activeMenu === item.id ? {
                  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                  color: "#fff",
                  boxShadow: "0 2px 8px rgba(30,58,138,0.3)",
                  borderLeft: "3px solid #60a5fa"
                } : {
                  color: "#1e3a8a",
                  background: "transparent",
                  borderLeft: "3px solid transparent"
                }}
                onMouseEnter={(e) => { if (activeMenu !== item.id) { e.currentTarget.style.background = "rgba(30,58,138,0.08)"; e.currentTarget.style.borderLeft = "3px solid #93c5fd"; } }}
                onMouseLeave={(e) => { if (activeMenu !== item.id) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderLeft = "3px solid transparent"; } }}
                onClick={() => { setActiveMenu(item.id); persistActiveMenu(item.id); }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-5 p-5 md:p-6">
          {(() => {
            const roleConfigs = {
              owner: { gradient: "linear-gradient(135deg, #eef4ff 0%, #dbeafe 55%, #ffffff 100%)", accent: "#2563eb", badge: "#ffffff", label: "Owner Portal", icon: "OWN" },
              manager: { gradient: "linear-gradient(135deg, #eef6ff 0%, #dbeafe 80%, #ffffff 100%)", accent: "#2563eb", badge: "#ffffff", label: "Manager Portal", icon: "MGR" },
              hr: { gradient: "linear-gradient(135deg, #ecfeff 0%, #dbeafe 60%, #ffffff 100%)", accent: "#0284c7", badge: "#ffffff", label: "HR Portal", icon: "HR" },
              employee: { gradient: "linear-gradient(135deg, #eff6ff 0%, #e0edff 60%, #ffffff 100%)", accent: "#1d4ed8", badge: "#ffffff", label: "Employee Portal", icon: "EMP" },
              client: { gradient: "linear-gradient(135deg, #f0f9ff 0%, #dbeafe 55%, #ffffff 100%)", accent: "#0369a1", badge: "#ffffff", label: "Client Portal", icon: "CLI" },
            };
            const cfg = roleConfigs[roleType] || roleConfigs.employee;
            return (
              <div className="rounded-2xl shadow-md overflow-hidden" style={{ background: cfg.gradient, position: "relative", border: "1px solid #d9e3f2" }}>
                <div style={{ position: "absolute", top: -20, right: 40, width: 100, height: 100, borderRadius: "50%", background: "rgba(37,99,235,0.08)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", bottom: -10, right: 140, width: 60, height: 60, borderRadius: "50%", background: "rgba(14,165,233,0.08)", pointerEvents: "none" }} />
                <div className="relative p-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {dashboardCompanyInfo.logo ? (
                      <img src={dashboardCompanyInfo.logo} alt={dashboardCompanyInfo.name} className="h-12 w-12 rounded-full object-cover" style={{ border: "2px solid rgba(37,99,235,0.18)" }} />
                    ) : (
                      <div className="h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "#ffffff", border: "2px solid rgba(37,99,235,0.18)", color: "#2563eb" }}>
                        {cfg.icon}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-widest mb-0.5" style={{ color: cfg.accent, opacity: 0.9 }}>{dashboardUserRole} Portal</p>
                      <p className="text-xl font-extrabold leading-tight text-slate-900" style={{ fontFamily: "'Georgia', serif" }}>{dashboardCompanyInfo.name || "WorkZen"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-slate-900" style={{ fontFamily: "'Georgia', serif" }}>{dashboardUserName}</p>
                    <span className="inline-flex mt-1 rounded-full px-3 py-0.5 text-xs font-bold" style={{ background: cfg.badge, color: cfg.accent, border: `1px solid ${cfg.accent}33` }}>
                      {dashboardUserRole}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
          {errorText ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{errorText}</p> : null}
          {noticeText ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{noticeText}</p> : null}
          {inviteLink ? (
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
              <p className="font-semibold">Invite Set-Password Link</p>
              <a href={inviteLink} className="break-all font-medium underline" target="_blank" rel="noreferrer">{inviteLink}</a>
            </div>
          ) : null}
          {activeMenu === "owner-dashboard" ? (
            <>
              <SectionTitle title="Owner Overview" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total Clients" value={ownerOverview.total_clients} accent="#1d4ed8" />
                <StatCard label="Total Employees" value={ownerOverview.total_employees} accent="#1d4ed8" />
                <StatCard label="Total Projects" value={ownerOverview.total_projects} accent="#2563eb" />
                <StatCard label="Total Tasks" value={ownerOverview.total_tasks} accent="#2563eb" />
                <StatCard label="Completed" value={ownerOverview.completed_tasks} accent="#16a34a" />
                <StatCard label="Pending" value={ownerOverview.pending_tasks} accent="#d97706" />
                <StatCard label="Completion %" value={ownerOverview.completion_rate} accent="#0891b2" />
                <StatCard label="Overdue" value={ownerOverview.overdue_tasks} accent="#dc2626" />
              </div>
              <section className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #dbeafe", borderTop: "3px solid #2563eb" }}>
                <SectionTitle title="All Tasks" />
                <DataTable columns={dashboardTaskListColumns} rows={ownerTasks} emptyText="No tasks" onRowClick={openTaskDetails} />
              </section>
            </>
          ) : null}

          {activeMenu === "owner-roles" || activeMenu === "manager-roles" || activeMenu === "hr-roles" ? (
            <>
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="New Role" />
                <form className="space-y-3" onSubmit={submitCreateRole}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-medium">Company</span>
                      <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createRoleForm.company} onChange={(e) => setCreateRoleForm((s) => ({ ...s, company: e.target.value }))} required>
                        <option value="">Select company</option>
                        {companyOptions.map((companyOption) => (
                          <option key={companyOption.id} value={companyOption.id}>{companyOption.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Name</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createRoleForm.name} onChange={(e) => setCreateRoleForm((s) => ({ ...s, name: e.target.value }))} required /></label>
                    <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Slug</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createRoleForm.slug} onChange={(e) => setCreateRoleForm((s) => ({ ...s, slug: e.target.value }))} /></label>
                    <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Level</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createRoleForm.level} onChange={(e) => setCreateRoleForm((s) => ({ ...s, level: e.target.value }))} required /></label>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {ROLE_PERMISSION_FIELDS.map((field) => (
                      <label key={field} className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 p-2 text-sm">
                        <input type="checkbox" checked={Boolean(createRoleForm[field])} onChange={(e) => setCreateRoleForm((s) => ({ ...s, [field]: e.target.checked }))} />
                        <span>{field}</span>
                      </label>
                    ))}
                  </div>
                  <button className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-900 disabled:opacity-60" disabled={busyKey === "create-role"}>{busyKey === "create-role" ? "Saving..." : "Save Role"}</button>
                </form>
              </section>
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="Edit Role" />
                <form className="space-y-3" onSubmit={submitUpdateRole}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-medium">Role</span>
                      <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={updateRoleForm.role_id} onChange={(e) => handleUpdateRoleSelection(e.target.value)} required>
                        <option value="">Select role</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>{role?.name || role?.slug || `Role ${role.id}`}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-medium">Company</span>
                      <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={updateRoleForm.company} onChange={(e) => setUpdateRoleForm((s) => ({ ...s, company: e.target.value }))} required>
                        <option value="">Select company</option>
                        {companyOptions.map((companyOption) => (
                          <option key={companyOption.id} value={companyOption.id}>{companyOption.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Name</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={updateRoleForm.name} onChange={(e) => setUpdateRoleForm((s) => ({ ...s, name: e.target.value }))} required /></label>
                    <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Slug</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={updateRoleForm.slug} onChange={(e) => setUpdateRoleForm((s) => ({ ...s, slug: e.target.value }))} /></label>
                    <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Level</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={updateRoleForm.level} onChange={(e) => setUpdateRoleForm((s) => ({ ...s, level: e.target.value }))} required /></label>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {ROLE_PERMISSION_FIELDS.map((field) => (
                      <label key={field} className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 p-2 text-sm">
                        <input type="checkbox" checked={Boolean(updateRoleForm[field])} onChange={(e) => setUpdateRoleForm((s) => ({ ...s, [field]: e.target.checked }))} />
                        <span>{field}</span>
                      </label>
                    ))}
                  </div>
                  <button className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-900 disabled:opacity-60" disabled={!updateRoleForm.role_id || busyKey === `update-role-${updateRoleForm.role_id}`}>{busyKey === `update-role-${updateRoleForm.role_id}` ? "Saving..." : "Save Role"}</button>
                </form>
              </section>
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="Role List" />
                <DataTable columns={roleColumns} rows={roles} emptyText="No roles" />
              </section>
            </>
          ) : null}

          {activeMenu === "owner-users" ? (
            <>
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="New User" />
                <form className="grid gap-3 md:grid-cols-2" onSubmit={submitCreateUser}>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Company</span>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createUserForm.company_id} onChange={(e) => setCreateUserForm((s) => ({ ...s, company_id: e.target.value, role_id: "" }))} required>
                      <option value="">Select company</option>
                      {companyOptions.map((companyOption) => (
                        <option key={companyOption.id} value={companyOption.id}>{companyOption.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">First Name</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createUserForm.first_name} onChange={(e) => setCreateUserForm((s) => ({ ...s, first_name: e.target.value }))} required /></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Email</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="email" value={createUserForm.email} onChange={(e) => setCreateUserForm((s) => ({ ...s, email: e.target.value }))} required /></label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Role</span>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createUserForm.role_id} onChange={(e) => setCreateUserForm((s) => ({ ...s, role_id: e.target.value }))} disabled={!createUserRoleOptions.length} required>
                      <option value="">{createUserRoleOptions.length ? "Select role" : "No roles available"}</option>
                      {createUserRoleOptions.map((roleOption) => (
                        <option key={roleOption.id} value={roleOption.id}>{roleOption.label}</option>
                      ))}
                    </select>
                  </label>
                  <button className="btn-primary md:col-span-2" disabled={busyKey === "create-user" || !createUserRoleOptions.length}>{busyKey === "create-user" ? "Saving..." : "Save User"}</button>
                </form>
              </section>
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="User List" />
                <DataTable columns={userListColumns} rows={users} emptyText="No users" onRowClick={openUserDetails} />
              </section>
            </>
          ) : null}

          {activeMenu === "manager-users" ? (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Total Users" value={managerUserMetrics.total_users} />
                <StatCard label="Active" value={managerUserMetrics.active_users} />
                <StatCard label="Managers" value={managerUserMetrics.managers} />
                <StatCard label="Employees" value={managerUserMetrics.employees} />
              </section>
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="New User" />
                <form className="grid gap-3 md:grid-cols-2" onSubmit={submitCreateUser}>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Company</span>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createUserForm.company_id} onChange={(e) => setCreateUserForm((s) => ({ ...s, company_id: e.target.value, role_id: "" }))} required>
                      <option value="">Select company</option>
                      {companyOptions.map((companyOption) => (
                        <option key={companyOption.id} value={companyOption.id}>{companyOption.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">First Name</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createUserForm.first_name} onChange={(e) => setCreateUserForm((s) => ({ ...s, first_name: e.target.value }))} required /></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Email</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="email" value={createUserForm.email} onChange={(e) => setCreateUserForm((s) => ({ ...s, email: e.target.value }))} required /></label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Role</span>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createUserForm.role_id} onChange={(e) => setCreateUserForm((s) => ({ ...s, role_id: e.target.value }))} disabled={!createUserRoleOptions.length} required>
                      <option value="">{createUserRoleOptions.length ? "Select role" : "No roles available"}</option>
                      {createUserRoleOptions.map((roleOption) => (
                        <option key={roleOption.id} value={roleOption.id}>{roleOption.label}</option>
                      ))}
                    </select>
                  </label>
                  <button className="btn-primary md:col-span-2" disabled={busyKey === "create-user" || !createUserRoleOptions.length}>{busyKey === "create-user" ? "Saving..." : "Save User"}</button>
                </form>
              </section>
              
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="User List" />
                <DataTable columns={managerUserListColumns} rows={users} emptyText="No users" onRowClick={openUserDetails} />
              </section>
            </>
          ) : null}
          {activeMenu === "owner-projects" ? (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Total Projects" value={ownerProjectMetrics.total_projects} />
                <StatCard label="Active" value={ownerProjectMetrics.active_projects} />
                <StatCard label="Completed" value={ownerProjectMetrics.completed_projects} />
                <StatCard label="On Hold" value={ownerProjectMetrics.on_hold_projects} />
              </section>
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="New Project" />
                <form className="grid gap-3 md:grid-cols-2" onSubmit={submitCreateProject}>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Name</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createProjectForm.name} onChange={(e) => setCreateProjectForm((s) => ({ ...s, name: e.target.value }))} required /></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Manager</span><select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createProjectForm.manager} onChange={(e) => setCreateProjectForm((s) => ({ ...s, manager: e.target.value }))}><option value="">Select manager</option>{managerUserOptions.map((option) => (<option key={option.id} value={option.id}>{option.label}</option>))}</select></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Client</span><select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createProjectForm.client} onChange={(e) => setCreateProjectForm((s) => ({ ...s, client: e.target.value }))}><option value="">Select client</option>{clientUserOptions.map((option) => (<option key={option.id} value={option.id}>{option.label}</option>))}</select></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Status</span><select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createProjectForm.status} onChange={(e) => setCreateProjectForm((s) => ({ ...s, status: e.target.value }))}><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="ON_HOLD">On Hold</option></select></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Priority</span><select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createProjectForm.priority} onChange={(e) => setCreateProjectForm((s) => ({ ...s, priority: e.target.value }))}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Start Date</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="date" value={createProjectForm.start_date} onChange={(e) => setCreateProjectForm((s) => ({ ...s, start_date: e.target.value }))} required /></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">End Date</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="date" value={createProjectForm.end_date} onChange={(e) => setCreateProjectForm((s) => ({ ...s, end_date: e.target.value }))} /></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Budget</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createProjectForm.budget} onChange={(e) => setCreateProjectForm((s) => ({ ...s, budget: e.target.value }))} /></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Actual Cost</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createProjectForm.actual_cost} onChange={(e) => setCreateProjectForm((s) => ({ ...s, actual_cost: e.target.value }))} /></label>
                  <label className="space-y-1 text-sm text-slate-700 md:col-span-2"><span className="font-medium">Description</span><textarea className="input min-h-24 md:col-span-2" value={createProjectForm.description} onChange={(e) => setCreateProjectForm((s) => ({ ...s, description: e.target.value }))} /></label>
                  <label className="md:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={createProjectForm.is_active} onChange={(e) => setCreateProjectForm((s) => ({ ...s, is_active: e.target.checked }))} /> Active</label>
                  <button className="btn-primary md:col-span-2" disabled={busyKey === "create-project"}>{busyKey === "create-project" ? "Saving..." : "Save Project"}</button>
                </form>
              </section>
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="All Projects" />
                <DataTable columns={managerProjectColumns} rows={ownerProjectsWithProgress} emptyText="No projects" onRowClick={openProjectDetails} />
              </section>
            </>
          ) : null}
          {activeMenu === "owner-tasks" ? (
            <>
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="New Task" />
                {permissions.can_assign_task ? (
                  <form className="grid gap-3 md:grid-cols-2" onSubmit={submitCreateTask}>
                    <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Title</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createTaskForm.title} onChange={(e) => setCreateTaskForm((s) => ({ ...s, title: e.target.value }))} required /></label>
                    <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Assign To</span><select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createTaskForm.assigned_to} onChange={(e) => setCreateTaskForm((s) => ({ ...s, assigned_to: e.target.value }))} required><option value="">Select employee</option>{createTaskAssigneeOptions.map((option) => (<option key={option.id} value={option.id}>{option.label}</option>))}</select></label>
                    <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Project</span><select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createTaskForm.project} onChange={(e) => setCreateTaskForm((s) => ({ ...s, project: e.target.value }))}><option value="">None (No Project)</option>{createTaskProjectOptions.map((option) => (<option key={option.id} value={option.id}>{option.label}</option>))}</select></label>
                    <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Due Date</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="date" value={createTaskForm.due_date} onChange={(e) => setCreateTaskForm((s) => ({ ...s, due_date: e.target.value }))} required /></label>
                    <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Status</span><select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createTaskForm.status} onChange={(e) => setCreateTaskForm((s) => ({ ...s, status: e.target.value }))}><option value="PENDING">Pending</option><option value="IN_PROGRESS">In Progress</option><option value="COMPLETED">Completed</option></select></label>
                    <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Priority</span><select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createTaskForm.priority} onChange={(e) => setCreateTaskForm((s) => ({ ...s, priority: e.target.value }))}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></label>
                    <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Progress</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createTaskForm.progress} onChange={(e) => setCreateTaskForm((s) => ({ ...s, progress: e.target.value }))} required /></label>
                    <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Reference Link</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createTaskForm.reference_link} onChange={(e) => setCreateTaskForm((s) => ({ ...s, reference_link: e.target.value }))} /></label>
                    <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Attachment</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="file" onChange={(e) => setCreateTaskForm((s) => ({ ...s, attachment: e.target.files?.[0] || null }))} /></label>
                    <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Image</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="file" accept="image/*" onChange={(e) => setCreateTaskForm((s) => ({ ...s, image: e.target.files?.[0] || null }))} /></label>
                    <label className="space-y-1 text-sm text-slate-700 md:col-span-2"><span className="font-medium">Description</span><textarea className="input min-h-24" value={createTaskForm.description} onChange={(e) => setCreateTaskForm((s) => ({ ...s, description: e.target.value }))} required /></label>
                    <button className="btn-primary md:col-span-2" disabled={busyKey === "create-task"}>{busyKey === "create-task" ? "Saving..." : "Save Task"}</button>
                  </form>
                ) : (
                  <p className="text-sm text-slate-500">You do not have permission to create tasks.</p>
                )}
              </section>
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="Total Tasks" value={ownerTaskMetrics.total_tasks} />
                <StatCard label="Completed" value={ownerTaskMetrics.completed_tasks} />
                <StatCard label="Overdue" value={ownerTaskMetrics.overdue_tasks} />
              </section>
              {renderTaskProgressSection()}
              <section className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #dbeafe", borderTop: "3px solid #2563eb" }}>
                <SectionTitle title="All Tasks" />
                <DataTable columns={dashboardTaskListColumns} rows={ownerTasks} emptyText="No tasks" onRowClick={openTaskDetails} />
              </section>
            </>
          ) : null}
          {activeMenu === "owner-company" ? (
            <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <SectionTitle title="Company Settings" />
              <form className="grid gap-3 md:grid-cols-2" onSubmit={submitUpdateCompany}>
                <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Company</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={companySettingsForm.id} onChange={(e) => setCompanySettingsForm((s) => ({ ...s, id: e.target.value }))} required /></label>
                <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Name</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={companySettingsForm.name} onChange={(e) => setCompanySettingsForm((s) => ({ ...s, name: e.target.value }))} required /></label>
                <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Email</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={companySettingsForm.email} onChange={(e) => setCompanySettingsForm((s) => ({ ...s, email: e.target.value }))} required /></label>
                <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Phone</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={companySettingsForm.phone} onChange={(e) => setCompanySettingsForm((s) => ({ ...s, phone: e.target.value }))} required /></label>
                <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Size</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={companySettingsForm.size} onChange={(e) => setCompanySettingsForm((s) => ({ ...s, size: e.target.value }))} required /></label>
                <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Owner</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={companySettingsForm.owner} onChange={(e) => setCompanySettingsForm((s) => ({ ...s, owner: e.target.value }))} /></label>
                <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Last User Number</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={companySettingsForm.last_user_number} onChange={(e) => setCompanySettingsForm((s) => ({ ...s, last_user_number: e.target.value }))} /></label>
                <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Logo</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="file" accept="image/*" onChange={handleCompanyLogoChange} /></label>
                <label className="space-y-1 text-sm text-slate-700 md:col-span-2"><span className="font-medium">Address</span><textarea className="input min-h-24 md:col-span-2" value={companySettingsForm.address} onChange={(e) => setCompanySettingsForm((s) => ({ ...s, address: e.target.value }))} /></label>
                <button className="btn-primary md:col-span-2" disabled={busyKey === "update-company"}>{busyKey === "update-company" ? "Saving..." : "Save Company"}</button>
              </form>
            </section>
          ) : null}

          {activeMenu === "manager-dashboard" ? (
            <>
              {/* Scorecard strip */}
              <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid #dbeafe" }}>
                <div className="px-5 py-2.5 flex items-center justify-between" style={{ background: "linear-gradient(90deg, #0d2760, #1e3a8a)" }}>
                  <span className="text-sm font-extrabold text-white" style={{ fontFamily: "'Georgia', serif" }}>Manager Overview</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)", color: "#bfdbfe" }}>Live</span>
                </div>
                <div className="grid grid-cols-4 divide-x bg-white" style={{ borderTop: "1px solid #dbeafe", divideColor: "#dbeafe" }}>
                  {[
                    { label: "Projects", value: managerOverviewCards.total_projects, color: "#2563eb" },
                    { label: "Total Tasks", value: managerOverviewCards.total_tasks, color: "#1d4ed8" },
                    { label: "Completed", value: managerOverviewCards.completed_tasks, color: "#16a34a" },
                    { label: "Team Size", value: managerOverviewCards.team_members_count, color: "#7c3aed" },
                  ].map((item) => (
                    <div key={item.label} className="flex flex-col items-center py-4 px-2">
                      <span className="text-3xl font-extrabold" style={{ fontFamily: "'Georgia', serif", color: item.color }}>{item.value ?? 0}</span>
                      <span className="mt-1 text-xs font-bold uppercase tracking-widest" style={{ color: item.color + "99" }}>{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 divide-x bg-slate-50" style={{ borderTop: "1px solid #dbeafe" }}>
                  {[
                    { label: "Pending", value: managerOverviewCards.pending_tasks, color: "#d97706" },
                    { label: "In Progress", value: managerOverviewCards.in_progress_tasks, color: "#0891b2" },
                    { label: "Overdue", value: managerOverviewCards.overdue_tasks, color: "#dc2626" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-2xl font-extrabold" style={{ color: item.color, fontFamily: "'Georgia', serif" }}>{item.value ?? 0}</span>
                      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: item.color + "bb" }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Projects full width */}
              <section className="rounded-2xl bg-white shadow-sm overflow-hidden" style={{ border: "1px solid #dbeafe" }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ background: "linear-gradient(90deg, #2563eb15, #2563eb08)", borderBottom: "2px solid #2563eb" }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2563eb" }} />
                  <span className="text-sm font-extrabold text-blue-900" style={{ fontFamily: "'Georgia', serif" }}>My Projects</span>
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#dbeafe", color: "#1d4ed8" }}>{managerProjectRowsWithProgress.length}</span>
                </div>
                <div className="p-4">
                  <DataTable columns={managerProjectColumns} rows={managerProjectRowsWithProgress} emptyText="No projects" onRowClick={openProjectDetails} />
                </div>
              </section>

              {/* Tasks full width */}
              <section className="rounded-2xl bg-white shadow-sm overflow-hidden" style={{ border: "1px solid #dbeafe" }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ background: "linear-gradient(90deg, #0891b215, #0891b208)", borderBottom: "2px solid #0891b2" }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#0891b2" }} />
                  <span className="text-sm font-extrabold text-blue-900" style={{ fontFamily: "'Georgia', serif" }}>My Tasks</span>
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#cffafe", color: "#0891b2" }}>{managerOwnTaskRows.length}</span>
                </div>
                <div className="p-4">
                  <DataTable columns={dashboardTaskListColumns} rows={managerOwnTaskRows} emptyText="No tasks assigned to manager" onRowClick={openTaskDetails} />
                </div>
              </section>

              {/* Leaves full width */}
              <section className="rounded-2xl bg-white shadow-sm overflow-hidden" style={{ border: "1px solid #dbeafe" }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ background: "linear-gradient(90deg, #d9770615, #d9770608)", borderBottom: "2px solid #d97706" }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#d97706" }} />
                  <span className="text-sm font-extrabold text-blue-900" style={{ fontFamily: "'Georgia', serif" }}>My Leaves</span>
                </div>
                <div className="p-4">
                  <DataTable columns={leaveColumns} rows={myLeaves} emptyText="No leaves" />
                </div>
              </section>
            </>
          ) : null}
          {activeMenu === "manager-projects" ? (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Total Projects" value={managerProjectMetrics.total_projects} />
                <StatCard label="Active" value={managerProjectMetrics.active_projects} />
                <StatCard label="Completed" value={managerProjectMetrics.completed_projects} />
                <StatCard label="On Hold" value={managerProjectMetrics.on_hold_projects} />
              </section>
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="New Project" />
                <form className="grid gap-3 md:grid-cols-2" onSubmit={submitCreateProject}>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Name</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createProjectForm.name} onChange={(e) => setCreateProjectForm((s) => ({ ...s, name: e.target.value }))} required /></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Manager</span><select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createProjectForm.manager} onChange={(e) => setCreateProjectForm((s) => ({ ...s, manager: e.target.value }))}><option value="">Select manager</option>{managerUserOptions.map((option) => (<option key={option.id} value={option.id}>{option.label}</option>))}</select></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Client</span><select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createProjectForm.client} onChange={(e) => setCreateProjectForm((s) => ({ ...s, client: e.target.value }))}><option value="">Select client</option>{clientUserOptions.map((option) => (<option key={option.id} value={option.id}>{option.label}</option>))}</select></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Status</span><select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createProjectForm.status} onChange={(e) => setCreateProjectForm((s) => ({ ...s, status: e.target.value }))}><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="ON_HOLD">On Hold</option></select></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Priority</span><select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createProjectForm.priority} onChange={(e) => setCreateProjectForm((s) => ({ ...s, priority: e.target.value }))}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Start Date</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="date" value={createProjectForm.start_date} onChange={(e) => setCreateProjectForm((s) => ({ ...s, start_date: e.target.value }))} required /></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">End Date</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="date" value={createProjectForm.end_date} onChange={(e) => setCreateProjectForm((s) => ({ ...s, end_date: e.target.value }))} /></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Budget</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createProjectForm.budget} onChange={(e) => setCreateProjectForm((s) => ({ ...s, budget: e.target.value }))} /></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Actual Cost</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createProjectForm.actual_cost} onChange={(e) => setCreateProjectForm((s) => ({ ...s, actual_cost: e.target.value }))} /></label>
                  <label className="space-y-1 text-sm text-slate-700 md:col-span-2"><span className="font-medium">Description</span><textarea className="input min-h-24 md:col-span-2" value={createProjectForm.description} onChange={(e) => setCreateProjectForm((s) => ({ ...s, description: e.target.value }))} /></label>
                  <label className="md:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={createProjectForm.is_active} onChange={(e) => setCreateProjectForm((s) => ({ ...s, is_active: e.target.checked }))} /> Active</label>
                  <button className="btn-primary md:col-span-2" disabled={busyKey === "create-project"}>{busyKey === "create-project" ? "Saving..." : "Save Project"}</button>
                </form>
              </section>
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="Project List" />
                <DataTable columns={managerProjectColumns} rows={managerProjectRowsWithProgress} emptyText="No projects" onRowClick={openProjectDetails} />
              </section>
            </>
          ) : null}
          {activeMenu === "manager-tasks" ? (
            <>
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="Total Tasks" value={managerTaskMetrics.total_tasks} />
                <StatCard label="Completed" value={managerTaskMetrics.completed_tasks} />
                <StatCard label="Overdue" value={managerTaskMetrics.overdue_tasks} />
              </section>
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="New Task" />
                <form className="grid gap-3 md:grid-cols-2" onSubmit={submitCreateTask}>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Title</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createTaskForm.title} onChange={(e) => setCreateTaskForm((s) => ({ ...s, title: e.target.value }))} required /></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Assign To</span><select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createTaskForm.assigned_to} onChange={(e) => setCreateTaskForm((s) => ({ ...s, assigned_to: e.target.value }))} required><option value="">Select employee</option>{createTaskAssigneeOptions.map((option) => (<option key={option.id} value={option.id}>{option.label}</option>))}</select></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Project</span><select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createTaskForm.project} onChange={(e) => setCreateTaskForm((s) => ({ ...s, project: e.target.value }))}><option value="">None (No Project)</option>{createTaskProjectOptions.map((option) => (<option key={option.id} value={option.id}>{option.label}</option>))}</select></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Due Date</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="date" value={createTaskForm.due_date} onChange={(e) => setCreateTaskForm((s) => ({ ...s, due_date: e.target.value }))} required /></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Status</span><select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createTaskForm.status} onChange={(e) => setCreateTaskForm((s) => ({ ...s, status: e.target.value }))}><option value="PENDING">Pending</option><option value="IN_PROGRESS">In Progress</option><option value="COMPLETED">Completed</option></select></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Priority</span><select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createTaskForm.priority} onChange={(e) => setCreateTaskForm((s) => ({ ...s, priority: e.target.value }))}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Progress</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createTaskForm.progress} onChange={(e) => setCreateTaskForm((s) => ({ ...s, progress: e.target.value }))} required /></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Reference Link</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createTaskForm.reference_link} onChange={(e) => setCreateTaskForm((s) => ({ ...s, reference_link: e.target.value }))} /></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Attachment</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="file" onChange={(e) => setCreateTaskForm((s) => ({ ...s, attachment: e.target.files?.[0] || null }))} /></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Image</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="file" accept="image/*" onChange={(e) => setCreateTaskForm((s) => ({ ...s, image: e.target.files?.[0] || null }))} /></label>
                  <label className="space-y-1 text-sm text-slate-700 md:col-span-2"><span className="font-medium">Description</span><textarea className="input min-h-24" value={createTaskForm.description} onChange={(e) => setCreateTaskForm((s) => ({ ...s, description: e.target.value }))} required /></label>
                  <button className="btn-primary md:col-span-2" disabled={busyKey === "create-task"}>Save Task</button>
                </form>
              </section>
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="Task List" />
                <DataTable columns={dashboardTaskListColumns} rows={managerVisibleTaskRows} emptyText="No tasks" onRowClick={openTaskDetails} />
              </section>
            </>
          ) : null}
          {activeMenu === "employee-dashboard" ? (
            <>
              {/* Personal progress banner */}
              <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid #dbeafe" }}>
                <div className="px-5 py-3 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #1a3a6b 0%, #2563eb 100%)" }}>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#bfdbfe" }}>My Work Summary</p>
                    <p className="text-lg font-extrabold text-white mt-0.5" style={{ fontFamily: "'Georgia', serif" }}>
                      {employeeDashboardMetrics.completed_tasks} of {employeeDashboardMetrics.total_tasks} tasks completed
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-extrabold text-white" style={{ fontFamily: "'Georgia', serif" }}>
                      {employeeDashboardMetrics.total_tasks > 0 ? Math.round((employeeDashboardMetrics.completed_tasks / employeeDashboardMetrics.total_tasks) * 100) : 0}%
                    </p>
                    <p className="text-xs font-semibold mt-0.5" style={{ color: "#93c5fd" }}>completion rate</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-2 bg-blue-100">
                  <div className="h-2 rounded-r-full transition-all" style={{
                    width: `${employeeDashboardMetrics.total_tasks > 0 ? Math.round((employeeDashboardMetrics.completed_tasks / employeeDashboardMetrics.total_tasks) * 100) : 0}%`,
                    background: "linear-gradient(90deg, #2563eb, #16a34a)"
                  }} />
                </div>
                {/* Mini stat strip */}
                <div className="grid grid-cols-4 divide-x bg-white py-2" style={{ borderTop: "1px solid #f0f5ff" }}>
                  {[
                    { label: "Pending", value: employeeDashboardMetrics.pending_tasks, color: "#d97706" },
                    { label: "In Progress", value: (employeeDashboardMetrics.total_tasks - employeeDashboardMetrics.completed_tasks - employeeDashboardMetrics.pending_tasks), color: "#0891b2" },
                    { label: "Overdue", value: employeeDashboardMetrics.overdue_tasks, color: "#dc2626" },
                    { label: "Projects", value: employeeDashboardMetrics.total_projects, color: "#7c3aed" },
                  ].map((item) => (
                    <div key={item.label} className="flex flex-col items-center py-2">
                      <span className="text-xl font-extrabold" style={{ color: item.color, fontFamily: "'Georgia', serif" }}>{item.value ?? 0}</span>
                      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: item.color + "99" }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Projects full width */}
              <section className="rounded-2xl bg-white shadow-sm overflow-hidden" style={{ border: "1px solid #dbeafe" }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ background: "linear-gradient(90deg, #7c3aed15, #7c3aed08)", borderBottom: "2px solid #7c3aed" }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#7c3aed" }} />
                  <span className="text-sm font-extrabold text-blue-900" style={{ fontFamily: "'Georgia', serif" }}>My Projects</span>
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#ede9fe", color: "#7c3aed" }}>{employeeAssignedProjectRows.length}</span>
                </div>
                <div className="p-4">
                  <DataTable columns={projectColumns} rows={employeeAssignedProjectRows} emptyText="No assigned projects" />
                </div>
              </section>

              {/* Tasks full width */}
              <section className="rounded-2xl bg-white shadow-sm overflow-hidden" style={{ border: "1px solid #dbeafe" }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ background: "linear-gradient(90deg, #2563eb15, #2563eb08)", borderBottom: "2px solid #2563eb" }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2563eb" }} />
                  <span className="text-sm font-extrabold text-blue-900" style={{ fontFamily: "'Georgia', serif" }}>My Tasks</span>
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#dbeafe", color: "#1d4ed8" }}>{employeeTasks.length}</span>
                </div>
                <div className="p-4">
                  <DataTable columns={dashboardTaskListColumns} rows={employeeTasks} emptyText="No tasks" onRowClick={openTaskDetails} />
                </div>
              </section>
            </>
          ) : null}

          {activeMenu === "employee-attendance" || activeMenu === "manager-attendance" ? renderAttendanceAndLeaveSections() : null}

          {activeMenu === "hr-dashboard" ? (
            <>
              {/* HR Command strip */}
              <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid #dbeafe" }}>
                <div className="px-5 py-2.5 flex items-center justify-between" style={{ background: "linear-gradient(90deg, #1e3a5f, #1565c0)" }}>
                  <span className="text-sm font-extrabold text-white" style={{ fontFamily: "'Georgia', serif" }}>HR Overview</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)", color: "#a5d8ff" }}>{hrOverview.total_employees ?? 0} Employees</span>
                </div>
                {/* Attendance % bar */}
                <div className="px-5 pt-3 pb-1 bg-white">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#1d4ed899" }}>Attendance Rate</span>
                    <span className="text-sm font-extrabold" style={{ color: "#1d4ed8" }}>{hrOverview.attendance?.attendance_percentage ?? 0}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-blue-100 overflow-hidden">
                    <div className="h-2.5 rounded-full transition-all" style={{
                      width: `${hrOverview.attendance?.attendance_percentage ?? 0}%`,
                      background: "linear-gradient(90deg, #16a34a, #0891b2)"
                    }} />
                  </div>
                </div>
                {/* Stat cards grid - attendance */}
                <div className="p-4 bg-white" style={{ borderTop: "1px solid #f0f5ff" }}>
                  <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: "#1d4ed899" }}>Today's Attendance</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Present", value: hrOverview.attendance?.present, color: "#16a34a" },
                      { label: "Absent", value: hrOverview.attendance?.absent, color: "#dc2626" },
                      { label: "Half Day", value: hrOverview.attendance?.half_day, color: "#d97706" },
                      { label: "On Leave", value: hrOverview.attendance?.on_leave, color: "#0891b2" },
                    ].map((item) => (
                      <article key={item.label} className="rounded-lg bg-white p-3 shadow-sm" style={{ border: "1px solid #e0eaff", borderLeft: `3px solid ${item.color}`, position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", top: -8, right: -8, width: 32, height: 32, borderRadius: "50%", background: item.color + "12", pointerEvents: "none" }} />
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: item.color + "99" }}>{item.label}</p>
                        <p className="mt-1 text-xl font-extrabold" style={{ fontFamily: "'Georgia', serif", color: item.color }}>{item.value ?? 0}</p>
                      </article>
                    ))}
                  </div>
                  <p className="text-xs font-extrabold uppercase tracking-widest mb-3 mt-4" style={{ color: "#1d4ed899" }}>Leave Summary</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Approved", value: hrOverview.leave_summary?.approved, color: "#16a34a" },
                      { label: "Pending", value: hrOverview.leave_summary?.pending, color: "#d97706" },
                      { label: "Rejected", value: hrOverview.leave_summary?.rejected, color: "#dc2626" },
                      { label: "Total Staff", value: hrOverview.total_employees, color: "#1d4ed8" },
                    ].map((item) => (
                      <article key={item.label} className="rounded-lg bg-white p-3 shadow-sm" style={{ border: "1px solid #e0eaff", borderLeft: `3px solid ${item.color}`, position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", top: -8, right: -8, width: 32, height: 32, borderRadius: "50%", background: item.color + "12", pointerEvents: "none" }} />
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: item.color + "99" }}>{item.label}</p>
                        <p className="mt-1 text-xl font-extrabold" style={{ fontFamily: "'Georgia', serif", color: item.color }}>{item.value ?? 0}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>

              {/* Add Employee + User List side by side */}
              <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
                <section className="rounded-2xl bg-white shadow-sm overflow-hidden" style={{ border: "1px solid #dbeafe" }}>
                  <div className="px-4 py-3 flex items-center gap-2" style={{ background: "linear-gradient(90deg, #16a34a15, #16a34a08)", borderBottom: "2px solid #16a34a" }}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#16a34a" }} />
                    <span className="text-sm font-extrabold text-blue-900" style={{ fontFamily: "'Georgia', serif" }}>Add Employee</span>
                  </div>
                  <div className="p-4">
                    <form className="space-y-3" onSubmit={submitCreateUser}>
                      <label className="block space-y-1 text-sm text-slate-700">
                        <span className="font-semibold text-blue-900">Company</span>
                        <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createUserForm.company_id} onChange={(e) => setCreateUserForm((s) => ({ ...s, company_id: e.target.value, role_id: "" }))} required>
                          <option value="">Select company</option>
                          {companyOptions.map((companyOption) => (
                            <option key={companyOption.id} value={companyOption.id}>{companyOption.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1 text-sm text-slate-700"><span className="font-semibold text-blue-900">First Name</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createUserForm.first_name} onChange={(e) => setCreateUserForm((s) => ({ ...s, first_name: e.target.value }))} required /></label>
                      <label className="block space-y-1 text-sm text-slate-700"><span className="font-semibold text-blue-900">Email</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="email" value={createUserForm.email} onChange={(e) => setCreateUserForm((s) => ({ ...s, email: e.target.value }))} required /></label>
                      <label className="block space-y-1 text-sm text-slate-700">
                        <span className="font-semibold text-blue-900">Role</span>
                        <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={createUserForm.role_id} onChange={(e) => setCreateUserForm((s) => ({ ...s, role_id: e.target.value }))} disabled={!createUserRoleOptions.length} required>
                          <option value="">{createUserRoleOptions.length ? "Select role" : "No roles available"}</option>
                          {createUserRoleOptions.map((roleOption) => (
                            <option key={roleOption.id} value={roleOption.id}>{roleOption.label}</option>
                          ))}
                        </select>
                      </label>
                      <button className="w-full rounded-lg py-2.5 text-sm font-extrabold text-white transition disabled:opacity-60" style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }} disabled={busyKey === "create-user" || !createUserRoleOptions.length}>{busyKey === "create-user" ? "Saving..." : "Add Employee"}</button>
                    </form>
                  </div>
                </section>
                <section className="rounded-2xl bg-white shadow-sm overflow-hidden" style={{ border: "1px solid #dbeafe" }}>
                  <div className="px-4 py-3 flex items-center gap-2" style={{ background: "linear-gradient(90deg, #1d4ed815, #1d4ed808)", borderBottom: "2px solid #1d4ed8" }}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#1d4ed8" }} />
                    <span className="text-sm font-extrabold text-blue-900" style={{ fontFamily: "'Georgia', serif" }}>Employee Directory</span>
                    <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#dbeafe", color: "#1d4ed8" }}>{hrVisibleUsers.length}</span>
                  </div>
                  <div className="p-4">
                    <DataTable columns={userListColumns} rows={hrVisibleUsers} emptyText="No users" onRowClick={openUserDetails} />
                  </div>
                </section>
              </div>
            </>
          ) : null}

          {activeMenu === "hr-attendance" ? (
            <>
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="Attendance List" />
                <DataTable columns={hrAttendanceColumns} rows={attendanceRecords} emptyText="No attendance records" />
              </section>
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="Leave Approvals" />
                <DataTable columns={hrLeaveApprovalColumns} rows={hrLeaves} emptyText="No leave requests" />
              </section>
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="Performance Review" />
                <form className="grid gap-3 md:grid-cols-2" onSubmit={submitPerformanceReview}>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Employee</span>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={reviewForm.employee_id} onChange={(e) => setReviewForm((s) => ({ ...s, employee_id: e.target.value }))} required>
                      <option value="">Select employee</option>
                      {hrEmployeeRows.map((employee) => (
                        <option key={employee.id} value={employee.id}>{getUserDisplayName(employee)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Rating</span>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={reviewForm.rating} onChange={(e) => setReviewForm((s) => ({ ...s, rating: e.target.value }))}>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
                    <span className="font-medium">Feedback</span>
                    <textarea className="input min-h-24" value={reviewForm.feedback} onChange={(e) => setReviewForm((s) => ({ ...s, feedback: e.target.value }))} required />
                  </label>
                  <button className="btn-primary md:col-span-2" disabled={busyKey === "hr-review"}>Submit Review</button>
                </form>
              </section>
            </>
          ) : null}

          {activeMenu === "hr-departments" ? (
            <>
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="Department List" />
                <DataTable
                  columns={[
                    { key: "name", label: "Name" },
                    { key: "description", label: "Description" }
                  ]}
                  rows={departments}
                  emptyText="No departments"
                />
              </section>
              <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <SectionTitle title="New Department" />
                <form className="space-y-3" onSubmit={submitCreateDepartment}>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Name</span><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={departmentForm.name} onChange={(e) => setDepartmentForm((s) => ({ ...s, name: e.target.value }))} required /></label>
                  <label className="space-y-1 text-sm text-slate-700"><span className="font-medium">Description</span><textarea className="input min-h-24" value={departmentForm.description} onChange={(e) => setDepartmentForm((s) => ({ ...s, description: e.target.value }))} /></label>
                  <button className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-900 disabled:opacity-60" disabled={busyKey === "create-department"}>Save Department</button>
                </form>
              </section>
            </>
          ) : null}

          {activeMenu === "client-dashboard" ? (
            <>
              {/* Client portfolio header */}
              <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid #dbeafe" }}>
                <div className="px-6 py-4 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)", border: "1px solid #bfdbfe" }}>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#1d4ed8" }}>Project Portfolio</p>
                    <p className="text-xl font-extrabold text-blue-900" style={{ fontFamily: "'Georgia', serif" }}>Your Active Projects</p>
                  </div>
                  <div className="text-right">
                    <span className="text-4xl font-extrabold text-blue-900" style={{ fontFamily: "'Georgia', serif" }}>{clientProjectsWithProgress.length}</span>
                    <p className="text-xs font-semibold mt-0.5 text-blue-600">total projects</p>
                  </div>
                </div>
              </div>

              {/* Project cards grid */}
              {clientProjectsWithProgress.length === 0 ? (
                <div className="rounded-2xl bg-white p-10 text-center shadow-sm" style={{ border: "1px solid #dbeafe" }}>
                  <div className="h-12 w-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: "#dbeafe" }}><svg width="24" height="24" fill="none" stroke="#1d4ed8" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg></div>
                  <p className="text-base font-bold text-blue-900">No projects assigned yet</p>
                  <p className="text-sm text-slate-500 mt-1">Your projects will appear here once assigned.</p>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-2">
                  {clientProjectsWithProgress.map((project) => {
                    const status = String(project?.status || "").toUpperCase();
                    const statusColors = {
                      ACTIVE: { bg: "#f0fdf4", text: "#16a34a", border: "#16a34a" },
                      COMPLETED: { bg: "#eff6ff", text: "#2563eb", border: "#2563eb" },
                      ON_HOLD: { bg: "#fffbeb", text: "#d97706", border: "#d97706" },
                    };
                    const sc = statusColors[status] || { bg: "#f8fafc", text: "#64748b", border: "#94a3b8" };
                    const progress = project?.progress || "0%";
                    const progressNum = parseInt(String(progress).replace("%", "").split("(")[0].trim()) || 0;
                    return (
                      <article
                        key={project.id}
                        className="rounded-2xl bg-white overflow-hidden shadow-sm cursor-pointer transition-all hover:shadow-md"
                        style={{ border: "1px solid #dbeafe", borderTop: `3px solid ${sc.border}` }}
                        onClick={() => openProjectDetails && openProjectDetails(project)}
                      >
                        <div className="p-6">
                          <div className="flex items-start justify-between gap-2 mb-4">
                            <h3 className="font-extrabold text-blue-900 text-lg leading-tight" style={{ fontFamily: "'Georgia', serif" }}>{project.name || "Project"}</h3>
                            <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.text }}>{status || "—"}</span>
                          </div>
                          {project.description ? (
                            <p className="text-sm text-slate-500 mb-4 line-clamp-3">{project.description}</p>
                          ) : null}
                          <div className="space-y-2 text-sm text-slate-500 mb-4">
                            {project.start_date ? <p><span className="font-bold text-slate-400 uppercase tracking-wide text-xs">Start</span> <span className="font-semibold text-slate-700">{project.start_date}</span></p> : null}
                            {project.end_date ? <p><span className="font-bold text-slate-400 uppercase tracking-wide text-xs">Due</span> <span className="font-semibold text-slate-700">{project.end_date}</span></p> : null}
                            {project.priority ? <p><span className="font-bold text-slate-400 uppercase tracking-wide text-xs">Priority</span> <span className="font-semibold text-slate-700">{project.priority}</span></p> : null}
                          </div>
                          {/* Progress bar */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-blue-900/50 uppercase tracking-widest">Progress</span>
                              <span className="text-xs font-extrabold" style={{ color: sc.border }}>{progress}</span>
                            </div>
                            <div className="h-2 rounded-full bg-blue-100 overflow-hidden">
                              <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(progressNum, 100)}%`, background: sc.border }} />
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          ) : null}
        </section>
      </div>
    </main>
    </div>
  );
}

