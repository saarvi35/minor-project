# Generated manually for the dynamic workflow engine.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("companies", "0005_alter_company_id_alter_companyuser_id_alter_role_id"),
        ("tasks", "0009_tasknotification"),
    ]

    operations = [
        migrations.CreateModel(
            name="WorkflowRule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("description", models.TextField(blank=True)),
                ("trigger", models.CharField(choices=[("TASK_UPDATED", "Task updated")], default="TASK_UPDATED", max_length=40)),
                ("condition_field", models.CharField(choices=[("ANY", "Any task update"), ("status", "Task status"), ("priority", "Task priority"), ("progress", "Task progress")], default="ANY", max_length=40)),
                ("condition_operator", models.CharField(choices=[("EQUALS", "Equals"), ("GREATER_THAN_OR_EQUAL", "Greater than or equal to"), ("LESS_THAN_OR_EQUAL", "Less than or equal to")], default="EQUALS", max_length=40)),
                ("condition_value", models.CharField(blank=True, max_length=120)),
                ("action", models.CharField(choices=[("NOTIFY_ASSIGNEE", "Notify assignee"), ("NOTIFY_CREATOR", "Notify task creator"), ("CREATE_ACTIVITY", "Add task activity")], max_length=40)),
                ("action_message", models.CharField(blank=True, max_length=300)),
                ("is_enabled", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("company", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="workflow_rules", to="companies.company")),
                ("created_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_workflow_rules", to="companies.companyuser")),
            ],
            options={"ordering": ["-updated_at", "-id"]},
        ),
        migrations.CreateModel(
            name="WorkflowRun",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("EXECUTED", "Executed"), ("SKIPPED", "Skipped"), ("FAILED", "Failed")], max_length=20)),
                ("detail", models.CharField(blank=True, max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="workflow_runs", to="companies.companyuser")),
                ("rule", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="runs", to="workflows.workflowrule")),
                ("task", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="workflow_runs", to="tasks.task")),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
    ]
