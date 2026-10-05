from rest_framework import serializers


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
