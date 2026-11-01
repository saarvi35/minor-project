from rest_framework import serializers


class AIProjectPlanRequestSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=180)
    brief = serializers.CharField(min_length=40, max_length=12000)


class TaskPrioritizationSerializer(serializers.Serializer):
    project_id = serializers.IntegerField(required=False)
    limit = serializers.IntegerField(required=False, min_value=1, max_value=100, default=20)


class WorkloadRecommendationSerializer(serializers.Serializer):
    project_id = serializers.IntegerField(required=False)
    priority = serializers.ChoiceField(
        choices=["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        required=False,
        default="MEDIUM",
    )
