import { Link } from "react-router-dom";

const STATS = [
  { value: "2,400+", label: "Active teams" },
  { value: "98.7%", label: "Workspace uptime" },
  { value: "5", label: "Role dashboards" }
];

const FEATURES = [
  {
    title: "Project command center",
    body: "Track projects, tasks, approvals, and team activity from one focused workspace."
  },
  {
    title: "Role-based visibility",
    body: "Owners, managers, HR, employees, and clients all get interfaces matched to their work."
  },
  {
    title: "Live operational flow",
    body: "Attendance, leaves, task movement, and project progress stay connected in real time."
  }
];

export default function HomePage() {
  return (
    <main className="ui-shell px-6 py-6 md:px-10 lg:px-12">
      <nav className="ui-panel mx-auto flex max-w-6xl items-center justify-between rounded-full px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-black text-white shadow-lg shadow-blue-200">
            W
          </div>
          <div>
            <p className="ui-brand text-2xl font-semibold text-slate-900">WorkZen</p>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Unified workspace</p>
          </div>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <Link to="/login" className="ui-button-secondary">
            Sign in
          </Link>
          <Link to="/register" className="ui-button-primary">
            Get started
          </Link>
        </div>
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl items-center gap-10 py-14 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">
            Enterprise workspace platform
          </div>
          <h1 className="ui-brand max-w-3xl text-5xl leading-tight text-slate-900 md:text-6xl">
            Your minor project UI, reimagined with a cleaner premium dashboard feel.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            WorkZen brings project management, leave handling, attendance visibility, and user control into one light, cleaner interface inspired by your sample design direction.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/login" className="ui-button-primary min-w-40">
              Open dashboard
            </Link>
            <Link to="/register" className="ui-button-secondary min-w-40">
              Create workspace
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {STATS.map((item) => (
              <article key={item.label} className="ui-hero-card p-5">
                <p className="ui-brand text-4xl text-blue-700">{item.value}</p>
                <p className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {FEATURES.map((feature, index) => (
            <article key={feature.title} className="ui-hero-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
                  0{index + 1}
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                  Active
                </span>
              </div>
              <h2 className="text-2xl font-semibold text-slate-900">{feature.title}</h2>
              <p className="mt-3 text-base leading-7 text-slate-600">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
