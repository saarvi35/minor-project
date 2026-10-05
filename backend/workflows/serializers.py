from rest_framework import serializers

from .models import WorkflowRule, WorkflowRun


class WorkflowRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowRule
        fields = [
            "id", "company", "created_by", "name", "description", "trigger",
            "condition_field", "condition_operator", "condition_value", "action",
            "action_message", "is_enabled", "created_at", "updated_at",
        ]
        read_only_fields = ["company", "created_by", "created_at", "updated_at"]

    def validate(self, data):
        condition_field = data.get("condition_field", getattr(self.instance, "condition_field", None))
        condition_value = data.get("condition_value", getattr(self.instance, "condition_value", ""))
        if condition_field != WorkflowRule.FIELD_ANY and not str(condition_value or "").strip():
            raise serializers.ValidationError({"condition_value": "A condition value is required for this field."})
        return data


class WorkflowRunSerializer(serializers.ModelSerializer):
    rule_name = serializers.CharField(source="rule.name", read_only=True)
    task_title = serializers.CharField(source="task.title", read_only=True)

    class Meta:
        model = WorkflowRun
        fields = ["id", "rule", "rule_name", "task", "task_title", "status", "detail", "created_at"]
        read_only_fields = fields
