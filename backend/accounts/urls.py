from django.urls import path
from .views import *
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenRefreshView


class PublicTokenRefreshView(TokenRefreshView):
    authentication_classes = []
    permission_classes = [AllowAny]
urlpatterns = [
    
    path("login/", LoginView.as_view()),
    path("google-login/", GoogleLoginView.as_view()),
    path("token/refresh/", PublicTokenRefreshView.as_view(), name="token-refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("attendance/checkin/", MarkAttendanceAPI.as_view()),
    path("attendance/checkout/", CheckoutAttendanceAPI.as_view()),
    path("leave/apply/", ApplyLeaveAPI.as_view()),
    
]
