from django.db.models import Avg

from .models import TaskNotification


def sync_project_progress(project):
    """Keep a project's visible progress derived from its current tasks."""
    if not project:
        return

    average_progress = project.tasks.aggregate(value=Avg("progress"))["value"]
    project.progress = round(average_progress or 0)
    project.save(update_fields=["progress"])


def notify_task_members(task, actor, event_type, message):
    """Notify relevant collaborators except the member who caused the event."""
    recipients = {task.assigned_to_id, task.created_by_id}
    recipients.discard(None)
    recipients.discard(getattr(actor, "id", None))
    TaskNotification.objects.bulk_create(
        [
            TaskNotification(
                recipient_id=recipient_id,
                task=task,
                event_type=event_type,
                message=message,
            )
            for recipient_id in recipients
        ]
    )
