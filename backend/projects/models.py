from django.db import models

class Project(models.Model):

    STATUS_CHOICES = [
        ("ACTIVE", "Active"),
        ("COMPLETED", "Completed"),
        ("ON_HOLD", "On Hold"),
    ]

    PRIORITY_CHOICES = [
        ("LOW", "Low"),
        ("MEDIUM", "Medium"),
        ("HIGH", "High"),
        ("CRITICAL", "Critical"),
    ]

    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="projects"
    )

    client = models.ForeignKey(
        "companies.CompanyUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="client_projects"
    )

    manager = models.ForeignKey(
    "companies.CompanyUser",
    on_delete=models.SET_NULL,
    null=True,
    related_name="managed_projects"
)

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ACTIVE")
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default="MEDIUM")

    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)

    budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    actual_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    progress = models.IntegerField(default=0)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

