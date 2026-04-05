import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getData, patchData } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  buildUserLabel,
  compactPayload,
  extractError,
  formatValue,
  getEntityId,
  humanizeLabel,
  mergeRowsById,
  numberOrNull,
  toArray
} from "./detailHelpers";

const STATUS_OPTIONS = ["ACTIVE", "COMPLETED", "ON_HOLD"];
const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function makeProjectForm(project) {
  return {
    name: String(project?.name || ""),
    description: String(project?.description || ""),
    manager: String(getEntityId(project?.manager) || ""),
    client: String(getEntityId(project?.client) || ""),
    status: String(project?.status || "ACTIVE"),
    priority: String(project?.priority || "MEDIUM"),
    start_date: String(project?.start_date || ""),
    end_date: String(project?.end_date || ""),
    budget: project?.budget === null || project?.budget === undefined ? "" : String(project.budget),
    actual_cost: project?.actual_cost === null || project?.actual_cost === undefined ? "" : String(project.actual_cost),
    is_active: Boolean(project?.is_active ?? true)
  };
}

function safeDate(value) {
  return value ? String(value) : "-";
}

export default function ProjectDetailsPage() {
  const { projectId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const routeProject =
    state?.project && String(state.project.id || "") === String(projectId || "") ? state.project : null;

  const [project, setProject] = useState(routeProject);
  const [form, setForm] = useState(makeProjectForm(routeProject || {}));
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(!routeProject);
  const [saving, setSaving] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [noticeText, setNoticeText] = useState("");

  useEffect(() => {
    let active = true;

    const fetchOptional = async (url, fallback = []) => {
      try {
        return await getData(url);
      } catch {
        return fallback;
      }
    };

    const loadPage = async () => {
      const targetId = String(projectId || "").trim();
      if (!targetId) {
        if (!active) return;
        setErrorText("Invalid project id.");
        setLoading(false);
        return;
      }

      setLoading(!routeProject);
      setErrorText("");

      const usersRes = await fetchOptional("/users/", []);

      if (!active) return;
      setUsers(toArray(usersRes));

      try {
        const detail = await getData(`/projects/${targetId}/`);
        if (!active) return;
        setProject(detail);
        setForm(makeProjectForm(detail));
        setLoading(false);
        return;
      } catch {
        // fall through to list fallback
      }

      const fallbackEndpoints = ["/manager-projects/", "/all-projects/", "/my-projects/"];

      for (const endpoint of fallbackEndpoints) {
        try {
          const rows = await getData(endpoint);
          const matched = toArray(rows).find((row) => String(row?.id || "") === targetId);
          if (!matched) continue;
          if (!active) return;
          setProject(matched);
          setForm(makeProjectForm(matched));
          setLoading(false);
          return;
        } catch {
          // try next endpoint
        }
      }

      if (!active) return;
      setErrorText("Project details not found or access denied.");
      setLoading(false);
    };

    loadPage();

    return () => {
      active = false;
    };
  }, [projectId, routeProject]);

  const userLookup = useMemo(() => {
    const lookup = {};
    const merged = mergeRowsById(users);

    for (const row of merged) {
      const rowId = String(row?.id || "");
      if (!rowId) continue;
      lookup[rowId] = buildUserLabel(row);
    }

    return lookup;
  }, [users]);

  const managerOptions = useMemo(() => {
    const allUsers = mergeRowsById(users);
    const filtered = allUsers.filter((row) => {
      const roleText = String(row?.role_name || (row?.role && typeof row.role === "object" ? row.role.name || row.role.slug : row.role) || "").trim().toLowerCase();
      return roleText.includes("manager") || roleText.includes("owner");
    });
    return (filtered.length ? filtered : allUsers).map((row) => ({ id: String(row?.id || ""), label: buildUserLabel(row) }));
  }, [users]);

  const clientOptions = useMemo(() => {
    const allUsers = mergeRowsById(users);
    const filtered = allUsers.filter((row) => {
      const roleText = String(row?.role_name || (row?.role && typeof row.role === "object" ? row.role.name || row.role.slug : row.role) || "").trim().toLowerCase();
      return roleText.includes("client");
    });
    return (filtered.length ? filtered : allUsers).map((row) => ({ id: String(row?.id || ""), label: buildUserLabel(row) }));
  }, [users]);

  const managerLabel = useMemo(() => {
    const managerId = String(getEntityId(project?.manager) || "");
    return managerId ? userLookup[managerId] || "Unknown user" : "-";
  }, [project, userLookup]);

  const clientLabel = useMemo(() => {
    const clientId = String(getEntityId(project?.client) || "");
    return clientId ? userLookup[clientId] || "Unknown user" : "-";
  }, [project, userLookup]);

  const visibleProjectFields = useMemo(() => {
    if (!project) return [];

    const normalized = {
      ...project,
      manager: managerLabel,
      client: clientLabel,
      company: user?.company || "-"
    };

    return Object.entries(normalized).filter(([key]) => key !== "id");
  }, [clientLabel, managerLabel, project, user]);

  const submitUpdate = async (event) => {
    event.preventDefault();

    if (!projectId) {
      setErrorText("Project id missing.");
      return;
    }

    setSaving(true);
    setErrorText("");
    setNoticeText("");

    try {
      const payload = compactPayload({
        name: form.name.trim(),
        description: form.description.trim(),
        manager: numberOrNull(form.manager),
        client: numberOrNull(form.client),
        status: form.status,
        priority: form.priority,
        start_date: form.start_date,
        end_date: form.end_date,
        budget: numberOrNull(form.budget),
        actual_cost: numberOrNull(form.actual_cost),
        is_active: form.is_active
      });

      const updated = await patchData(`/projects/${projectId}/`, payload);
      setProject(updated);
      setForm(makeProjectForm(updated));
      setShowEditForm(false);
      setNoticeText("Project updated.");
    } catch (error) {
      setErrorText(extractError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-6" style={{ background: "linear-gradient(135deg, #e8eef8 0%, #dce6f5 100%)" }}>
      <section className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-900/50">Project Details</p>
              <h1 className="text-2xl font-bold text-blue-900" style={{ fontFamily: "'Georgia', serif" }}>{project?.name || "Project"}</h1>
              <p className="mt-1 text-sm text-slate-500">Description opens here and editing is available on click.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900 transition hover:bg-blue-100" onClick={() => navigate(-1)}>
                Back
              </button>
              {!loading && !errorText && project ? (
                <button className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-900 disabled:opacity-60" onClick={() => setShowEditForm((value) => !value)}>
                  {showEditForm ? "Close Editor" : "Edit Project"}
                </button>
              ) : null}
            </div>
          </div>
        </header>

        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading project...</section>
        ) : null}

        {errorText ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{errorText}</section>
        ) : null}

        {noticeText ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{noticeText}</section>
        ) : null}

        {!loading && !errorText && project ? (
          <>
            <section className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
              <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                <h2 className="text-base font-bold text-blue-900">Summary</h2>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p><span className="font-semibold">Description:</span> {project.description || "-"}</p>
                  <p><span className="font-semibold">Manager:</span> {managerLabel}</p>
                  <p><span className="font-semibold">Client:</span> {clientLabel}</p>
                  <p><span className="font-semibold">Status:</span> {project.status || "-"}</p>
                  <p><span className="font-semibold">Priority:</span> {project.priority || "-"}</p>
                  <p><span className="font-semibold">Progress:</span> {project.progress ?? "-"}%</p>
                  <p><span className="font-semibold">Start Date:</span> {safeDate(project.start_date)}</p>
                  <p><span className="font-semibold">End Date:</span> {safeDate(project.end_date)}</p>
                  <p><span className="font-semibold">Budget:</span> {formatValue(project.budget)}</p>
                  <p><span className="font-semibold">Actual Cost:</span> {formatValue(project.actual_cost)}</p>
                  <p><span className="font-semibold">Active:</span> {project.is_active ? "Yes" : "No"}</p>
                  <p><span className="font-semibold">Company:</span> {user?.company || "-"}</p>
                  <p><span className="font-semibold">Created At:</span> {safeDate(project.created_at)}</p>
                </div>
              </article>

            </section>

            {showEditForm ? (
              <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                <h2 className="text-base font-bold text-blue-900">Edit Project</h2>
                <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={submitUpdate}>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Project Name</span>
                    <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} required />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Manager</span>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={form.manager} onChange={(event) => setForm((value) => ({ ...value, manager: event.target.value }))}>
                      <option value="">Select manager</option>
                      {managerOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Client</span>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={form.client} onChange={(event) => setForm((value) => ({ ...value, client: event.target.value }))}>
                      <option value="">None</option>
                      {clientOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Status</span>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={form.status} onChange={(event) => setForm((value) => ({ ...value, status: event.target.value }))}>
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>{humanizeLabel(option)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Priority</span>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={form.priority} onChange={(event) => setForm((value) => ({ ...value, priority: event.target.value }))}>
                      {PRIORITY_OPTIONS.map((option) => (
                        <option key={option} value={option}>{humanizeLabel(option)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Start Date</span>
                    <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="date" value={form.start_date} onChange={(event) => setForm((value) => ({ ...value, start_date: event.target.value }))} required />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">End Date</span>
                    <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="date" value={form.end_date} onChange={(event) => setForm((value) => ({ ...value, end_date: event.target.value }))} />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Budget</span>
                    <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="number" step="0.01" value={form.budget} onChange={(event) => setForm((value) => ({ ...value, budget: event.target.value }))} />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Actual Cost</span>
                    <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="number" step="0.01" value={form.actual_cost} onChange={(event) => setForm((value) => ({ ...value, actual_cost: event.target.value }))} />
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 md:col-span-2">
                    <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((value) => ({ ...value, is_active: event.target.checked }))} />
                    <span>Project is active</span>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
                    <span className="font-medium">Description</span>
                    <textarea className="input min-h-28" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} />
                  </label>
                  <button className="btn-primary md:col-span-2" disabled={saving}>{saving ? "Saving..." : "Save Project"}</button>
                </form>
              </section>
            ) : null}

            <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <h2 className="text-base font-bold text-blue-900">Project Details</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {visibleProjectFields.map(([key, value]) => (
                  <article key={key} className="rounded border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-blue-900/50">{humanizeLabel(key)}</p>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-800">{formatValue(value)}</pre>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

