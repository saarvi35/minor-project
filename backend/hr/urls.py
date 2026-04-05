from django.urls import path
from .views import (
    MyProfileAPI,
    DepartmentListCreateAPI,
    MyAttendanceAPI,
    UpdateLeaveStatusAPI,
    AddPerformanceReviewAPI,
    HRDashboardAPI
)

urlpatterns = [
    path("profile/", MyProfileAPI.as_view()),
    path("departments/", DepartmentListCreateAPI.as_view()),
    path("attendance/", MyAttendanceAPI.as_view()),
    path("leave/<int:leave_id>/status/", UpdateLeaveStatusAPI.as_view()),
    path("review/<int:employee_id>/", AddPerformanceReviewAPI.as_view()),
    path('hr-dashboard/' , HRDashboardAPI.as_view()),
]