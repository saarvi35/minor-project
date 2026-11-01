# AI Project Architect

The AI Project Architect converts a project brief into a reviewable project plan: an executive summary, assumptions, milestones, delivery risks, mitigations, and a task breakdown with acceptance criteria. The owner or manager must review the draft and choose **Apply plan** before WorkZen creates a project or tasks.

## Why this requires generative AI

The feature interprets an unstructured business brief, decomposes it into work, drafts acceptance criteria, identifies likely delivery risks, and adapts recommendations to available team roles and workload. Standard workflow rules remain responsible for deterministic actions such as notifications and SLA checks; they cannot perform this open-ended language reasoning and plan generation.

## Privacy boundary

Gemini receives only the user-entered brief, active project delivery signals, and anonymous team candidates such as `member_1`, role, and active-task count. It does not receive company name, employee names, emails, contact details, credentials, tokens, or account data. The final mapping from a candidate ID to a real member happens only inside WorkZen after the response returns.

## Setup

Set these values in `backend/.env`, then restart the Django backend:

```text
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_MODEL=gemini-3.8-flash
```

The owner or manager opens **AI Project Architect** from the sidebar, enters a clear brief, reviews the generated plan, and explicitly applies it. A missing API key keeps the feature unavailable and shows the precise setup instruction; it never substitutes fabricated AI output.
