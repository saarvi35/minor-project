from django.db import models
from companies.models import Company,CompanyUser
from django.core.validators import MaxValueValidator

class Task(models.Model):

    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
    )

    PRIORITY_CHOICES = (
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
    )

    title = models.CharField(max_length=255)
    description = models.TextField()

    assigned_to = models.ForeignKey(
    CompanyUser,
    on_delete=models.CASCADE,
    related_name='assigned_tasks'
)

    created_by = models.ForeignKey(
        CompanyUser,
        on_delete=models.CASCADE,
        related_name="created_tasks"
    )

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )

    priority = models.CharField(
        max_length=10,
        choices=PRIORITY_CHOICES,
        default='MEDIUM'
    )

    due_date = models.DateField(null=True, blank=True)

    attachment = models.FileField(
        upload_to='task_files/',
        null=True,
        blank=True
    )

    image = models.ImageField(
        upload_to='task_images/',
        null=True,
        blank=True
    )

    reference_link = models.URLField(
        max_length=500,
        null=True,
        blank=True
    )

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.SET_NULL,
        related_name="tasks",
        null=True,
        blank=True
    )

    progress = models.PositiveSmallIntegerField(
    default=0,
    validators=[MaxValueValidator(100)]
)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class TaskComment(models.Model):
    """A tenant-scoped discussion entry for a task."""

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(CompanyUser, on_delete=models.CASCADE, related_name="task_comments")
    body = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"Comment on task #{self.task_id}"


class TaskActivity(models.Model):
    """An immutable, user-visible audit trail for collaboration events."""

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="activities")
    actor = models.ForeignKey(
        CompanyUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="task_activities",
    )
    event_type = models.CharField(max_length=50)
    summary = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.summary


class TaskNotification(models.Model):
    """An in-app alert that always belongs to one member of one tenant."""

    recipient = models.ForeignKey(
        CompanyUser,
        on_delete=models.CASCADE,
        related_name="task_notifications",
    )
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="notifications")
    event_type = models.CharField(max_length=50)
    message = models.CharField(max_length=500)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["recipient", "is_read", "created_at"])]

    def __str__(self):
        return self.message
