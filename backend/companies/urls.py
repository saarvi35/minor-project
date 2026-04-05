from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *

router = DefaultRouter()
router.register(r'companies', CompanyViewSet, basename='companies')
router.register(r'roles', RoleViewSet, basename='roles')

urlpatterns = [
    path('', include(router.urls)),
    path("register/", RegistrationView.as_view()),
    path("create-user/", CreateUserView.as_view()), 
    path("update-user/<int:user_id>/", UpdateUserView.as_view()),
    path("delete-user/<int:user_id>/", DeleteUserView.as_view()),
    path("set-password/<uuid:token>/", SetPasswordView.as_view()), 
    path('current-user/' , CurrentUserView.as_view())
]