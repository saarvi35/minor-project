import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getData, patchData } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  compactPayload,
  extractError,
  formatValue,
  getEntityId,
  humanizeLabel,
  mergeRowsById,
  toArray
} from "./detailHelpers";

function makeUserForm(userRow, roles) {
  const selectedRole = roles.find(
    (role) =>
      String(role?.id || "") === String(userRow?.role || "") ||
      String(role?.name || "").trim().toLowerCase() === String(userRow?.role || "").trim().toLowerCase()
  );

  return {
    name: String(userRow?.name || ""),
    role: String(selectedRole?.id || ""),
    status: String(userRow?.status || "ACTIVE")
  };
}

function taskUserMatches(task, userId) {
  const assignedId = String(getEntityId(task?.assigned_to) || "");
  return assignedId && assignedId === String(userId || "");
}

export default function UserDetailsPage() {
  const { userId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const roleName = String(user?.role || "").trim().toLowerCase();
  const routeUser = state?.user && String(state.user.id || "") === String(userId || "") ? state.user : null;

  const [userRow, setUserRow] = useState(routeUser);
  const [roles, setRoles] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(makeUserForm(routeUser || {}, []));
  const [loading, setLoading] = useState(!routeUser);
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
      const targetId = String(userId || "").trim();
      if (!targetId) {
        if (!active) return;
        setErrorText("Invalid user id.");
        setLoading(false);
        return;
      }

      setLoading(!routeUser);
      setErrorText("");

      const userEndpoints = ["/users/", "/team/"];
      const taskEndpoints = ["/all-tasks/", "/team-tasks/"];
      
      const [rolesRes, taskRows] = await Promise.all([
        fetchOptional("/roles/", []),
        (async () => {
          for (const endpoint of taskEndpoints) {
            try {
              return await getData(endpoint);
            } catch {
              // try next endpoint
            }
          }
          return [];
        })()
      ]);

      if (!active) return;
      setRoles(toArray(rolesRes));
      setTasks(toArray(taskRows));

      if (routeUser) {
        setForm(makeUserForm(routeUser, toArray(rolesRes)));
      }

      for (const endpoint of userEndpoints) {
  try {
    const rows = await getData(endpoint);
    const matched = toArray(rows).find((row) => String(row?.id || "") === targetId);
    if (!matched) continue;
    if (!active) return;
    setUserRow(matched);
    setForm(makeUserForm(matched, toArray(rolesRes)));
    setLoading(false);
    return;
  } catch {
    // try next endpoint
  }
}

if (!active) return;
// Agar routeUser already available hai toh error mat dikhao
if (!routeUser) {
  setErrorText("User details not found or access denied.");
}
setLoading(false);
    };

    loadPage();

    return () => {
      active = false;
    };
  }, [roleName, routeUser, userId]);

  const roleLookup = useMemo(() => {
    const lookup = {};
    for (const role of roles) {
      const id = String(role?.id || "");
      if (!id) continue;
      lookup[id] = role;
      const name = String(role?.name || "").trim().toLowerCase();
      if (name) lookup[`name:${name}`] = role;
    }
    return lookup;
  }, [roles]);

  const resolvedRole = useMemo(() => {
    const directId = String(form.role || userRow?.role || "").trim();
    if (!directId) return null;
    return roleLookup[directId] || roleLookup[`name:${directId.toLowerCase()}`] || null;
  }, [form.role, roleLookup, userRow]);

  const assignedTasks = useMemo(
    () => tasks.filter((task) => taskUserMatches(task, userId)),
    [tasks, userId]
  );

  const allFields = useMemo(() => {
    if (!userRow) return [];

    const normalized = {
      ...userRow,
      role: userRow?.role || resolvedRole?.name || "-",
      company: user?.company || "-",
      assigned_tasks: assignedTasks.length
    };

    return Object.entries(normalized).filter(([key]) => key !== "id");
  }, [assignedTasks.length, resolvedRole, user, userRow]);

  const submitUpdate = async (event) => {
    event.preventDefault();

    if (!userId) {
      setErrorText("User id missing.");
      return;
    }

    setSaving(true);
    setErrorText("");
    setNoticeText("");

    try {
      const payload = compactPayload({
        name: form.name.trim(),
        role: form.role,
        status: form.status
      });

      const updated = await patchData(`/update-user/${userId}/`, payload);
      setUserRow(updated);
      setForm(makeUserForm(updated, roles));
      setShowEditForm(false);
      setNoticeText("User updated.");
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
              <p className="text-xs font-bold uppercase tracking-widest text-blue-900/50">User Details</p>
              <h1 className="text-2xl font-bold text-blue-900" style={{ fontFamily: "'Georgia', serif" }}>{userRow?.name || "User"}</h1>
              <p className="mt-1 text-sm text-slate-500">Important list fields stay on the table. Full available details open here.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900 transition hover:bg-blue-100" onClick={() => navigate(-1)}>
                Back
              </button>
              {!loading && !errorText && userRow ? (
                <button className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-900 disabled:opacity-60" onClick={() => setShowEditForm((value) => !value)}>
                  {showEditForm ? "Close Editor" : "Edit User"}
                </button>
              ) : null}
            </div>
          </div>
        </header>

        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading user...</section>
        ) : null}

        {errorText ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{errorText}</section>
        ) : null}

        {noticeText ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{noticeText}</section>
        ) : null}

        {!loading && !errorText && userRow ? (
          <>
            <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                <h2 className="text-base font-bold text-blue-900">Summary</h2>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p><span className="font-semibold">Name:</span> {userRow.name || "-"}</p>
                  <p><span className="font-semibold">Email:</span> {userRow.email || "-"}</p>
                  <p><span className="font-semibold">Role:</span> {userRow.role || resolvedRole?.name || "-"}</p>
                  <p><span className="font-semibold">Level:</span> {userRow.level ?? resolvedRole?.level ?? "-"}</p>
                  <p><span className="font-semibold">Status:</span> {userRow.status || "-"}</p>
                  <p><span className="font-semibold">Company:</span> {user?.company || "-"}</p>
                  <p><span className="font-semibold">Assigned Tasks:</span> {assignedTasks.length}</p>
                </div>
              </article>

              <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                <h2 className="text-base font-bold text-blue-900">Assigned Tasks</h2>
                <div className="mt-3 space-y-3 text-sm text-slate-700">
                  {!assignedTasks.length ? <p className="text-slate-500">No assigned tasks found.</p> : null}
                  {assignedTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className="block w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left hover:border-sky-300 hover:bg-sky-50"
                      onClick={() => navigate(`/task/${task.id}`, { state: { task } })}
                    >
                      <p className="font-semibold text-slate-900">{task.title || "Task"}</p>
                      <p className="mt-1 text-slate-600">Status: {task.status || "-"}</p>
                      <p className="text-slate-500">Due: {task.due_date || "-"}</p>
                    </button>
                  ))}
                </div>
              </article>
            </section>

            {showEditForm ? (
              <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                <h2 className="text-base font-bold text-blue-900">Edit User</h2>
                <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={submitUpdate}>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Name</span>
                    <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} required />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Role</span>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={form.role} onChange={(event) => setForm((value) => ({ ...value, role: event.target.value }))} required>
                      <option value="">Select role</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
                    <span className="font-medium">Status</span>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={form.status} onChange={(event) => setForm((value) => ({ ...value, status: event.target.value }))}>
                      <option value="ACTIVE">Active</option>
                      <option value="INVITED">Invited</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </label>
                  <button className="md:col-span-2 w-full rounded-lg bg-blue-800 py-2.5 font-bold text-white transition hover:bg-blue-900 disabled:opacity-60" disabled={saving}>{saving ? "Saving..." : "Save User"}</button>
                </form>
              </section>
            ) : null}

            <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <h2 className="text-base font-bold text-blue-900">User Details</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {allFields.map(([key, value]) => (
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
