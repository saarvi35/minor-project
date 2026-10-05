from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import WorkflowRuleViewSet

router = DefaultRouter()
router.register(r"workflows", WorkflowRuleViewSet, basename="workflows")

urlpatterns = [path("", include(router.urls))]
