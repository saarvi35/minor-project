# Generated manually for in-app task notifications.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("companies", "0005_alter_company_id_alter_companyuser_id_alter_role_id"),
        ("tasks", "0008_task_collaboration"),
    ]

    operations = [
        migrations.CreateModel(
            name="TaskNotification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_type", models.CharField(max_length=50)),
                ("message", models.CharField(max_length=500)),
                ("is_read", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("recipient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="task_notifications", to="companies.companyuser")),
                ("task", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to="tasks.task")),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
        migrations.AddIndex(
            model_name="tasknotification",
            index=models.Index(fields=["recipient", "is_read", "created_at"], name="tasks_taskn_recipie_c9ca52_idx"),
        ),
    ]
