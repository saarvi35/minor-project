import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getData, patchData, postData } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  buildUserLabel,
  alertError,
  extractError,
  formatValue,
  getEntityId,
  humanizeLabel,
  mergeRowsById,
  normalizeMediaUrl,
  toArray
} from "./detailHelpers";

const STATUS_OPTIONS = ["PENDING", "IN_PROGRESS", "COMPLETED"];
const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH"];

function makeTaskForm(task) {
  return {
    title: String(task?.title || ""),
    description: String(task?.description || ""),
    assigned_to: String(getEntityId(task?.assigned_to) || ""),
    project: String(getEntityId(task?.project) || ""),
    status: String(task?.status || "PENDING"),
    priority: String(task?.priority || "MEDIUM"),
    due_date: String(task?.due_date || ""),
    progress: task?.progress === null || task?.progress === undefined ? "0" : String(task.progress),
    reference_link: String(task?.reference_link || ""),
    attachment: null,
    image: null
  };
}

function appendFormValue(formData, key, value) {
  if (value === null || value === undefined) return;
  formData.append(key, value);
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

export default function TaskDetailsPage() {
  const { taskId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const routeTask = state?.task && String(state.task.id || "") === String(taskId || "") ? state.task : null;
  const roleText = String(user?.role || "").trim().toLowerCase();
  const isEmployeeUser = roleText.includes("employee");

  const [task, setTask] = useState(routeTask);
  const [form, setForm] = useState(makeTaskForm(routeTask || {}));
  const [users, setUsers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(!routeTask);
  const [saving, setSaving] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [errorText, setErrorTextState] = useState("");
  const setErrorText = (message) => {
    const text = String(message || "").trim();
    setErrorTextState(text);
    alertError(text);
  };
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
      const targetId = String(taskId || "").trim();
      if (!targetId) {
        if (!active) return;
        setErrorText("Invalid task id.");
        setLoading(false);
        return;
      }

      setLoading(!routeTask);
      setErrorText("");

      const [usersRes, teamRes, managerProjectsRes, allProjectsRes, myProjectsRes] = await Promise.all([
        fetchOptional("/users/", []),
        fetchOptional("/team/", []),
        fetchOptional("/manager-projects/", []),
        fetchOptional("/all-projects/", []),
        fetchOptional("/my-projects/", [])
      ]);

      if (!active) return;
      setUsers(toArray(usersRes));
      setTeamMembers(toArray(teamRes));
      setProjects(mergeRowsById(managerProjectsRes, allProjectsRes, myProjectsRes));

      try {
        const detail = await getData(`/tasks/${targetId}/`);
        if (!active) return;
        setTask(detail);
        setForm(makeTaskForm(detail));
        const [commentRows, activityRows] = await Promise.all([
          fetchOptional(`/tasks/${targetId}/comments/`, []),
          fetchOptional(`/tasks/${targetId}/activity/`, [])
        ]);
        if (!active) return;
        setComments(toArray(commentRows));
        setActivities(toArray(activityRows));
        setLoading(false);
        return;
      } catch {
        // fall through to fallback lists
      }

      const fallbackEndpoints = ["/all-tasks/", "/team-tasks/", "/my-tasks/", "/tasks/"];

      for (const endpoint of fallbackEndpoints) {
        try {
          const rows = await getData(endpoint);
          const matched = toArray(rows).find((row) => String(row?.id || "") === targetId);
          if (!matched) continue;
          if (!active) return;
          setTask(matched);
          setForm(makeTaskForm(matched));
          setLoading(false);
          return;
        } catch {
          // try next endpoint
        }
      }

      if (!active) return;
      setErrorText("Task details not found or access denied.");
      setLoading(false);
    };

    loadPage();

    return () => {
      active = false;
    };
  }, [routeTask, taskId]);

  const allUserRows = useMemo(() => mergeRowsById(users, teamMembers), [teamMembers, users]);

  const userLookup = useMemo(() => {
    const lookup = {};
    for (const row of allUserRows) {
      const rowId = String(row?.id || "");
      if (!rowId) continue;
      lookup[rowId] = buildUserLabel(row);
    }
    return lookup;
  }, [allUserRows]);

  const projectLookup = useMemo(() => {
    const lookup = {};
    for (const projectRow of projects) {
      const rowId = String(projectRow?.id || "");
      if (!rowId) continue;
      lookup[rowId] = String(projectRow?.name || "Unnamed project");
    }
    return lookup;
  }, [projects]);

  const employeeRows = useMemo(() => {
    const filteredRows = allUserRows.filter((row) => getRoleText(row).includes("employee"));
    if (filteredRows.length) return filteredRows;

    const assignedId = String(getEntityId(task?.assigned_to) || "").trim();
    if (!assignedId) return [];

    const fallbackAssignedName = String(task?.assigned_to_name || "").trim() || "Assigned user";
    return [{ id: assignedId, name: fallbackAssignedName, role: "Employee" }];
  }, [allUserRows, task]);

  const assigneeOptions = useMemo(
    () => employeeRows.map((row) => ({ id: String(row?.id || ""), label: buildUserLabel(row) })),
    [employeeRows]
  );

  const projectOptions = useMemo(
    () => projects.map((row) => ({ id: String(row?.id || ""), label: String(row?.name || "Unnamed project") })),
    [projects]
  );

  const imageUrl = useMemo(() => normalizeMediaUrl(task?.image), [task]);
  const attachmentUrl = useMemo(() => normalizeMediaUrl(task?.attachment), [task]);
  const attachmentIsPdf = useMemo(() => /\.pdf($|\?)/i.test(attachmentUrl), [attachmentUrl]);
  const assignedLabel = useMemo(() => {
    const directName = String(task?.assigned_to_name || "").trim();
    if (directName) return directName;
    const id = String(getEntityId(task?.assigned_to) || "");
    return id ? userLookup[id] || "Unknown user" : "-";
  }, [task, userLookup]);
  const createdByLabel = useMemo(() => {
    const directName = String(task?.created_by_name || "").trim();
    if (directName) return directName;
    const id = String(getEntityId(task?.created_by) || "");
    return id ? userLookup[id] || "Unknown user" : "-";
  }, [task, userLookup]);
  const projectLabel = useMemo(() => {
    const id = String(getEntityId(task?.project) || "");
    return id ? projectLookup[id] || "Unknown project" : "None";
  }, [projectLookup, task]);

  const visibleTaskFields = useMemo(() => {
    if (!task) return [];

    const normalized = {
      ...task,
      assigned_to: assignedLabel,
      created_by: createdByLabel,
      project: projectLabel,
      attachment: attachmentUrl || "-",
      image: imageUrl || "-"
    };

    return Object.entries(normalized);
  }, [assignedLabel, attachmentUrl, createdByLabel, imageUrl, projectLabel, task]);

  const submitUpdate = async (event) => {
    event.preventDefault();

    if (!taskId) {
      setErrorText("Task id missing.");
      return;
    }

    setSaving(true);
    setErrorText("");
    setNoticeText("");

    try {
      const payload = new FormData();
      appendFormValue(payload, "title", form.title.trim());
      appendFormValue(payload, "description", form.description.trim());
      if (!isEmployeeUser) {
        appendFormValue(payload, "assigned_to", form.assigned_to);
      }
      appendFormValue(payload, "project", form.project);
      appendFormValue(payload, "status", form.status);
      appendFormValue(payload, "priority", form.priority);
      appendFormValue(payload, "due_date", form.due_date);
      appendFormValue(payload, "progress", form.progress);
      appendFormValue(payload, "reference_link", form.reference_link.trim());
      if (form.attachment) appendFormValue(payload, "attachment", form.attachment);
      if (form.image) appendFormValue(payload, "image", form.image);

      const updated = await patchData(`/tasks/${taskId}/`, payload);
      setTask(updated);
      setForm(makeTaskForm(updated));
      setShowEditForm(false);
      setNoticeText("Task updated.");
      const activityRows = await getData(`/tasks/${taskId}/activity/`);
      setActivities(toArray(activityRows));
    } catch (error) {
      setErrorText(extractError(error));
    } finally {
      setSaving(false);
    }
  };

  const submitComment = async (event) => {
    event.preventDefault();
    const body = commentBody.trim();
    if (!body || !taskId) return;

    setCommentSaving(true);
    setErrorText("");
    try {
      const comment = await postData(`/tasks/${taskId}/comments/`, { body });
      setComments((current) => [...current, comment]);
      setCommentBody("");
      const activityRows = await getData(`/tasks/${taskId}/activity/`);
      setActivities(toArray(activityRows));
    } catch (error) {
      setErrorText(extractError(error));
    } finally {
      setCommentSaving(false);
    }
  };

  return (
    <main className="dashboard-shell min-h-screen p-4 md:p-6">
      <section className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-900/50">Task Details</p>
              <h1 className="text-2xl font-bold text-blue-900">{task?.title || "Task"}</h1>
              <p className="mt-1 text-sm text-slate-500">Task description, image, PDF and editor open here.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900 transition hover:bg-blue-100" onClick={() => navigate(-1)}>
                Back
              </button>
              {!loading && !errorText && task ? (
                <button className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-900 disabled:opacity-60" onClick={() => setShowEditForm((value) => !value)}>
                  {showEditForm ? "Close Editor" : "Edit Task"}
                </button>
              ) : null}
            </div>
          </div>
        </header>

        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading task...</section>
        ) : null}

        {noticeText ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{noticeText}</section>
        ) : null}

        {!loading && !errorText && task ? (
          <>
            <section className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border bg-white p-4 shadow-sm">
                <h2 className="text-base font-bold text-blue-900">Summary</h2>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p><span className="font-semibold">Description:</span> {task.description || "-"}</p>
                  <p><span className="font-semibold">Assigned To:</span> {assignedLabel}</p>
                  <p><span className="font-semibold">Created By:</span> {createdByLabel}</p>
                  <p><span className="font-semibold">Project:</span> {projectLabel}</p>
                  <p><span className="font-semibold">Status:</span> {task.status || "-"}</p>
                  <p><span className="font-semibold">Priority:</span> {task.priority || "-"}</p>
                  <p><span className="font-semibold">Progress:</span> {task.progress ?? "-"}%</p>
                  <p><span className="font-semibold">Due Date:</span> {task.due_date || "-"}</p>
                  <p><span className="font-semibold">Reference Link:</span> {task.reference_link ? <a href={String(task.reference_link)} className="text-sky-700 underline" target="_blank" rel="noreferrer">Open</a> : "-"}</p>
                  <p><span className="font-semibold">Created At:</span> {task.created_at || "-"}</p>
                </div>
              </article>

              <article className="rounded-2xl border bg-white p-4 shadow-sm">
                <h2 className="text-base font-bold text-blue-900">Files and Links</h2>
                <div className="mt-3 space-y-3 text-sm">
                  <p>
                    <span className="font-semibold text-slate-800">Attachment: </span>
                    {attachmentUrl ? (
                      <a href={attachmentUrl} className="text-sky-700 underline" target="_blank" rel="noreferrer">Open File</a>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Image: </span>
                    {imageUrl ? (
                      <a href={imageUrl} className="text-sky-700 underline" target="_blank" rel="noreferrer">Open Image</a>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </p>
                </div>

                {imageUrl ? (
                  <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                    <img src={imageUrl} alt="Task" className="max-h-96 w-full bg-slate-50 object-contain" />
                  </div>
                ) : null}

                {attachmentUrl && attachmentIsPdf ? (
                  <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                    <iframe title="Task PDF" src={attachmentUrl} className="h-96 w-full" />
                  </div>
                ) : null}
              </article>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
              <article className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-blue-900">Discussion</h2>
                    <p className="mt-1 text-sm text-slate-500">Keep decisions and progress updates with the task.</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">{comments.length} comments</span>
                </div>
                <form className="mt-4 space-y-2" onSubmit={submitComment}>
                  <textarea
                    className="input min-h-24 w-full"
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                    maxLength={2000}
                    placeholder="Write an update, question, or decision..."
                    required
                  />
                  <div className="flex justify-end">
                    <button className="btn-primary" disabled={commentSaving}>{commentSaving ? "Posting..." : "Post comment"}</button>
                  </div>
                </form>
                <div className="mt-5 space-y-3">
                  {comments.length ? comments.map((comment) => (
                    <article key={comment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <strong className="text-slate-800">{comment.author_name || "Team member"}</strong>
                        <time className="text-slate-500">{comment.created_at ? new Date(comment.created_at).toLocaleString() : ""}</time>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p>
                    </article>
                  )) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No discussion yet. Add the first update.</p>}
                </div>
              </article>

              <article className="rounded-2xl border bg-white p-4 shadow-sm">
                <h2 className="text-base font-bold text-blue-900">Activity</h2>
                <p className="mt-1 text-sm text-slate-500">A clear history of changes to this task.</p>
                <ol className="mt-5 space-y-4 border-l-2 border-blue-100 pl-4">
                  {activities.length ? activities.map((activity) => (
                    <li key={activity.id} className="relative">
                      <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                      <p className="text-sm text-slate-700"><strong>{activity.actor_name || "System"}</strong> {activity.summary}</p>
                      <time className="mt-1 block text-xs text-slate-500">{activity.created_at ? new Date(activity.created_at).toLocaleString() : ""}</time>
                    </li>
                  )) : <li className="text-sm text-slate-500">No activity has been recorded yet.</li>}
                </ol>
              </article>
            </section>

            {showEditForm ? (
              <section className="rounded-2xl border bg-white p-4 shadow-sm">
                <h2 className="text-base font-bold text-blue-900">Edit Task</h2>
                <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={submitUpdate}>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Title</span>
                    <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} required />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Assigned To</span>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={form.assigned_to} onChange={(event) => setForm((value) => ({ ...value, assigned_to: event.target.value }))} required disabled={isEmployeeUser}>
                      <option value="">Select assignee</option>
                      {assigneeOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Project</span>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={form.project} onChange={(event) => setForm((value) => ({ ...value, project: event.target.value }))}>
                      <option value="">None</option>
                      {projectOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Due Date</span>
                    <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="date" value={form.due_date} onChange={(event) => setForm((value) => ({ ...value, due_date: event.target.value }))} />
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
                    <span className="font-medium">Progress</span>
                    <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="number" min="0" max="100" value={form.progress} onChange={(event) => setForm((value) => ({ ...value, progress: event.target.value }))} required />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
                    <span className="font-medium">Reference Link</span>
                    <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" value={form.reference_link} onChange={(event) => setForm((value) => ({ ...value, reference_link: event.target.value }))} />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
                    <span className="font-medium">Description</span>
                    <textarea className="input min-h-28" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} required />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Replace Attachment</span>
                    <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="file" onChange={(event) => setForm((value) => ({ ...value, attachment: event.target.files?.[0] || null }))} />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Replace Image</span>
                    <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" type="file" accept="image/*" onChange={(event) => setForm((value) => ({ ...value, image: event.target.files?.[0] || null }))} />
                  </label>
                  <button className="btn-primary md:col-span-2" disabled={saving}>{saving ? "Saving..." : "Save Task"}</button>
                </form>
              </section>
            ) : null}

            <section className="rounded-2xl border bg-white p-4 shadow-sm">
              <h2 className="text-base font-bold text-blue-900">Task Details</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {visibleTaskFields.map(([key, value]) => (
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

