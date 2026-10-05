from celery import shared_task
from django.utils import timezone

from tasks.models import Task

from .services import evaluate_task_overdue_workflows


@shared_task
def run_sla_watchdog():
    """Evaluate overdue active tasks once per hour; each rule runs at most once per task per day."""
    overdue_tasks = Task.objects.filter(
        due_date__lt=timezone.localdate(),
        status__in=["PENDING", "IN_PROGRESS"],
    ).select_related("company", "assigned_to", "created_by")
    return sum(evaluate_task_overdue_workflows(task) for task in overdue_tasks)
