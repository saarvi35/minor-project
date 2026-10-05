import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getData, patchData } from "../lib/api";
import StatusPill from "../components/StatusPill";
import { extractError, getEntityId, toArray } from "./detailHelpers";

const COLUMNS = [
  { key: "PENDING", title: "To do", accent: "border-amber-300", empty: "No tasks waiting" },
  { key: "IN_PROGRESS", title: "In progress", accent: "border-blue-300", empty: "No active work" },
  { key: "COMPLETED", title: "Done", accent: "border-emerald-300", empty: "No completed tasks" }
];

function formatDueDate(value) {
  if (!value) return "No due date";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? String(value) : `Due ${date.toLocaleDateString()}`;
}

export default function ProjectBoardPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingTaskId, setSavingTaskId] = useState(null);
  const [errorText, setErrorText] = useState("");

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setErrorText("");
    try {
      const [projectData, taskRows] = await Promise.all([
        getData(`/projects/${projectId}/`),
        getData("/tasks/")
      ]);
      setProject(projectData);
      setTasks(toArray(taskRows).filter((task) => String(getEntityId(task.project)) === String(projectId)));
    } catch (error) {
      setErrorText(extractError(error));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const tasksByStatus = useMemo(() => {
    const grouped = Object.fromEntries(COLUMNS.map(({ key }) => [key, []]));
    for (const task of tasks) {
      const status = String(task.status || "PENDING").toUpperCase();
      (grouped[status] || grouped.PENDING).push(task);
    }
    return grouped;
  }, [tasks]);

  const moveTask = async (task, nextStatus) => {
    if (!task || task.status === nextStatus || savingTaskId) return;
    const previousTasks = tasks;
    const payload = { status: nextStatus };
    if (nextStatus === "COMPLETED") payload.progress = 100;
    setSavingTaskId(task.id);
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, ...payload } : item));
    try {
      const updated = await patchData(`/tasks/${task.id}/`, payload);
      setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
    } catch (error) {
      setTasks(previousTasks);
      setErrorText(extractError(error));
    } finally {
      setSavingTaskId(null);
    }
  };

  return (
    <main className="dashboard-shell min-h-screen p-4 md:p-6">
      <section className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-900/50">Project workspace</p>
              <h1 className="mt-1 text-2xl font-bold text-blue-900">{project?.name || "Kanban board"}</h1>
              <p className="mt-1 text-sm text-slate-500">Move cards across stages to update the work in real time.</p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900" onClick={loadBoard}>Refresh</button>
              <button className="rounded-lg bg-blue-800 px-3 py-2 text-sm font-bold text-white" onClick={() => navigate(`/project/${projectId}`)}>Project details</button>
            </div>
          </div>
        </header>

        {errorText ? <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{errorText}</section> : null}
        {loading ? <section className="rounded-xl border bg-white p-6 text-sm text-slate-500">Loading board...</section> : null}

        {!loading ? (
          <section className="grid gap-4 xl:grid-cols-3">
            {COLUMNS.map((column) => (
              <article
                key={column.key}
                className={`min-h-[28rem] rounded-2xl border-t-4 ${column.accent} bg-slate-100/80 p-3`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const taskId = Number(event.dataTransfer.getData("text/plain"));
                  moveTask(tasks.find((task) => task.id === taskId), column.key);
                }}
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <h2 className="font-bold text-slate-800">{column.title}</h2>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{tasksByStatus[column.key].length}</span>
                </div>
                <div className="space-y-3">
                  {tasksByStatus[column.key].map((task) => (
                    <article
                      key={task.id}
                      draggable={!savingTaskId}
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", String(task.id))}
                      className="cursor-grab rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button className="text-left text-sm font-bold text-slate-900 hover:text-blue-700" onClick={() => navigate(`/task/${task.id}`, { state: { task } })}>{task.title}</button>
                        <StatusPill value={task.priority} />
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{task.description || "No description"}</p>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, Number(task.progress) || 0))}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>{task.assigned_to_name || "Unassigned"}</span>
                        <span>{formatDueDate(task.due_date)}</span>
                      </div>
                    </article>
                  ))}
                  {!tasksByStatus[column.key].length ? <p className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500">{column.empty}</p> : null}
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </section>
    </main>
  );
}
