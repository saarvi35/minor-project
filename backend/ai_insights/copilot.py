import json
import os
from datetime import timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from companies.models import CompanyUser
from projects.models import Project
from tasks.models import Task, TaskActivity
from tasks.services import sync_project_progress

from .models import AIProjectPlan


class AIProviderUnavailable(Exception):
    pass


def _provider_timeout_seconds():
    """Keep external AI calls bounded so a provider outage cannot hang a request."""
    try:
        configured_timeout = int(os.getenv("GEMINI_REQUEST_TIMEOUT_SECONDS", "30"))
    except ValueError:
        configured_timeout = 30
    return max(5, min(configured_timeout, 60))


def provider_status():
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_AI_API_KEY")
    return {
        "available": bool(key),
        "provider": "Google Gemini",
        "model": os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
        "setup_hint": "Add GEMINI_API_KEY to backend/.env and restart the backend." if not key else "Ready",
    }


def _workspace_context(company):
    """Only anonymised delivery context is permitted to leave the tenant boundary."""
    workload = {
        row["assigned_to_id"]: row["count"]
        for row in Task.objects.filter(company=company, is_archived=False, status__in=["PENDING", "IN_PROGRESS"])
        .values("assigned_to_id")
        .annotate(count=Count("id"))
    }
    members = list(
        CompanyUser.objects.filter(
            company=company,
            status="ACTIVE",
            role__level__gte=40,
            role__level__lt=100,
            role__can_view_assigned_tasks=True,
        ).select_related("role").order_by("id")
    )
    local_candidates = {
        f"member_{index}": member
        for index, member in enumerate(members, start=1)
    }
    external_candidates = [
        {
            "candidate_id": candidate_id,
            "role": str(member.role.name),
            "active_task_count": workload.get(member.id, 0),
        }
        for candidate_id, member in local_candidates.items()
    ]
    projects = list(
        Project.objects.filter(company=company, is_active=True)
        .values("priority", "progress", "status", "end_date")[:20]
    )
    return {
        "external": {
            "team_candidates": external_candidates,
            "active_projects": projects,
        },
        "local_candidates": local_candidates,
    }


def _extract_json(text):
    clean = text.strip()
    if clean.startswith("```"):
        clean = clean.split("\n", 1)[1] if "\n" in clean else clean
        clean = clean.rsplit("```", 1)[0]
    return json.loads(clean)


def _normalise_plan(raw, title, candidate_ids, context_summary):
    if not isinstance(raw, dict):
        raise ValueError("The AI response was not a JSON object.")
    project = raw.get("project") if isinstance(raw.get("project"), dict) else {}
    tasks = raw.get("tasks") if isinstance(raw.get("tasks"), list) else []
    if not tasks:
        raise ValueError("The AI response did not contain any tasks.")
    normal_tasks = []
    for item in tasks[:20]:
        if not isinstance(item, dict) or not str(item.get("title", "")).strip():
            continue
        candidate_id = str(item.get("suggested_candidate_id", "")).strip()
        normal_tasks.append({
            "title": str(item["title"]).strip()[:255],
            "description": str(item.get("description", "")).strip()[:2000],
            "priority": str(item.get("priority", "MEDIUM")).upper() if str(item.get("priority", "MEDIUM")).upper() in {"LOW", "MEDIUM", "HIGH"} else "MEDIUM",
            "due_offset_days": max(1, min(365, int(item.get("due_offset_days", 7) or 7))),
            "suggested_candidate_id": candidate_id if candidate_id in candidate_ids else "",
            "acceptance_criteria": str(item.get("acceptance_criteria", "")).strip()[:1000],
        })
    if not normal_tasks:
        raise ValueError("The AI plan did not contain valid tasks.")
    milestones = raw.get("milestones") if isinstance(raw.get("milestones"), list) else []
    risks = raw.get("risks") if isinstance(raw.get("risks"), list) else []
    return {
        "project": {
            "name": str(project.get("name") or title).strip()[:255],
            "description": str(project.get("description", "")).strip()[:2000],
            "priority": str(project.get("priority", "MEDIUM")).upper() if str(project.get("priority", "MEDIUM")).upper() in {"LOW", "MEDIUM", "HIGH", "CRITICAL"} else "MEDIUM",
            "estimated_duration_days": max(7, min(365, int(project.get("estimated_duration_days", 60) or 60))),
        },
        "executive_summary": str(raw.get("executive_summary", "")).strip()[:2000],
        "assumptions": [str(item)[:300] for item in raw.get("assumptions", [])[:8]],
        "milestones": [item for item in milestones[:8] if isinstance(item, dict)],
        "risks": [item for item in risks[:8] if isinstance(item, dict)],
        "tasks": normal_tasks,
        "context_evidence": context_summary,
    }


def generate_project_plan(company_user, title, brief):
    status = provider_status()
    if not status["available"]:
        raise AIProviderUnavailable(status["setup_hint"])
    context = _workspace_context(company_user.company)
    external_context = context["external"]
    prompt = f"""You are WorkZen Project Architect. Create a practical execution plan from the project brief.
Use only the anonymised delivery context below. Choose task assignees only from candidate_id values. Balance work using active_task_count. Create no more than 10 tasks.
Return strict JSON only with this schema:
{{"project":{{"name":"","description":"","priority":"LOW|MEDIUM|HIGH|CRITICAL","estimated_duration_days":60}},"executive_summary":"","assumptions":[""],"milestones":[{{"title":"","due_offset_days":14,"outcome":""}}],"risks":[{{"risk":"","mitigation":"","severity":"LOW|MEDIUM|HIGH"}}],"tasks":[{{"title":"","description":"","priority":"LOW|MEDIUM|HIGH","due_offset_days":7,"suggested_candidate_id":"member_1","acceptance_criteria":""}}]}}

PROJECT TITLE: {title}
PROJECT BRIEF: {brief}
ANONYMISED DELIVERY CONTEXT: {json.dumps(external_context, default=str)}
"""
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_AI_API_KEY")
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{quote(status['model'], safe='-._')}:generateContent"
    request_body = json.dumps({
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.25,
            "responseMimeType": "application/json",
            # Gemini 3.x models spend part of this budget on hidden "thinking" tokens;
            # a small cap truncates the JSON plan mid-string.
            "maxOutputTokens": 8192,
        },
    }).encode("utf-8")
    try:
        request = Request(
            endpoint,
            data=request_body,
            headers={"Content-Type": "application/json", "x-goog-api-key": key},
            method="POST",
        )
        with urlopen(request, timeout=_provider_timeout_seconds()) as response:
            response_body = json.loads(response.read().decode("utf-8"))
        text = response_body["candidates"][0]["content"]["parts"][0]["text"]
    except (HTTPError, URLError, TimeoutError, OSError, KeyError, IndexError, UnicodeDecodeError) as error:
        raise AIProviderUnavailable(
            "Gemini could not generate a plan right now. Please retry shortly and check your Gemini API key, model access, and internet connection."
        ) from error
    summary = {
        "active_member_count": len(context["local_candidates"]),
        "active_project_count": len(external_context["active_projects"]),
        "member_workloads_considered": True,
        "external_data_policy": "No names, emails, company name, passwords, tokens, or contact details were sent to the AI provider.",
    }
    plan = _normalise_plan(_extract_json(text), title, set(context["local_candidates"]), summary)
    plan["candidate_assignments"] = {
        candidate_id: member.id for candidate_id, member in context["local_candidates"].items()
    }
    return AIProjectPlan.objects.create(
        company=company_user.company,
        created_by=company_user,
        title=plan["project"]["name"],
        brief=brief,
        plan=plan,
        provider="gemini",
        model_name=status["model"],
    )


def apply_project_plan(plan, actor):
    if plan.company_id != actor.company_id:
        raise ValueError("This AI plan belongs to another company.")
    if plan.status == AIProjectPlan.STATUS_APPLIED:
        raise ValueError("This AI plan has already been applied.")
    payload = plan.plan
    today = timezone.localdate()
    project_data = payload["project"]
    manager = actor if "manager" in str(actor.role.name).lower() else CompanyUser.objects.filter(company=actor.company, role__name__icontains="manager", status="ACTIVE").first()
    with transaction.atomic():
        project = Project.objects.create(
            company=actor.company,
            manager=manager,
            name=project_data["name"],
            description=project_data["description"],
            status="ACTIVE",
            priority=project_data["priority"],
            start_date=today,
            end_date=today + timedelta(days=project_data["estimated_duration_days"]),
            progress=0,
            is_active=True,
        )
        candidate_ids = payload.get("candidate_assignments", {})
        eligible_members = {
            member.id: member
            for member in CompanyUser.objects.filter(
                company=actor.company,
                status="ACTIVE",
                role__level__gte=40,
                role__level__lt=100,
                role__can_view_assigned_tasks=True,
                id__in=candidate_ids.values(),
            ).select_related("role")
        }
        members = {
            candidate_id: eligible_members[member_id]
            for candidate_id, member_id in candidate_ids.items()
            if member_id in eligible_members
        }
        for task_data in payload["tasks"]:
            assignee = members.get(task_data["suggested_candidate_id"]) or manager or actor
            task = Task.objects.create(
                company=actor.company,
                project=project,
                created_by=actor,
                assigned_to=assignee,
                title=task_data["title"],
                description=task_data["description"] + (f"\n\nAcceptance criteria: {task_data['acceptance_criteria']}" if task_data["acceptance_criteria"] else ""),
                priority=task_data["priority"],
                status="PENDING",
                progress=0,
                due_date=today + timedelta(days=task_data["due_offset_days"]),
            )
            TaskActivity.objects.create(task=task, actor=actor, event_type="ai_plan", summary="Created from an AI Project Architect plan")
        sync_project_progress(project)
        plan.project = project
        plan.status = AIProjectPlan.STATUS_APPLIED
        plan.applied_at = timezone.now()
        plan.save(update_fields=["project", "status", "applied_at"])
    return project
