from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Task
from projects.services import recalculate_project_progress


@receiver(post_save, sender=Task)
def update_project_progress_on_save(sender, instance, **kwargs):
    if instance.project:
        recalculate_project_progress(instance.project.id)


@receiver(post_delete, sender=Task)
def update_project_progress_on_delete(sender, instance, **kwargs):
    if instance.project:
        recalculate_project_progress(instance.project.id)