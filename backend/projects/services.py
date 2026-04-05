from tasks.models import Task
from .models import Project

def recalculate_project_progress(project_id):
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return

    tasks = Task.objects.filter(project=project)
    total_tasks = tasks.count()

    if total_tasks == 0:
        project.progress = 0
    else:
        completed_tasks = tasks.filter(status="COMPLETED").count()
        project.progress = round((completed_tasks / total_tasks) * 100)

    # ⭐ Bonus logic yahan add karna hai
    if project.progress == 100:
        project.status = "COMPLETED"

    project.save(update_fields=["progress", "status"])