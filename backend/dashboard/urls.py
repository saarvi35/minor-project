from django.urls import path
from .views import *

urlpatterns = [
    path("overview/", DashboardOverviewAPI.as_view()),
    path("my-tasks/", MyTasksAPI.as_view()),
    path("my-projects/", MyProjectsAPI.as_view()),
    path("users/", UserListAPI.as_view()),
    path("my-leaves/", MyLeaveListAPI.as_view()),
    path("all-tasks/"  ,AllTasksAPI.as_view()),
    path("task-analytics/" , TaskAnalyticsAPI.as_view()),
    path("team-leaves/" , TeamLeaveListAPI.as_view()),
    path("all-projects/" , AllProjectsAPI.as_view()),
    path("client-projects/" , ClientProjectsProgressAPI.as_view()),
    path("manager-projects/", ManagerProjectsAPI.as_view()),
    path("manager-overview/" , ManagerOverviewAPI.as_view()),
]