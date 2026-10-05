from django.urls import path

from .views import (
    AIAnalyticsSummaryAPI,
    DelayPredictionAPI,
    EscalationInsightsAPI,
    SmartTaskPrioritizationAPI,
    WorkloadBalancingAPI,
)


urlpatterns = [
    path("ai/delay-predictions/", DelayPredictionAPI.as_view()),
    path("ai/escalations/", EscalationInsightsAPI.as_view()),
    path("ai/analytics-summary/", AIAnalyticsSummaryAPI.as_view()),
    path("ai/task-priorities/", SmartTaskPrioritizationAPI.as_view()),
    path("ai/workload-balancing/", WorkloadBalancingAPI.as_view()),
]
