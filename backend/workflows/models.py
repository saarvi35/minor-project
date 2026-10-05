from django.db import models


class WorkflowRule(models.Model):
    TRIGGER_TASK_UPDATED = "TASK_UPDATED"
    TRIGGER_TASK_OVERDUE = "TASK_OVERDUE"
    TRIGGER_CHOICES = [
        (TRIGGER_TASK_UPDATED, "Task updated"),
        (TRIGGER_TASK_OVERDUE, "Task overdue"),
    ]

    FIELD_ANY = "ANY"
    FIELD_STATUS = "status"
    FIELD_PRIORITY = "priority"
    FIELD_PROGRESS = "progress"
    CONDITION_FIELD_CHOICES = [
        (FIELD_ANY, "Any task update"),
        (FIELD_STATUS, "Task status"),
        (FIELD_PRIORITY, "Task priority"),
        (FIELD_PROGRESS, "Task progress"),
    ]

    OP_EQUALS = "EQUALS"
    OP_GTE = "GREATER_THAN_OR_EQUAL"
    OP_LTE = "LESS_THAN_OR_EQUAL"
    OPERATOR_CHOICES = [
        (OP_EQUALS, "Equals"),
        (OP_GTE, "Greater than or equal to"),
        (OP_LTE, "Less than or equal to"),
    ]

    ACTION_NOTIFY_ASSIGNEE = "NOTIFY_ASSIGNEE"
    ACTION_NOTIFY_CREATOR = "NOTIFY_CREATOR"
    ACTION_CREATE_ACTIVITY = "CREATE_ACTIVITY"
    ACTION_CHOICES = [
        (ACTION_NOTIFY_ASSIGNEE, "Notify assignee"),
        (ACTION_NOTIFY_CREATOR, "Notify task creator"),
        (ACTION_CREATE_ACTIVITY, "Add task activity"),
    ]

    company = models.ForeignKey("companies.Company", on_delete=models.CASCADE, related_name="workflow_rules")
    created_by = models.ForeignKey("companies.CompanyUser", on_delete=models.SET_NULL, null=True, related_name="created_workflow_rules")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    trigger = models.CharField(max_length=40, choices=TRIGGER_CHOICES, default=TRIGGER_TASK_UPDATED)
    condition_field = models.CharField(max_length=40, choices=CONDITION_FIELD_CHOICES, default=FIELD_ANY)
    condition_operator = models.CharField(max_length=40, choices=OPERATOR_CHOICES, default=OP_EQUALS)
    condition_value = models.CharField(max_length=120, blank=True)
    action = models.CharField(max_length=40, choices=ACTION_CHOICES)
    action_message = models.CharField(max_length=300, blank=True)
    is_enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]

    def __str__(self):
        return self.name


class WorkflowRun(models.Model):
    STATUS_EXECUTED = "EXECUTED"
    STATUS_SKIPPED = "SKIPPED"
    STATUS_FAILED = "FAILED"
    STATUS_CHOICES = [
        (STATUS_EXECUTED, "Executed"),
        (STATUS_SKIPPED, "Skipped"),
        (STATUS_FAILED, "Failed"),
    ]

    rule = models.ForeignKey(WorkflowRule, on_delete=models.CASCADE, related_name="runs")
    task = models.ForeignKey("tasks.Task", on_delete=models.CASCADE, related_name="workflow_runs")
    actor = models.ForeignKey("companies.CompanyUser", on_delete=models.SET_NULL, null=True, blank=True, related_name="workflow_runs")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    detail = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
