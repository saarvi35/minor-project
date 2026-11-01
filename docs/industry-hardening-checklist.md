# WorkZen Industry Hardening Checklist

This checklist turns the architecture and security review into tracked engineering work. Items are only marked complete after code review and automated verification.

## P0 — Security and tenant isolation

- [x] Make authentication the default for every API and explicitly identify public endpoints.
- [x] Restrict company records to the authenticated member's tenant; prohibit public company creation, update, and deletion.
- [x] Enforce tenant ownership and role hierarchy for invitations, user updates, and role changes.
- [x] Prevent privilege escalation through role permissions or self-promotion.
- [x] Protect HR-only fields, especially salary, department assignment, performance reviews, and leave approval.
- [x] Scope Phase 1 object lookups by tenant and add negative cross-tenant tests.
- [x] Configure JWT refresh, refresh-token rotation/blacklisting, secure cookies, HTTPS, hosts, CORS, and production headers.
- [ ] Rotate any real secret that has been used outside a local-only environment.

## P1 — Functional correctness and data integrity

- [x] Restrict task edits by role and field; enforce `can_update_task_status`.
- [x] Repair broken task analytics and employee task-list endpoints.
- [x] Add invitation expiry, resend, and import-driven invitations; delivery failure is reported safely.
- [x] Validate workbook required fields, duplicate keys, task/project identities, and basic upload type/size checks.
- [x] Replace destructive user deletion with safe deactivation; archive tasks/projects and block deletion of roles that are still assigned.
- [ ] Add database constraints for tenant membership, role names, and tenant-consistent relationships where feasible.

## P2 — Architecture and quality

- [ ] Split the manager dashboard into focused feature components.
- [ ] Consolidate authorization into reusable permission/policy classes.
- [ ] Add pagination, filtering, query optimisation, consistent API errors, audit logging, and observability.
- [ ] Align dependency versions and document supported runtime versions.

## P3 — AI and automation

- [ ] Send the Gemini API key in a header, never a URL.
- [ ] Add per-tenant AI rate limits, quotas, prompt retention rules, safety handling, and auditable model metadata.
- [ ] Limit AI assignment candidates to eligible workers and validate generated plans before application.
- [ ] Verify workflow/SLA execution under failure, retry, and duplicate-delivery conditions.

## P4 — Verification and delivery

- [ ] Add role-by-role, cross-tenant, import, workflow, AI-failure, and frontend integration tests.
- [ ] Run all tests in CI with all required dependency groups.
- [ ] Verify Docker, migrations, health checks, production settings, backups, and rollback procedures.
