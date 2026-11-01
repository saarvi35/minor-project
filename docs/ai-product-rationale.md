# Why WorkZen uses AI

WorkZen uses generative AI only for work that needs language understanding and synthesis. Its AI Project Architect turns an unstructured project brief into a reviewable execution proposal: scope summary, assumptions, milestones, delivery risks, mitigations, acceptance criteria, and a workload-aware task breakdown.

This cannot be replaced with ordinary forms or fixed workflow rules. A rule can notify a person when a due date is missed. It cannot read a new brief in natural language, infer a coherent set of dependent work items, draft acceptance criteria, identify assumptions, and adapt task allocation to the currently available team.

The AI does not directly change the workspace. It generates a draft, the owner or manager reviews it, and an explicit **Apply plan** action creates the project and tasks. Deterministic capabilities remain deterministic: tenant access, task status changes, SLA checks, notifications, and workflow rules stay in the backend and do not depend on the model.

## Market alignment

This design follows the direction of current work-management products without copying their implementation:

- [Asana Smart Status](https://help.asana.com/s/article/smart-status?language=en) uses AI to surface blockers, open questions, and next steps from current project work.
- [Asana AI features](https://help.asana.com/s/article/get-started-with-asana-ai) include status drafting, summaries, smart fields, and rule creation.
- [Jira Rovo work-item creation](https://support.atlassian.com/jira-software-cloud/docs/create-work-items-with-rovo/) generates reviewable work items from a natural-language description before creation.
- [Atlassian Rovo](https://www.atlassian.com/software/rovo/guides/end-user-guide/what-is-rovo) describes context-aware agents that synthesize work and knowledge before taking action.
- [monday.com project management](https://support.monday.com/hc/en-us/articles/360014437599-Project-management-with-monday-com) positions AI across project planning, organisation, and delivery workflows.

## Privacy and human control

Gemini receives the project brief, active project delivery signals, and anonymous team candidates such as `member_1`, their role, and active-task count. WorkZen does not send the company name, employee names, emails, credentials, tokens, or contact details to the model. The mapping from an anonymous candidate to the actual team member takes place locally after the model response returns.

The generated proposal is stored as a tenant-scoped draft. It can only be applied by an owner or manager with project/task creation permission. This ensures that AI suggests work while accountable users retain the final decision.
