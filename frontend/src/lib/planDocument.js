const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const list = (items) => (items.length ? `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>` : "<p>None noted.</p>");

/** Builds a Word-compatible document of a draft plan that can be sent to a client. */
export function buildPlanDocumentHtml(plan) {
  const data = plan?.plan || {};
  const project = data.project || {};
  const title = project.name || plan?.title || "Project plan";
  const assumptions = (data.assumptions || []).map(escapeHtml);
  const milestones = (data.milestones || []).map(
    (item) => `<strong>${escapeHtml(item.title)}</strong> (day ${escapeHtml(item.due_offset_days ?? "-")}): ${escapeHtml(item.outcome)}`
  );
  const risks = (data.risks || []).map(
    (item) => `<strong>${escapeHtml(item.risk)}</strong> [${escapeHtml(item.severity || "-")}]: ${escapeHtml(item.mitigation)}`
  );
  const taskRows = (data.tasks || [])
    .map(
      (task, index) => `<tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(task.title)}</strong><br/>${escapeHtml(task.description)}</td>
        <td>${escapeHtml(task.priority)}</td>
        <td>Day ${escapeHtml(task.due_offset_days)}</td>
        <td>${escapeHtml(task.acceptance_criteria)}</td>
      </tr>`
    )
    .join("");

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; color: #1e293b; line-height: 1.5; }
  h1 { font-size: 24pt; color: #4c1d95; margin-bottom: 2pt; }
  h2 { font-size: 14pt; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 2pt; margin-top: 18pt; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #cbd5e1; padding: 5pt; vertical-align: top; font-size: 10pt; }
  th { background: #eef2ff; text-align: left; }
  .meta { color: #64748b; font-size: 10pt; }
</style></head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">Project plan prepared on ${escapeHtml(new Date().toLocaleDateString())}${plan?.status === "APPLIED" ? "" : " &middot; Draft for review"}</p>
  <h2>Overview</h2>
  <p>${escapeHtml(data.executive_summary || project.description || "")}</p>
  <p><strong>Priority:</strong> ${escapeHtml(project.priority || "-")} &nbsp; <strong>Estimated duration:</strong> ${escapeHtml(project.estimated_duration_days || "-")} days</p>
  <h2>Milestones</h2>${list(milestones)}
  <h2>Work breakdown</h2>
  <table><thead><tr><th>#</th><th>Task</th><th>Priority</th><th>Target</th><th>Acceptance criteria</th></tr></thead><tbody>${taskRows}</tbody></table>
  <h2>Risks and mitigations</h2>${list(risks)}
  <h2>Assumptions</h2>${list(assumptions)}
</body></html>`;
}

export function downloadPlanDocument(plan) {
  const html = buildPlanDocumentHtml(plan);
  const name = String(plan?.plan?.project?.name || plan?.title || "project-plan")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const url = window.URL.createObjectURL(new Blob(["﻿", html], { type: "application/msword" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name || "project-plan"}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
