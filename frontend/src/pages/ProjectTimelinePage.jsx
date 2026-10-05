import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getData } from "../lib/api";
import StatusPill from "../components/StatusPill";
import { extractError, getEntityId, toArray } from "./detailHelpers";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function dateLabel(value) {
  const date = parseDay(value);
  return date ? date.toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "No date";
}

export default function ProjectTimelinePage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setErrorText("");
    try {
      const [projectData, taskRows] = await Promise.all([getData(`/projects/${projectId}/`), getData("/tasks/")]);
      setProject(projectData);
      setTasks(toArray(taskRows).filter((task) => String(getEntityId(task.project)) === String(projectId)));
    } catch (error) {
      setErrorText(extractError(error));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const schedule = useMemo(() => {
    const datedTasks = tasks.filter((task) => parseDay(task.due_date));
    const start = parseDay(project?.start_date) || new Date();
    const projectEnd = parseDay(project?.end_date);
    const taskEnd = datedTasks.reduce((latest, task) => {
      const due = parseDay(task.due_date);
      return !latest || due > latest ? due : latest;
    }, null);
    const end = projectEnd || taskEnd || new Date(start.valueOf() + 7 * DAY_MS);
    const totalDays = Math.max(1, Math.round((end - start) / DAY_MS));
    return { start, end, totalDays };
  }, [project, tasks]);

  const milestoneLabels = useMemo(() => [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const date = new Date(schedule.start.valueOf() + schedule.totalDays * DAY_MS * ratio);
    return { ratio, label: date.toLocaleDateString(undefined, { day: "numeric", month: "short" }) };
  }), [schedule]);

  return (
    <main className="dashboard-shell min-h-screen p-4 md:p-6">
      <section className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-900/50">Project workspace</p>
              <h1 className="mt-1 text-2xl font-bold text-blue-900">{project?.name || "Project timeline"}</h1>
              <p className="mt-1 text-sm text-slate-500">A live schedule built from the project dates and current task deadlines.</p>
            </div>
            <div className="flex gap-2"><button className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900" onClick={loadTimeline}>Refresh</button><button className="rounded-lg bg-blue-800 px-3 py-2 text-sm font-bold text-white" onClick={() => navigate(`/project/${projectId}`)}>Project details</button></div>
          </div>
        </header>

        {errorText ? <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{errorText}</section> : null}
        {loading ? <section className="rounded-xl border bg-white p-6 text-sm text-slate-500">Loading timeline...</section> : null}

        {!loading && project ? <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-blue-900">Schedule</h2><p className="mt-1 text-sm text-slate-500">{dateLabel(project.start_date)} to {dateLabel(project.end_date)}</p></div><StatusPill value={project.status} /></div>
          <div className="overflow-x-auto"><div className="min-w-[46rem]"><div className="ml-60 grid grid-cols-5 border-b border-slate-200 pb-2 text-center text-xs font-semibold text-slate-500">{milestoneLabels.map((milestone) => <span key={milestone.ratio}>{milestone.label}</span>)}</div><div className="mt-3 space-y-3">{tasks.map((task) => {
            const due = parseDay(task.due_date);
            const dueOffset = due ? Math.max(0, Math.min(100, ((due - schedule.start) / DAY_MS / schedule.totalDays) * 100)) : 0;
            const progress = Math.max(0, Math.min(100, Number(task.progress) || 0));
            const barWidth = due ? Math.max(4, dueOffset) : 8;
            return <div key={task.id} className="grid grid-cols-[15rem_1fr] items-center gap-4"><button className="text-left" onClick={() => navigate(`/task/${task.id}`, { state: { task } })}><p className="truncate text-sm font-bold text-slate-800 hover:text-blue-700">{task.title}</p><p className="mt-0.5 text-xs text-slate-500">{task.assigned_to_name || "Unassigned"} · {dateLabel(task.due_date)}</p></button><div className="relative h-9 rounded-lg bg-slate-100"><div className="absolute left-0 top-1/2 h-4 -translate-y-1/2 rounded-full bg-blue-200" style={{ width: `${barWidth}%` }}><div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} /></div><span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-600">{progress}%</span></div></div>;
          })}</div>{!tasks.length ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No tasks are linked to this project yet.</p> : null}</div></div>
        </section> : null}
      </section>
    </main>
  );
}
