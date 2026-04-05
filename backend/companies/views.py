from rest_framework import viewsets,status
from .models import Company,CompanyUser,Role
from .serializers import *
from rest_framework.permissions import IsAuthenticated , AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.mail import send_mail
from rest_framework.viewsets import ModelViewSet
from rest_framework.exceptions import PermissionDenied
from companies.utils import get_company_user , get_permission_dict
from dashboard.serializers import UserSerializer
from django.core.mail import send_mail
from django.conf import settings

from threading import Thread
from .serializers import CreateUserSerializer

#REGISTRATION view
class RegistrationView(APIView):

    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    "success": True,
                    "message": "Company and Admin registered successfully."
                },
                status=status.HTTP_201_CREATED
            )

        return Response(
            {
                "success": False,
                "errors": serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST
        )

#for company
class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer


# CREATE USER & SEND INVITE


class CreateUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreateUserSerializer(
            data=request.data,
            context={"request": request}
        )

        if serializer.is_valid():
            company_user = serializer.save()

            # 🔹 Determine recipient email
            recipient_email = company_user.user.email if company_user.user else company_user.email
            if not recipient_email:
                return Response({"error": "User has no email"}, status=400)

            # 🔹 Invite link
            base_url = settings.FRONTEND_BASE_URL.rstrip("/")
            invite_link = f"{base_url}/set-password/{company_user.invite_token}"

            # 🔹 Function to send email in background
            def send_invite_email():
                send_mail(
                    subject="You're invited to join Our Platform",
                    message=f"Hello,\n\nYou have been invited to join the company.\nPlease set your password using this link:\n{invite_link}\n\nThank you!",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[recipient_email],
                    fail_silently=False
                )

            # 🔹 Start email in a separate thread
            Thread(target=send_invite_email).start()

            return Response({
                "success": True,
                "message": "Invite sent successfully",
                "invite_token": str(company_user.invite_token)
            }, status=201)

        return Response(serializer.errors, status=400)
# update user
class UpdateUserView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, user_id):

        company_user = get_company_user(request.user)
        permissions = get_permission_dict(company_user.role)

        if not permissions.get("can_manage_users"):
            raise PermissionDenied("Permission denied")

        try:
            user = CompanyUser.objects.get(
                id=user_id,
                company=company_user.company
            )
        except CompanyUser.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        name = request.data.get("name")
        role_id = request.data.get("role")
        status_val = request.data.get("status")

        if name:
            user.name = name

        if role_id:
            try:
                role = Role.objects.get(
                    id=role_id,
                    company=company_user.company
                )
                user.role = role
            except Role.DoesNotExist:
                return Response({"error": "Invalid role"}, status=400)

        if status_val:
            user.status = status_val

        user.save()

        serializer = UserSerializer(user)
        return Response(serializer.data)

# delete user
class DeleteUserView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id):

        company_user = get_company_user(request.user)
        permissions = get_permission_dict(company_user.role)

        if not permissions.get("can_manage_users"):
            raise PermissionDenied("Permission denied")

        try:
            user = CompanyUser.objects.get(
                id=user_id,
                company=company_user.company
            )
        except CompanyUser.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        # hierarchy protection
        if user.role.level >= company_user.role.level:
            raise PermissionDenied(
                "Cannot delete user with equal or higher role"
            )

        user.delete()

        return Response({
            "success": True,
            "message": "User deleted successfully"
        })

# SET PASSWORD VIEW
class SetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, token):
        serializer = SetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        #  Validate invite token
        try:
            company_user = CompanyUser.objects.get(invite_token=token)
        except CompanyUser.DoesNotExist:
            return Response({"error": "Invalid or expired link"}, status=400)

        #  Set user password and activate account
        user = company_user.user
        user.set_password(serializer.validated_data["password"])
        user.is_active = True
        user.save()

        # Update company user record
        company_user.status = "ACTIVE"
        company_user.invite_token = None  # prevent reuse
        company_user.save()

        return Response({"message": "Password set successfully"}, status=200)


class RoleViewSet(ModelViewSet):

    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company_user = get_company_user(self.request.user)

        if not company_user:
            return Role.objects.none()

        return Role.objects.filter(company=company_user.company)

    # CREATE ROLE
    def perform_create(self, serializer):

        company_user = get_company_user(self.request.user)

        if not company_user.role.can_manage_roles:
            raise PermissionDenied("You cannot create roles")

        new_role = serializer.save(company=company_user.company)

        if new_role.level >= company_user.role.level:
            new_role.delete()
            raise PermissionDenied(
                "Cannot create role equal or higher than your authority"
            )

    # UPDATE ROLE
    def perform_update(self, serializer):

        company_user = get_company_user(self.request.user)
        role = self.get_object()

        if not company_user.role.can_manage_roles:
            raise PermissionDenied("You cannot update roles")

        if role.level >= company_user.role.level:
            raise PermissionDenied(
                "Cannot update role equal or higher than your authority"
            )

        serializer.save()

    # DELETE ROLE
    def perform_destroy(self, instance):

        company_user = get_company_user(self.request.user)

        if not company_user.role.can_manage_roles:
            raise PermissionDenied("You cannot delete roles")

        if instance.level >= company_user.role.level:
            raise PermissionDenied(
                "Cannot delete role equal or higher than your authority"
            )

        instance.delete()

#CURRENT view
class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user = get_company_user(request.user)

        if not company_user:
            return Response({"error": "Not linked to company"}, status=403)

        serializer = CurrentUserSerializer(company_user)
        return Response(serializer.data)