from django.db import models


class AIProjectPlan(models.Model):
    """A reviewable generative plan isolated to one company tenant."""

    STATUS_DRAFT = "DRAFT"
    STATUS_APPLIED = "APPLIED"
    STATUS_CHOICES = [(STATUS_DRAFT, "Draft"), (STATUS_APPLIED, "Applied")]

    company = models.ForeignKey("companies.Company", on_delete=models.CASCADE, related_name="ai_project_plans")
    created_by = models.ForeignKey("companies.CompanyUser", on_delete=models.SET_NULL, null=True, related_name="ai_project_plans")
    project = models.ForeignKey("projects.Project", on_delete=models.SET_NULL, null=True, blank=True, related_name="ai_project_plans")
    title = models.CharField(max_length=180)
    brief = models.TextField()
    plan = models.JSONField(default=dict)
    provider = models.CharField(max_length=60, default="gemini")
    model_name = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    applied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.title
