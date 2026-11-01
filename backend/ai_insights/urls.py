from django.urls import path

from .views import (
    AIAnalyticsSummaryAPI,
    DelayPredictionAPI,
    EscalationInsightsAPI,
    SmartTaskPrioritizationAPI,
    WorkloadBalancingAPI,
    AICopilotStatusAPI,
    AIProjectPlanAPI,
    AIProjectPlanApplyAPI,
)


urlpatterns = [
    path("ai/copilot/status/", AICopilotStatusAPI.as_view()),
    path("ai/copilot/plans/", AIProjectPlanAPI.as_view()),
    path("ai/copilot/plans/<int:plan_id>/apply/", AIProjectPlanApplyAPI.as_view()),
    path("ai/delay-predictions/", DelayPredictionAPI.as_view()),
    path("ai/escalations/", EscalationInsightsAPI.as_view()),
    path("ai/analytics-summary/", AIAnalyticsSummaryAPI.as_view()),
    path("ai/task-priorities/", SmartTaskPrioritizationAPI.as_view()),
    path("ai/workload-balancing/", WorkloadBalancingAPI.as_view()),
]
