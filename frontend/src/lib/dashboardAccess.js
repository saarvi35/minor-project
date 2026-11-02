export const DASHBOARD_MENUS = {
  owner: [
    { id: "owner-dashboard", label: "Analytics" },
    { id: "owner-roles", label: "Roles" },
    { id: "owner-users", label: "Users" },
    { id: "owner-projects", label: "Projects" },
    { id: "owner-tasks", label: "Tasks" },
    { id: "ai-project-architect", label: "AI Project Architect" },
    { id: "owner-import", label: "Data Import" },
    { id: "owner-company", label: "Settings" }
  ],
  manager: [
    { id: "manager-dashboard", label: "Dashboard" },
    { id: "manager-users", label: "Users" },
    { id: "manager-roles", label: "Roles" },
    { id: "manager-projects", label: "Projects" },
    { id: "manager-tasks", label: "Tasks" },
    { id: "ai-project-architect", label: "AI Project Architect" },
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

export const ROLE_PERMISSION_FIELDS = [
  "can_manage_company", "can_manage_roles", "can_manage_users", "can_create_project",
  "can_assign_task", "can_view_all_tasks", "can_view_team_tasks", "can_view_assigned_tasks",
  "can_update_task_status", "can_view_project_progress", "can_manage_hr", "can_approve_leave",
  "can_view_attendance", "can_manage_payroll"
];

export function detectDashboardType(profile) {
  const role = String(profile?.role || "").toLowerCase();
  const permissions = profile?.permissions || {};
  if (role.includes("owner") || permissions.can_manage_company) return "owner";
  if (role.includes("manager") || permissions.can_view_team_tasks) return "manager";
  if (role.includes("hr") || permissions.can_manage_hr) return "hr";
  if (role.includes("client") || (permissions.can_view_project_progress && !permissions.can_view_assigned_tasks)) return "client";
  return "employee";
}

export function canAccessMenu(roleType, menuId, permissions) {
  const rules = {
    owner: {
      "owner-dashboard": true,
      "owner-roles": permissions.can_manage_roles || permissions.can_manage_company,
      "owner-users": permissions.can_manage_users || permissions.can_manage_company,
      "owner-projects": permissions.can_manage_company || permissions.can_create_project || permissions.can_view_all_tasks,
      "owner-tasks": permissions.can_view_all_tasks || permissions.can_manage_company,
      "ai-project-architect": permissions.can_manage_company,
      "owner-import": permissions.can_manage_company,
      "owner-company": permissions.can_manage_company
    },
    manager: {
      "manager-dashboard": true,
      "manager-users": permissions.can_manage_users || permissions.can_view_team_tasks,
      "manager-roles": permissions.can_manage_roles,
      "manager-projects": true,
      "manager-tasks": true,
      "ai-project-architect": permissions.can_create_project && permissions.can_assign_task,
      "manager-attendance": true
    }
  };
  if (roleType === "employee") return menuId === "employee-dashboard" || menuId === "employee-attendance";
  if (roleType === "hr" || roleType === "client") return true;
  return rules[roleType]?.[menuId] ?? false;
}
