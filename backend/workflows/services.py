from django.utils import timezone

from tasks.models import TaskActivity, TaskNotification

from .models import WorkflowRule, WorkflowRun


def rule_matches_task(rule, task, changed_fields):
    if rule.condition_field == WorkflowRule.FIELD_ANY:
        return True
    if rule.condition_field not in changed_fields:
        return False

    actual = getattr(task, rule.condition_field, None)
    expected = rule.condition_value
    if rule.condition_operator == WorkflowRule.OP_EQUALS:
        return str(actual).upper() == str(expected).upper()

    try:
        actual_value = float(actual)
        expected_value = float(expected)
    except (TypeError, ValueError):
        return False

    if rule.condition_operator == WorkflowRule.OP_GTE:
        return actual_value >= expected_value
    if rule.condition_operator == WorkflowRule.OP_LTE:
        return actual_value <= expected_value
    return False


def evaluate_task_update_workflows(task, actor, changed_fields):
    rules = WorkflowRule.objects.filter(
        company=task.company,
        trigger=WorkflowRule.TRIGGER_TASK_UPDATED,
        is_enabled=True,
    )

    for rule in rules:
        if not rule_matches_task(rule, task, changed_fields):
            continue

        execute_rule(rule, task, actor)


def execute_rule(rule, task, actor=None):
    message = rule.action_message.strip() or f"Workflow '{rule.name}' ran for {task.title}"
    try:
        if rule.action == WorkflowRule.ACTION_NOTIFY_ASSIGNEE:
            if task.assigned_to_id != getattr(actor, "id", None):
                TaskNotification.objects.create(recipient=task.assigned_to, task=task, event_type="workflow", message=message)
        elif rule.action == WorkflowRule.ACTION_NOTIFY_CREATOR:
            if task.created_by_id != getattr(actor, "id", None):
                TaskNotification.objects.create(recipient=task.created_by, task=task, event_type="workflow", message=message)
        elif rule.action == WorkflowRule.ACTION_CREATE_ACTIVITY:
            TaskActivity.objects.create(task=task, actor=actor, event_type="workflow", summary=message)
        WorkflowRun.objects.create(rule=rule, task=task, actor=actor, status=WorkflowRun.STATUS_EXECUTED, detail=message)
        return True
    except Exception as error:
        WorkflowRun.objects.create(rule=rule, task=task, actor=actor, status=WorkflowRun.STATUS_FAILED, detail=str(error)[:500])
        return False


def evaluate_task_overdue_workflows(task):
    rules = WorkflowRule.objects.filter(
        company=task.company,
        trigger=WorkflowRule.TRIGGER_TASK_OVERDUE,
        is_enabled=True,
    )
    executed_count = 0
    for rule in rules:
        if not rule_matches_task(rule, task, {WorkflowRule.FIELD_ANY}):
            continue
        already_executed = WorkflowRun.objects.filter(
            rule=rule,
            task=task,
            status=WorkflowRun.STATUS_EXECUTED,
            created_at__date=timezone.localdate(),
        ).exists()
        if not already_executed and execute_rule(rule, task):
            executed_count += 1
    return executed_count
