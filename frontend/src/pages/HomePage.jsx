import { useState, useEffect } from "react";
import logo from "./logo.png";

const STATS = [{ label: "Active teams", value: "120+" }, { label: "Tasks tracked daily", value: "40k" }, { label: "Avg approval time", value: "2.4h" }];
const LOGOS = ["Northwind", "Atlas", "Novaline", "Pioneer", "Brightline", "Veridian"];
const PILLARS = [
    { icon: "⬡", title: "Clarity across teams", body: "Live views for managers, employees, clients, and HR with zero noise." },
    { icon: "⬢", title: "Decisions without delay", body: "Approvals, reviews, and handoffs move in one connected flow." },
    { icon: "◉", title: "Confidence in delivery", body: "Every task, file, and deadline stays tied to accountable owners." },
];
const FEATURES = [
    { num: "01", title: "Unified command center", body: "Project progress, team performance, approvals, and finance signals in one view." },
    { num: "02", title: "Built for managers", body: "Structured workflows for task assignment, leave approvals, and team accountability." },
    { num: "03", title: "Client-ready visibility", body: "Give clients real-time updates without exposing internal operations." },
    { num: "04", title: "Smart handoffs", body: "Employees always know what to do next, with context, files, and due dates." },
];
const WORKFLOW = [
    { title: "Create projects", body: "Set scope, deadlines, and ownership with clean setup screens." },
    { title: "Assign tasks", body: "Route work to the right people with clear priorities and files." },
    { title: "Track progress", body: "Live dashboards show what is done, what is late, and what needs attention." },
];
const TOOLKIT = [
    { title: "Progress snapshots", body: "Instantly see what is done, delayed, or ready for review." },
    { title: "Attendance control", body: "Daily check-ins, check-outs, and leave approvals stay in sync." },
    { title: "Role-based access", body: "Owners, managers, HR, and clients see only what they need." },
];

const css = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
:root {
  --bg:#f0f4ff; --white:#fff; --ink:#0d1b3e; --ink2:#1e3a6e;
  --blue:#2563eb; --blue2:#1d4ed8; --blue3:#3b82f6; --blue4:#60a5fa;
  --muted:#6b7a99; --border:rgba(37,99,235,.12);
}
html[data-theme='dark'] {
  --bg:#070c18; --white:#0f1729; --ink:#e5edf8; --ink2:#b9c9e3;
  --muted:#98afd3; --border:rgba(148,163,184,.24);
}
body { font-family:'Plus Jakarta Sans',sans-serif; background:var(--bg); color:var(--ink); -webkit-font-smoothing:antialiased; }
.z1  { position:relative; z-index:1; }

/* NAV */
.nav { position:fixed; top:0; left:0; right:0; z-index:100; height:70px; padding:0 3rem; display:flex; align-items:center; justify-content:space-between; background:linear-gradient(135deg,#0a1a3e 0%,#0d2760 55%,#1a3a8f 100%); border-bottom:3px solid #1e4db7; transition:box-shadow .3s; }
.nav-brand { display:flex; align-items:center; gap:14px; text-decoration:none; }
.nav-logo  { width:46px; height:46px; border-radius:50%; overflow:hidden; border:2px solid rgba(255,255,255,.3); box-shadow:0 0 0 3px rgba(30,77,183,0.35); flex-shrink:0; }
.nav-logo img { width:100%; height:100%; object-fit:cover; display:block; }
.nav-name p:first-child { font-size:10px; letter-spacing:.25em; text-transform:uppercase; color:rgba(255,255,255,.55); margin-bottom:2px; }
.nav-name p:last-child  { font-size:20px; font-weight:800; color:#fff; letter-spacing:.01em; font-family:'Georgia',serif; line-height:1; }
.nav-actions { display:flex; gap:8px; }
.btn-ghost  { padding:8px 20px; font-size:14px; font-weight:600; color:#fff; background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.2); border-radius:7px; cursor:pointer; text-decoration:none; transition:all .2s; }
.btn-ghost:hover  { background:rgba(255,255,255,.22); }
.btn-white  { padding:8px 20px; font-size:14px; font-weight:700; color:var(--blue2); background:#fff; border:none; border-radius:7px; cursor:pointer; text-decoration:none; box-shadow:0 2px 10px rgba(0,0,0,.15); transition:all .2s; font-family:'Georgia',serif; }
.btn-white:hover  { box-shadow:0 4px 18px rgba(0,0,0,.2); transform:translateY(-1px); }

/* HERO */
.hero { min-height:100vh; padding:106px 3rem 60px; display:grid; grid-template-columns:1fr 420px; gap:60px; align-items:center; position:relative; overflow:hidden; background:linear-gradient(160deg,#e8eeff,#f0f4ff 40%,#dde8ff); }
.hero-glow { position:absolute; inset:0; pointer-events:none; background:radial-gradient(ellipse 55% 65% at 68% 38%,rgba(37,99,235,.18),transparent 60%), radial-gradient(ellipse 45% 55% at 5% 85%,rgba(96,165,250,.14),transparent 55%); }
.hero-grid { position:absolute; inset:0; pointer-events:none; background-image:linear-gradient(rgba(37,99,235,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(37,99,235,.07) 1px,transparent 1px); background-size:60px 60px; mask-image:radial-gradient(ellipse 90% 90% at 50% 50%,black,transparent); }
.hero-orb  { position:absolute; border-radius:50%; pointer-events:none; animation:orbFloat 8s ease-in-out infinite; }
.hero-orb.big   { width:420px; height:420px; top:-80px; right:80px; background:radial-gradient(circle,rgba(37,99,235,.12),transparent 70%); }
.hero-orb.small { width:280px; height:280px; bottom:60px; left:-60px; background:radial-gradient(circle,rgba(96,165,250,.1),transparent 70%); animation-duration:10s; animation-direction:reverse; }
@keyframes orbFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-20px); } }

.hero-bubble { display:inline-flex; align-items:center; gap:8px; font-size:12px; font-weight:600; color:var(--blue); background:rgba(37,99,235,.08); border:1px solid rgba(37,99,235,.2); border-radius:999px; padding:6px 16px; margin-bottom:20px; backdrop-filter:blur(4px); }
.hero h1   { font-size:clamp(34px,4.2vw,58px); font-weight:700; line-height:1.12; letter-spacing:-.03em; margin-bottom:18px; }
.hero h1 span { background:linear-gradient(135deg,var(--blue),var(--blue3)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.hero-sub  { font-size:15px; line-height:1.7; color:var(--muted); max-width:440px; margin-bottom:28px; }
.hero-cta  { display:flex; gap:10px; flex-wrap:wrap; }
.btn-primary { padding:11px 26px; font-size:13px; font-weight:600; color:#fff; background:linear-gradient(135deg,var(--blue),var(--blue2)); border:none; border-radius:8px; cursor:pointer; text-decoration:none; box-shadow:0 4px 18px rgba(37,99,235,.35); transition:all .25s; }
.btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 26px rgba(37,99,235,.45); }
.btn-outline { padding:11px 26px; font-size:13px; font-weight:500; color:var(--ink2); background:var(--white); border:1px solid var(--border); border-radius:8px; cursor:pointer; text-decoration:none; transition:all .25s; }
.btn-outline:hover { border-color:var(--blue); color:var(--blue); }

.hero-trust { display:flex; align-items:center; gap:16px; margin-top:20px; flex-wrap:wrap; }
.trust-item { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--muted); }
.trust-item::before { content:'✓'; width:16px; height:16px; border-radius:50%; background:linear-gradient(135deg,var(--blue),var(--blue3)); color:#fff; font-size:9px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.hero-social { display:flex; align-items:center; gap:10px; margin-top:16px; padding:11px 14px; background:rgba(255,255,255,.7); border:1px solid rgba(37,99,235,.1); border-radius:10px; backdrop-filter:blur(8px); width:fit-content; }
.avatars { display:flex; }
.avatar  { width:28px; height:28px; border-radius:50%; border:2px solid #fff; margin-left:-8px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; color:#fff; }
.avatar:first-child { margin-left:0; }
.social-text { font-size:12px; color:var(--muted); }
.social-text strong { color:var(--ink); }

/* DASHBOARD CARD */
.dash-card   { background:linear-gradient(160deg,#0d1b3e,#1a2f5a); border-radius:12px; overflow:hidden; box-shadow:0 28px 56px rgba(13,27,62,.35),0 0 0 1px rgba(37,99,235,.2); animation:cardFloat 5s ease-in-out infinite; }
@keyframes cardFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
.card-header { padding:16px 18px 12px; border-bottom:1px solid rgba(255,255,255,.07); display:flex; align-items:center; justify-content:space-between; }
.card-label  { font-size:9px; letter-spacing:.3em; text-transform:uppercase; color:rgba(255,255,255,.3); margin-bottom:3px; }
.card-title  { font-size:14px; font-weight:600; color:#fff; }
.live-dot    { width:7px; height:7px; border-radius:50%; background:#4ade80; box-shadow:0 0 8px rgba(74,222,128,.7); animation:livePulse 2s infinite; }
@keyframes livePulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
.card-body    { padding:14px 18px 18px; }
.card-metrics { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
.card-metric  { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.07); border-radius:7px; padding:11px 13px; }
.metric-label { font-size:9px; color:rgba(255,255,255,.35); text-transform:uppercase; letter-spacing:.15em; margin-bottom:4px; }
.metric-value { font-size:24px; font-weight:700; color:#fff; letter-spacing:-.02em; }
.card-divider { height:1px; background:rgba(255,255,255,.07); margin-bottom:11px; }
.focus-label  { font-size:9px; letter-spacing:.2em; text-transform:uppercase; color:rgba(255,255,255,.3); margin-bottom:7px; }
.focus-row    { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; margin-bottom:6px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); border-radius:6px; }
.focus-row span { font-size:12px; color:rgba(255,255,255,.72); }
.badge      { font-size:9px; padding:3px 8px; border-radius:4px; font-weight:500; }
.badge.prog { background:rgba(37,99,235,.25); color:#93c5fd; }
.badge.rev  { background:rgba(96,165,250,.15); color:#7dd3fc; }

/* STATS */
.stats-band { display:grid; grid-template-columns:repeat(3,1fr); background:linear-gradient(135deg,var(--blue2),var(--blue) 50%,var(--blue3)); }
.stat-item  { padding:28px 36px; text-align:center; border-right:1px solid rgba(255,255,255,.1); }
.stat-item:last-child { border-right:none; }
.stat-value { font-size:42px; font-weight:700; color:#fff; letter-spacing:-.03em; line-height:1; }
.stat-label { font-size:11px; letter-spacing:.15em; text-transform:uppercase; color:rgba(255,255,255,.6); margin-top:5px; }

/* LOGOS */
.logos-section { padding:28px 3rem; background:var(--white); border-bottom:1px solid var(--border); display:flex; flex-direction:column; align-items:center; gap:14px; }
.logos-row { display:flex; flex-wrap:wrap; justify-content:center; gap:8px; }
.logo-tag  { padding:5px 18px; border:1px solid var(--border); font-size:12px; letter-spacing:.1em; color:var(--muted); border-radius:20px; transition:all .2s; cursor:default; }
.logo-tag:hover { border-color:var(--blue); color:var(--ink); background:rgba(37,99,235,.05); }

/* SHARED SECTION TYPOGRAPHY */
.sec-tag { font-size:10px; letter-spacing:.3em; text-transform:uppercase; font-weight:600; margin-bottom:10px; }
.sec-h2  { font-size:clamp(24px,2.8vw,38px); font-weight:700; line-height:1.2; letter-spacing:-.02em; margin-bottom:8px; }
.sec-sub { font-size:14px; line-height:1.65; }
.sec-center { text-align:center; max-width:560px; margin:0 auto 36px; }

/* PILLARS */
.pillars-section { padding:60px 3rem; position:relative; overflow:hidden; background:linear-gradient(160deg,#0d1b3e,#0f2251 60%,#1a3a6e); }
.pillars-section::before { content:''; position:absolute; inset:0; pointer-events:none; background:radial-gradient(ellipse 80% 60% at 50% 50%,rgba(37,99,235,.15),transparent 70%); }
.pillars-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.08); border-radius:12px; overflow:hidden; position:relative; z-index:1; }
.pillar-card  { padding:28px 24px; background:#0f2251; transition:background .3s; }
.pillar-card:hover { background:#1a3570; }
.pillar-icon  { font-size:18px; color:var(--blue4); margin-bottom:12px; display:block; }
.pillar-card h3 { font-size:16px; font-weight:600; color:#fff; margin-bottom:6px; }
.pillar-card p  { font-size:13px; color:rgba(255,255,255,.5); line-height:1.6; }

/* FEATURES */
.features-layout  { display:grid; grid-template-columns:260px 1fr; gap:52px; align-items:start; }
.features-sidebar { position:sticky; top:80px; }
.features-grid    { display:grid; grid-template-columns:1fr 1fr; gap:1px; background:var(--border); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
.feature-card     { padding:24px 20px; background:var(--white); transition:background .2s; }
.feature-card:hover { background:#e8eeff; }
.feature-num { font-size:32px; font-weight:700; opacity:.5; line-height:1; margin-bottom:10px; background:linear-gradient(135deg,var(--blue),var(--blue3)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.feature-card h3 { font-size:14px; font-weight:600; color:var(--ink); margin-bottom:5px; }
.feature-card p  { font-size:13px; color:var(--muted); line-height:1.6; }

/* WORKFLOW */
.workflow-steps { display:grid; grid-template-columns:repeat(3,1fr); position:relative; }
.workflow-steps::after { content:''; position:absolute; top:22px; left:12%; right:12%; height:1px; background:linear-gradient(90deg,transparent,var(--blue),transparent); opacity:.2; }
.workflow-step  { padding:28px 20px 20px; text-align:center; }
.step-number    { width:44px; height:44px; margin:0 auto 16px; border:1.5px solid var(--blue); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700; color:var(--blue); background:linear-gradient(135deg,rgba(37,99,235,.08),rgba(59,130,246,.04)); position:relative; z-index:1; }
.workflow-step h3 { font-size:14px; font-weight:600; color:var(--ink); margin-bottom:5px; }
.workflow-step p  { font-size:13px; color:var(--muted); line-height:1.6; }

/* TOOLKIT */
.toolkit-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
.toolkit-card { padding:24px 20px; border:1px solid var(--border); background:var(--white); border-radius:10px; position:relative; overflow:hidden; transition:box-shadow .3s,transform .2s; }
.toolkit-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg,var(--blue),var(--blue3),transparent); opacity:0; transition:opacity .3s; }
.toolkit-card:hover { box-shadow:0 8px 28px rgba(37,99,235,.1); transform:translateY(-2px); }
.toolkit-card:hover::before { opacity:1; }
.toolkit-card h3 { font-size:14px; font-weight:600; color:var(--ink); margin-bottom:6px; }
.toolkit-card p  { font-size:13px; color:var(--muted); line-height:1.6; }

/* SECURITY */
.security-section    { padding:44px 3rem; background:linear-gradient(135deg,#1d4ed8,#1e3a8a); display:flex; align-items:center; justify-content:space-between; gap:28px; flex-wrap:wrap; }
.security-section h2 { font-size:20px; font-weight:700; color:#fff; margin-bottom:5px; }
.security-section p  { font-size:13px; color:rgba(255,255,255,.55); }
.security-badges { display:flex; gap:8px; flex-wrap:wrap; }
.security-badge  { padding:6px 14px; font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:rgba(255,255,255,.85); border:1px solid rgba(255,255,255,.2); border-radius:20px; display:flex; align-items:center; gap:5px; background:rgba(255,255,255,.08); }
.security-badge::before { content:'✓'; color:#4ade80; font-weight:700; font-size:11px; }

/* CTA */
.cta-section { padding:72px 3rem; text-align:center; position:relative; overflow:hidden; background:linear-gradient(160deg,#07101f,#0f2251 50%,#1a3570); }
.cta-section::before { content:''; position:absolute; inset:0; pointer-events:none; background:radial-gradient(ellipse 60% 60% at 50% 50%,rgba(37,99,235,.2),transparent 65%); }
.cta-section h2 { font-size:clamp(26px,3.2vw,44px); font-weight:700; color:#fff; letter-spacing:-.02em; line-height:1.15; max-width:580px; margin:0 auto 10px; }
.cta-section h2 span { background:linear-gradient(135deg,var(--blue3),var(--blue4)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.cta-section p  { font-size:14px; color:rgba(255,255,255,.4); margin-bottom:28px; }
.cta-buttons    { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; position:relative; z-index:1; }
.btn-cta-solid  { padding:12px 30px; font-size:13px; font-weight:600; color:var(--ink); background:linear-gradient(135deg,#60a5fa,#3b82f6); border:none; border-radius:8px; cursor:pointer; text-decoration:none; box-shadow:0 4px 18px rgba(96,165,250,.35); transition:all .25s; }
.btn-cta-solid:hover  { transform:translateY(-2px); box-shadow:0 8px 26px rgba(96,165,250,.5); }
.btn-cta-ghost  { padding:12px 30px; font-size:13px; font-weight:500; color:rgba(255,255,255,.65); background:transparent; border:1px solid rgba(255,255,255,.18); border-radius:8px; cursor:pointer; text-decoration:none; transition:all .25s; }
.btn-cta-ghost:hover  { border-color:rgba(255,255,255,.42); color:#fff; }

/* FOOTER */
.footer       { padding:26px 3rem; background:#07101f; border-top:1px solid rgba(255,255,255,.06); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; }
.footer p     { font-size:12px; color:rgba(255,255,255,.28); }
.footer-brand { display:flex; align-items:center; gap:8px; }
.footer-logo  { width:24px; height:24px; border-radius:6px; background:linear-gradient(135deg,var(--blue2),var(--blue)); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:11px; }

/* RESPONSIVE */
@media (max-width:1024px) {
  .hero, .features-layout { grid-template-columns:1fr; }
  .pillars-grid, .workflow-steps, .toolkit-grid, .stats-band { grid-template-columns:1fr; }
  .stat-item { border-right:none; border-bottom:1px solid rgba(255,255,255,.1); }
  .nav, .hero, .logos-section, .pillars-section, .security-section, .cta-section, .footer { padding-left:1.5rem; padding-right:1.5rem; }
  .security-section { flex-direction:column; align-items:flex-start; }
  .features-sidebar { position:static; }
}
`;

const SH = ({ tag, tagColor, h2, h2Color, sub, subColor }) => (
    <>
        <div className="sec-tag" style={{ color: tagColor }}>{tag}</div>
        <h2 className="sec-h2" style={{ color: h2Color }}>{h2}</h2>
        <p className="sec-sub" style={{ color: subColor }}>{sub}</p>
    </>
);

export default function HomePage() {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <>
            <style>{css}</style>
            <main>

                {/* NAV */}
                <header className="nav" style={{ boxShadow: scrolled ? "0 4px 24px rgba(13,27,62,.25)" : "none" }}>
                    <a href="/" className="nav-brand">
                        <div className="nav-logo">
                            <img src={logo} alt="WorkZen" />
                        </div>
                        <div className="nav-name">
                            <p>Enterprise Platform</p>
                            <p>WorkZen</p>
                        </div>
                    </a>
                    <div className="nav-actions">
                        <a href="/login" className="btn-ghost">Login</a>
                        <a href="/register" className="btn-white">Register →</a>
                    </div>
                </header>

                {/* HERO */}
                <section className="hero">
                    <div className="hero-glow" /><div className="hero-grid" />
                    <div className="hero-orb big" /><div className="hero-orb small" />
                    <div className="z1">
                        <div className="hero-bubble">✦ Modern ops for growing teams</div>
                        <h1>Keep every project moving with <span>clarity & ownership.</span></h1>
                        <p className="hero-sub">WorkZen connects managers, employees, clients, and HR into one structured workflow so you never lose momentum.</p>
                        <div className="hero-cta">
                            <a href="/register" className="btn-primary">Start your workspace</a>
                            <a href="/login" className="btn-outline">I already have an account</a>
                        </div>
                        <div className="hero-trust">
                            {["Free to start", "No credit card", "Setup in minutes"].map(t => <span key={t} className="trust-item">{t}</span>)}
                        </div>
                        <div className="hero-social">
                            <div className="avatars">
                                {[["#2563eb", "A"], ["#1d4ed8", "B"], ["#3b82f6", "C"], ["#1e3a6e", "D"]].map(([bg, l]) => (
                                    <div key={l} className="avatar" style={{ background: bg }}>{l}</div>
                                ))}
                            </div>
                            <div className="social-text"><strong>120+ teams</strong> already use WorkZen daily</div>
                        </div>
                    </div>
                    <div className="z1">
                        <div className="dash-card">
                            <div className="card-header">
                                <div><div className="card-label">Live Operations</div><div className="card-title">Executive Overview</div></div>
                                <div className="live-dot" />
                            </div>
                            <div className="card-body">
                                <div className="card-metrics">
                                    <div className="card-metric"><div className="metric-label">On track</div><div className="metric-value">82%</div></div>
                                    <div className="card-metric"><div className="metric-label">Approvals</div><div className="metric-value">14</div></div>
                                </div>
                                <div className="card-divider" />
                                <div className="focus-label">Priority focus</div>
                                <div className="focus-row"><span>Marketing website refresh</span><span className="badge prog">In progress</span></div>
                                <div className="focus-row"><span>Finance month-end close</span><span className="badge rev">Review</span></div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* STATS */}
                <section className="stats-band">
                    {STATS.map(s => <div key={s.label} className="stat-item"><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div></div>)}
                </section>

                {/* LOGOS */}
                <section className="logos-section">
                    <p className="sec-tag" style={{ color: "var(--muted)" }}>Trusted teams</p>
                    <div className="logos-row">{LOGOS.map(l => <span key={l} className="logo-tag">{l}</span>)}</div>
                </section>

                {/* PILLARS */}
                <section className="pillars-section">
                    <div className="sec-center z1">
                        <SH tag="Why WorkZen" tagColor="var(--blue4)" h2="Built for speed and accountability" h2Color="#fff" sub="Everything stays connected from goals to execution." subColor="rgba(255,255,255,.45)" />
                    </div>
                    <div className="pillars-grid">
                        {PILLARS.map(p => <div key={p.title} className="pillar-card"><span className="pillar-icon">{p.icon}</span><h3>{p.title}</h3><p>{p.body}</p></div>)}
                    </div>
                </section>

                {/* FEATURES */}
                <section style={{ padding: "60px 3rem", background: "var(--bg)" }}>
                    <div className="features-layout">
                        <div className="features-sidebar">
                            <SH tag="Core capabilities" tagColor="var(--blue)" h2="Designed for execution, not just tracking" h2Color="var(--ink)" sub="Everything in your workspace is structured to keep work moving without friction." subColor="var(--muted)" />
                            <a href="/register" className="btn-primary" style={{ marginTop: 22, display: "inline-block" }}>Start for free →</a>
                        </div>
                        <div className="features-grid">
                            {FEATURES.map(f => <div key={f.title} className="feature-card"><div className="feature-num">{f.num}</div><h3>{f.title}</h3><p>{f.body}</p></div>)}
                        </div>
                    </div>
                </section>

                {/* WORKFLOW */}
                <section style={{ padding: "60px 3rem", background: "var(--white)", borderTop: "1px solid var(--border)" }}>
                    <div className="sec-center">
                        <SH tag="How it works" tagColor="var(--blue)" h2="Clear steps from kickoff to completion" h2Color="var(--ink)" sub="Give every team a shared playbook with accountability built in." subColor="var(--muted)" />
                    </div>
                    <div className="workflow-steps">
                        {WORKFLOW.map((w, i) => <div key={w.title} className="workflow-step"><div className="step-number">0{i + 1}</div><h3>{w.title}</h3><p>{w.body}</p></div>)}
                    </div>
                </section>

                {/* TOOLKIT */}
                <section style={{ padding: "60px 3rem", background: "var(--bg)" }}>
                    <div style={{ maxWidth: 500, marginBottom: 28 }}>
                        <SH tag="Toolkit" tagColor="var(--blue)" h2="Everything you expect, styled for real work" h2Color="var(--ink)" sub="Dashboards, approvals, and audit trails look sharp and stay aligned." subColor="var(--muted)" />
                    </div>
                    <div className="toolkit-grid">
                        {TOOLKIT.map(t => <div key={t.title} className="toolkit-card"><h3>{t.title}</h3><p>{t.body}</p></div>)}
                    </div>
                </section>

                {/* SECURITY */}
                <section className="security-section">
                    <div><h2>Secure, structured, and audit-ready</h2><p>Role-based access, traceable updates, and clear approvals for every team.</p></div>
                    <div className="security-badges">
                        {["Role-based visibility", "Approval traceability", "Consistent audit trails"].map(b => <span key={b} className="security-badge">{b}</span>)}
                    </div>
                </section>

                {/* CTA */}
                <section className="cta-section">
                    <div className="z1" style={{ position: "relative" }}>
                        <h2>Ready to run operations <span>with confidence?</span></h2>
                        <p>Launch your workspace and keep every role aligned from day one.</p>
                        <div className="cta-buttons">
                            <a href="/register" className="btn-cta-solid">Create your company →</a>
                            <a href="/login" className="btn-cta-ghost">Login</a>
                        </div>
                    </div>
                </section>

                {/* FOOTER */}
                <footer className="footer">
                    <div className="footer-brand"><div className="footer-logo">W</div><p>WorkZen — Smart Enterprise Platform.</p></div>
                </footer>

            </main>
        </>
    );
}
