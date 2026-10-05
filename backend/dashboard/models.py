from django.db import models


class ContactMessage(models.Model):
    SUBJECT_CHOICES = [
        ("pricing", "Pricing and Plans"),
        ("integration", "Integrations and API"),
        ("enterprise", "Enterprise Onboarding"),
        ("support", "Technical Support"),
        ("other", "Other"),
    ]

    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80)
    email = models.EmailField()
    subject = models.CharField(max_length=40, choices=SUBJECT_CHOICES)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} - {self.get_subject_display()}"
