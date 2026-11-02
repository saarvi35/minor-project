from rest_framework.routers import DefaultRouter
from django.urls import path
from .messaging import ProjectMessageAttachmentAPI, ProjectMessagesAPI
from .views import ProjectViewSet

router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='projects')

urlpatterns = [
    path("projects/<int:project_id>/messages/", ProjectMessagesAPI.as_view()),
    path("projects/<int:project_id>/messages/<int:message_id>/attachment/", ProjectMessageAttachmentAPI.as_view()),
] + router.urls
