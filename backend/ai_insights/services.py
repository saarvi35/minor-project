from collections import Counter
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from companies.models import CompanyUser
from companies.utils import get_permission_dict
from hr.models import Attendance, LeaveRequest
from projects.models import Project
from tasks.models import Task


ACTIVE_TASK_STATUSES = ["PENDING", "IN_PROGRESS"]
PRIORITY_WEIGHTS = {
    "LOW": 5,
    "MEDIUM": 12,
    "HIGH": 22,
    "CRITICAL": 28,
}


def company_user_display_name(company_user):
    if not company_user:
        return None
    if company_user.name:
        return company_user.name
    user = getattr(company_user, "user", None)
    if user:
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.email or user.username
    return company_user.email or f"User #{company_user.id}"


def accessible_tasks_for(company_user):
    permissions = get_permission_dict(company_user.role)
    tasks = Task.objects.filter(company=company_user.company)

    if permissions.get("can_view_all_tasks") or permissions.get("can_manage_company"):
        return tasks

    if permissions.get("can_view_team_tasks"):
        return tasks.filter(
            Q(project__manager=company_user)
            | Q(project__isnull=True, created_by=company_user)
        ).distinct()

    if permissions.get("can_view_assigned_tasks"):
        return tasks.filter(assigned_to=company_user)

    return Task.objects.none()


def accessible_projects_for(company_user):
    tasks = accessible_tasks_for(company_user)
    project_ids = tasks.exclude(project__isnull=True).values_list("project_id", flat=True)
    projects = Project.objects.filter(company=company_user.company)

    permissions = get_permission_dict(company_user.role)
    if permissions.get("can_view_all_tasks") or permissions.get("can_manage_company"):
        return projects

    if permissions.get("can_view_team_tasks"):
        return projects.filter(Q(manager=company_user) | Q(id__in=project_ids)).distinct()

    return projects.filter(id__in=project_ids).distinct()


def active_workload_counts(company):
    return dict(
        Task.objects.filter(company=company, status__in=ACTIVE_TASK_STATUSES)
        .values("assigned_to_id")
        .annotate(total=Count("id"))
        .values_list("assigned_to_id", "total")
    )


def upcoming_leave_counts(company, start_date=None, end_date=None):
    today = timezone.now().date()
    start_date = start_date or today
    end_date = end_date or today + timedelta(days=14)

    leave_counter = Counter()
    leaves = LeaveRequest.objects.filter(
        company_user__company=company,
        status__in=["PENDING", "APPROVED"],
        start_date__lte=end_date,
        end_date__gte=start_date,
    ).values("company_user_id", "status")

    for leave in leaves:
        leave_counter[leave["company_user_id"]] += 2 if leave["status"] == "APPROVED" else 1

    return leave_counter


def recent_absence_counts(company, days=14):
    since = timezone.now().date() - timedelta(days=days)
    return dict(
        Attendance.objects.filter(
            company_user__company=company,
            date__gte=since,
            status__in=["ABSENT", "HALF_DAY"],
        )
        .values("company_user_id")
        .annotate(total=Count("id"))
        .values_list("company_user_id", "total")
    )


def score_to_level(score):
    if score >= 75:
        return "critical"
    if score >= 55:
        return "high"
    if score >= 35:
        return "medium"
    return "low"


def task_delay_prediction(task, workload_counts=None, leave_counts=None, absence_counts=None):
    today = timezone.now().date()
    workload_counts = workload_counts or {}
    leave_counts = leave_counts or {}
    absence_counts = absence_counts or {}

    score = 0
    reasons = []
    signals = {}

    priority_score = PRIORITY_WEIGHTS.get(task.priority, 12)
    score += priority_score
    signals["priority_weight"] = priority_score

    if task.due_date:
        days_until_due = (task.due_date - today).days
        signals["days_until_due"] = days_until_due

        if task.status in ACTIVE_TASK_STATUSES and days_until_due < 0:
            overdue_points = min(35, abs(days_until_due) * 4 + 15)
            score += overdue_points
            reasons.append(f"task is overdue by {abs(days_until_due)} day(s)")
        elif task.status in ACTIVE_TASK_STATUSES and days_until_due <= 2:
            score += 22
            reasons.append("due date is very close")
        elif task.status in ACTIVE_TASK_STATUSES and days_until_due <= 7:
            score += 12
            reasons.append("due date is within a week")

    if task.status == "PENDING":
        score += 12
        reasons.append("work has not started")
    elif task.status == "IN_PROGRESS" and task.progress < 40:
        score += 10
        reasons.append("progress is low for an in-progress task")

    if task.progress < 25 and task.status in ACTIVE_TASK_STATUSES:
        score += 8
        reasons.append("completion percentage is still low")
    elif task.progress >= 80:
        score -= 12
        reasons.append("task is close to completion")

    assigned_to_id = getattr(task, "assigned_to_id", None)
    workload = workload_counts.get(assigned_to_id, 0)
    signals["assignee_active_tasks"] = workload
    if workload >= 8:
        score += 14
        reasons.append(f"assignee has {workload} active tasks")
    elif workload >= 5:
        score += 8
        reasons.append(f"assignee has {workload} active tasks")

    leave_count = leave_counts.get(assigned_to_id, 0)
    signals["upcoming_leave_signals"] = leave_count
    if leave_count:
        score += min(14, leave_count * 5)
        reasons.append("assignee has upcoming approved or pending leave")

    absence_count = absence_counts.get(assigned_to_id, 0)
    signals["recent_absence_count"] = absence_count
    if absence_count:
        score += min(10, absence_count * 3)
        reasons.append("recent attendance records may affect availability")

    project = getattr(task, "project", None)
    if project:
        project_points, project_reasons = project_health_risk(project, concise=True)
        score += min(15, project_points // 4)
        reasons.extend(project_reasons[:2])

    if task.status == "COMPLETED":
        score = 0
        reasons = ["task is already completed"]

    score = max(0, min(100, int(score)))
    probability = round(score / 100, 2)

    return {
        "task_id": task.id,
        "title": task.title,
        "status": task.status,
        "priority": task.priority,
        "progress": task.progress,
        "due_date": task.due_date,
        "assigned_to": task.assigned_to_id,
        "assigned_to_name": company_user_display_name(getattr(task, "assigned_to", None)),
        "project_id": task.project_id,
        "risk_score": score,
        "risk_level": score_to_level(score),
        "delay_probability": probability,
        "expected_delay_days": expected_delay_days(score, task),
        "reasons": reasons or ["no major delay signals detected"],
        "signals": signals,
    }


def expected_delay_days(score, task):
    if task.status == "COMPLETED":
        return 0
    if score >= 80:
        return 7
    if score >= 65:
        return 4
    if score >= 45:
        return 2
    if task.due_date and task.due_date < timezone.now().date():
        return 1
    return 0


def project_health_risk(project, concise=False):
    today = timezone.now().date()
    score = 0
    reasons = []

    if project.priority in ["HIGH", "CRITICAL"]:
        score += PRIORITY_WEIGHTS.get(project.priority, 22)
        reasons.append(f"project priority is {project.priority.lower()}")

    if project.end_date:
        total_days = max(1, (project.end_date - project.start_date).days)
        elapsed_days = max(0, (today - project.start_date).days)
        expected_progress = min(100, int((elapsed_days / total_days) * 100))
        progress_gap = expected_progress - project.progress

        if project.status != "COMPLETED" and project.end_date < today:
            score += 35
            reasons.append("project deadline has passed")
        elif progress_gap >= 30:
            score += 24
            reasons.append("progress is far behind the timeline")
        elif progress_gap >= 15:
            score += 14
            reasons.append("progress is behind the timeline")

    if project.budget and project.actual_cost:
        budget = float(project.budget)
        actual = float(project.actual_cost)
        if budget > 0:
            burn_ratio = actual / budget
            if burn_ratio >= 1 and project.progress < 100:
                score += 22
                reasons.append("budget is fully consumed before completion")
            elif burn_ratio >= 0.8 and project.progress < 70:
                score += 12
                reasons.append("budget burn is high compared with progress")

    active_tasks = project.tasks.filter(status__in=ACTIVE_TASK_STATUSES)
    overdue_count = active_tasks.filter(due_date__lt=today).count()
    high_priority_count = active_tasks.filter(priority="HIGH").count()

    if overdue_count:
        score += min(25, overdue_count * 5)
        reasons.append(f"{overdue_count} active task(s) are overdue")

    if high_priority_count:
        score += min(12, high_priority_count * 3)
        reasons.append(f"{high_priority_count} high-priority active task(s)")

    if project.status == "COMPLETED":
        score = 0
        reasons = ["project is completed"]

    if concise:
        return max(0, min(100, int(score))), reasons

    return {
        "project_id": project.id,
        "name": project.name,
        "status": project.status,
        "priority": project.priority,
        "progress": project.progress,
        "end_date": project.end_date,
        "risk_score": max(0, min(100, int(score))),
        "risk_level": score_to_level(score),
        "miss_deadline_probability": round(max(0, min(100, int(score))) / 100, 2),
        "reasons": reasons or ["no major project risk signals detected"],
    }


def build_delay_predictions(company_user):
    tasks = accessible_tasks_for(company_user).select_related("assigned_to", "project")
    projects = accessible_projects_for(company_user)
    workload = active_workload_counts(company_user.company)
    leaves = upcoming_leave_counts(company_user.company)
    absences = recent_absence_counts(company_user.company)

    task_predictions = [
        task_delay_prediction(task, workload, leaves, absences)
        for task in tasks.exclude(status="COMPLETED")
    ]
    task_predictions.sort(key=lambda item: item["risk_score"], reverse=True)

    project_predictions = [project_health_risk(project) for project in projects]
    project_predictions.sort(key=lambda item: item["risk_score"], reverse=True)

    critical_tasks = sum(1 for item in task_predictions if item["risk_level"] == "critical")
    high_tasks = sum(1 for item in task_predictions if item["risk_level"] == "high")

    return {
        "summary": {
            "total_active_tasks_scored": len(task_predictions),
            "critical_tasks": critical_tasks,
            "high_risk_tasks": high_tasks,
            "projects_scored": len(project_predictions),
        },
        "task_predictions": task_predictions,
        "project_predictions": project_predictions,
    }


def build_escalations(company_user):
    predictions = build_delay_predictions(company_user)
    escalations = []

    for prediction in predictions["task_predictions"]:
        if prediction["risk_score"] < 55:
            continue

        notify = ["assigned_to"]
        if prediction.get("project_id"):
            notify.append("project_manager")
        if prediction["risk_score"] >= 75:
            notify.append("company_owner")

        escalations.append(
            {
                "type": "task",
                "severity": prediction["risk_level"],
                "risk_score": prediction["risk_score"],
                "task_id": prediction["task_id"],
                "title": prediction["title"],
                "suggested_notify": notify,
                "summary": escalation_summary(prediction),
                "reasons": prediction["reasons"],
            }
        )

    for prediction in predictions["project_predictions"]:
        if prediction["risk_score"] < 60:
            continue

        escalations.append(
            {
                "type": "project",
                "severity": prediction["risk_level"],
                "risk_score": prediction["risk_score"],
                "project_id": prediction["project_id"],
                "name": prediction["name"],
                "suggested_notify": ["project_manager", "company_owner"],
                "summary": (
                    f"{prediction['name']} needs review because "
                    f"{'; '.join(prediction['reasons'][:3])}."
                ),
                "reasons": prediction["reasons"],
            }
        )

    escalations.sort(key=lambda item: item["risk_score"], reverse=True)
    return {"total": len(escalations), "escalations": escalations}


def escalation_summary(prediction):
    reasons = "; ".join(prediction["reasons"][:3])
    return (
        f"{prediction['title']} is {prediction['risk_level']} risk "
        f"with a {int(prediction['delay_probability'] * 100)}% delay probability "
        f"because {reasons}."
    )


def build_ai_analytics_summary(company_user):
    tasks = accessible_tasks_for(company_user)
    projects = accessible_projects_for(company_user)
    predictions = build_delay_predictions(company_user)

    total_tasks = tasks.count()
    active_tasks = tasks.filter(status__in=ACTIVE_TASK_STATUSES).count()
    completed_tasks = tasks.filter(status="COMPLETED").count()
    overdue_tasks = tasks.filter(
        status__in=ACTIVE_TASK_STATUSES,
        due_date__lt=timezone.now().date(),
    ).count()

    top_risks = predictions["task_predictions"][:5]
    project_risks = predictions["project_predictions"][:3]

    insights = []
    if overdue_tasks:
        insights.append(f"{overdue_tasks} active task(s) are overdue and need attention.")
    if top_risks:
        insights.append(
            f"{top_risks[0]['title']} is the highest-risk task at "
            f"{top_risks[0]['risk_score']} risk score."
        )
    if project_risks and project_risks[0]["risk_score"] >= 55:
        insights.append(
            f"{project_risks[0]['name']} is the project most likely to slip."
        )
    if not insights:
        insights.append("No major delivery risks were detected in the current scope.")

    completion_rate = round((completed_tasks / total_tasks) * 100, 2) if total_tasks else 0

    return {
        "metrics": {
            "total_tasks": total_tasks,
            "active_tasks": active_tasks,
            "completed_tasks": completed_tasks,
            "completion_rate": completion_rate,
            "overdue_tasks": overdue_tasks,
            "total_projects": projects.count(),
        },
        "insights": insights,
        "manager_focus": [
            item for item in [
                "Review overdue high-priority work" if overdue_tasks else None,
                "Rebalance work from overloaded employees" if overloaded_users(company_user.company) else None,
                "Escalate critical-risk tasks today" if predictions["summary"]["critical_tasks"] else None,
            ] if item
        ],
        "top_task_risks": top_risks,
        "top_project_risks": project_risks,
    }


def overloaded_users(company):
    workload = active_workload_counts(company)
    return [user_id for user_id, count in workload.items() if count >= 8]


def build_task_priorities(company_user, project_id=None, limit=20):
    tasks = accessible_tasks_for(company_user).select_related("assigned_to", "project")
    if project_id:
        tasks = tasks.filter(project_id=project_id)

    workload = active_workload_counts(company_user.company)
    leaves = upcoming_leave_counts(company_user.company)
    absences = recent_absence_counts(company_user.company)
    ranked = [
        task_delay_prediction(task, workload, leaves, absences)
        for task in tasks.filter(status__in=ACTIVE_TASK_STATUSES)
    ]

    ranked.sort(key=lambda item: item["risk_score"], reverse=True)
    return {
        "total": len(ranked),
        "recommended_order": ranked[:limit],
    }


def build_workload_balancing(company_user, project_id=None, priority="MEDIUM"):
    company = company_user.company
    candidates = CompanyUser.objects.select_related("role", "user").filter(
        company=company,
        status="ACTIVE",
        role__level__gte=40,
        role__level__lt=70,
    )

    workload = active_workload_counts(company)
    leaves = upcoming_leave_counts(company)
    absences = recent_absence_counts(company)
    recommendations = []

    for user in candidates:
        active_count = workload.get(user.id, 0)
        leave_signal = leaves.get(user.id, 0)
        absence_count = absences.get(user.id, 0)
        capacity_score = 100 - (active_count * 10) - (leave_signal * 8) - (absence_count * 5)

        if priority in ["HIGH", "CRITICAL"] and active_count >= 6:
            capacity_score -= 10

        recommendations.append(
            {
                "company_user_id": user.id,
                "name": company_user_display_name(user),
                "role": getattr(user.role, "name", None),
                "active_tasks": active_count,
                "upcoming_leave_signals": leave_signal,
                "recent_absence_count": absence_count,
                "capacity_score": max(0, min(100, int(capacity_score))),
                "recommendation": workload_recommendation_text(active_count, leave_signal, absence_count),
            }
        )

    recommendations.sort(key=lambda item: item["capacity_score"], reverse=True)

    return {
        "project_id": project_id,
        "priority": priority,
        "recommended_assignees": recommendations,
    }


def workload_recommendation_text(active_count, leave_signal, absence_count):
    if leave_signal:
        return "Avoid assigning urgent work because upcoming leave may reduce availability."
    if active_count >= 8:
        return "Overloaded; use only for work they already own."
    if active_count >= 5:
        return "Moderate load; suitable for smaller tasks."
    if absence_count:
        return "Available, but recent attendance signals should be checked."
    return "Good candidate for the next task."
