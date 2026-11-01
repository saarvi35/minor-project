import io
from smtplib import SMTPException
from urllib.parse import quote
from urllib.error import HTTPError, URLError
from urllib.request import urlopen
from django.http import HttpResponse
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets,status
from .models import Company,CompanyUser,Role
from .serializers import *
from rest_framework.permissions import IsAuthenticated , AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.mail import send_mail
from rest_framework.viewsets import ModelViewSet
from rest_framework.exceptions import MethodNotAllowed, PermissionDenied, ValidationError
from companies.utils import get_company_user , get_permission_dict
from dashboard.serializers import UserSerializer
from django.core.mail import send_mail
from django.conf import settings

from .serializers import CreateUserSerializer
from .onboarding import import_workbook, read_workbook, validate_rows
from .invitations import send_invitation
from .permissions import (
    current_company_user,
    ensure_manageable_member,
    ensure_role_permissions_within_authority,
    require_company_management,
    require_permission,
)

#REGISTRATION view
class RegistrationView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "registration"

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


def owner_for_onboarding(request):
    company_user = get_company_user(request.user)
    if not company_user or not get_permission_dict(company_user.role).get("can_manage_company"):
        raise PermissionDenied("Only company owners can set up company data.")
    return company_user


class CompanyOnboardingTemplateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        owner_for_onboarding(request)
        try:
            from openpyxl import Workbook
        except ImportError:
            return Response({"error": "Excel support is not installed on this server."}, status=503)
        workbook = Workbook()
        employees = workbook.active
        employees.title = "Employees"
        employees.append(["name", "email", "role", "department", "designation", "status"])
        employees.append(["Aarav Kumar", "aarav@company.com", "EMPLOYEE", "Engineering", "Software Engineer", "INVITED"])
        projects = workbook.create_sheet("Projects")
        projects.append(["name", "description", "manager_email", "client_email", "priority", "status", "start_date", "end_date", "budget", "actual_cost"])
        projects.append(["Website Refresh", "Public website redesign", "manager@company.com", "client@company.com", "HIGH", "ACTIVE", "2026-10-01", "2026-12-15", "120000", "35000"])
        tasks = workbook.create_sheet("Tasks")
        tasks.append(["title", "description", "project_name", "assigned_to_email", "priority", "status", "progress", "due_date", "reference_link"])
        tasks.append(["Approve homepage design", "Review the final homepage design", "Website Refresh", "aarav@company.com", "HIGH", "PENDING", "0", "2026-10-20", ""])
        for sheet in workbook.worksheets:
            sheet.freeze_panes = "A2"
            for cell in sheet[1]:
                cell.font = cell.font.copy(bold=True)
            for column in sheet.columns:
                sheet.column_dimensions[column[0].column_letter].width = min(32, max(14, max(len(str(cell.value or "")) for cell in column) + 2))
        output = io.BytesIO()
        workbook.save(output)
        response = HttpResponse(output.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response["Content-Disposition"] = 'attachment; filename="workzen-onboarding-template.xlsx"'
        return response


def onboarding_result(data, company_user, confirm):
    errors, warnings = validate_rows(data, company_user.company)
    result = {"valid": not errors, "summary": {"employees": len(data["Employees"]), "projects": len(data["Projects"]), "tasks": len(data["Tasks"])}, "errors": errors, "warnings": warnings}
    if not confirm or errors:
        return result, 200 if not errors else 400
    result = import_workbook(data, company_user.company, company_user)
    new_member_ids = result.pop("new_member_ids", [])
    invitation_warnings = []
    for member in CompanyUser.objects.filter(id__in=new_member_ids).select_related("user", "company"):
        try:
            send_invitation(member)
        except (OSError, SMTPException, ValueError):
            invitation_warnings.append(f"Could not deliver an invitation to {member.email}. Use Resend invite after email settings are available.")
    result["warnings"] = result.get("warnings", []) + invitation_warnings
    result["summary"]["invitations_sent"] = len(new_member_ids) - len(invitation_warnings)
    return result, 201


class CompanyOnboardingImportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        company_user = owner_for_onboarding(request)
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"error": "Choose an Excel or CSV file first."}, status=400)
        try:
            data, read_warnings = read_workbook(uploaded_file)
        except ValueError as error:
            return Response({"error": str(error)}, status=400)
        result, code = onboarding_result(data, company_user, str(request.data.get("confirm", "")).lower() == "true")
        result["warnings"] = read_warnings + result.get("warnings", [])
        return Response(result, status=code)


class GoogleSheetOnboardingImportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        company_user = owner_for_onboarding(request)
        sheet_url = str(request.data.get("url", "")).strip()
        marker = "/spreadsheets/d/"
        if marker not in sheet_url:
            return Response({"error": "Paste a Google Sheets link in the format docs.google.com/spreadsheets/d/<sheet-id>."}, status=400)
        sheet_id = sheet_url.split(marker, 1)[1].split("/", 1)[0]
        if not sheet_id.replace("-", "").replace("_", "").isalnum():
            return Response({"error": "The Google Sheets link is invalid."}, status=400)
        try:
            export_url = f"https://docs.google.com/spreadsheets/d/{quote(sheet_id)}/export?format=xlsx"
            with urlopen(export_url, timeout=15) as downloaded:
                content = downloaded.read()
            from django.core.files.uploadedfile import SimpleUploadedFile
            data, read_warnings = read_workbook(SimpleUploadedFile("google-sheet.xlsx", content))
        except (HTTPError, URLError, ValueError):
            return Response({"error": "The Google Sheet could not be downloaded. Share it as 'Anyone with the link can view' and confirm it has Employees, Projects, and Tasks tabs."}, status=400)
        result, code = onboarding_result(data, company_user, str(request.data.get("confirm", "")).lower() == "true")
        result["warnings"] = read_warnings + result.get("warnings", [])
        return Response(result, status=code)

#for company
class CompanyViewSet(viewsets.ModelViewSet):
    serializer_class = CompanySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company_user = get_company_user(self.request.user)
        if not company_user:
            return Company.objects.none()
        return Company.objects.filter(id=company_user.company_id)

    def perform_create(self, serializer):
        raise MethodNotAllowed("POST")

    def perform_update(self, serializer):
        require_company_management(self.request)
        serializer.save()

    def perform_destroy(self, instance):
        raise PermissionDenied("Companies cannot be deleted through the API.")


# CREATE USER & SEND INVITE


class CreateUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        require_permission(request, "can_manage_users")
        serializer = CreateUserSerializer(
            data=request.data,
            context={"request": request}
        )

        if serializer.is_valid():
            try:
                with transaction.atomic():
                    company_user = serializer.save()
                    company_user.issue_invitation()
                    send_invitation(company_user)
            except (OSError, SMTPException, ValueError):
                return Response({"error": "Invite could not be delivered. Verify email settings and try again."}, status=503)

            return Response({
                "success": True,
                "message": "Invite sent successfully.",
            }, status=201)

        return Response(serializer.errors, status=400)


class ResendInviteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        actor = require_permission(request, "can_manage_users")
        try:
            member = CompanyUser.objects.select_related("user", "company", "role").get(id=user_id, company=actor.company)
        except CompanyUser.DoesNotExist:
            return Response({"error": "User not found"}, status=404)
        ensure_manageable_member(actor, member)
        if member.status == "ACTIVE":
            return Response({"error": "This user already has an active account."}, status=400)
        try:
            with transaction.atomic():
                member.issue_invitation()
                send_invitation(member)
        except (OSError, SMTPException, ValueError):
            return Response({"error": "Invite could not be delivered. Verify email settings and try again."}, status=503)
        return Response({"success": True, "message": "A new invitation has been sent."})
# update user
class UpdateUserView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, user_id):

        company_user = require_permission(request, "can_manage_users")

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

        if name is not None:
            user.name = name

        if role_id:
            try:
                role = Role.objects.get(
                    id=role_id,
                    company=company_user.company
                )
                ensure_manageable_member(company_user, user, replacement_role=role)
                user.role = role
            except Role.DoesNotExist:
                return Response({"error": "Invalid role"}, status=400)

        if status_val is not None:
            status_val = str(status_val).upper()
            if status_val not in dict(CompanyUser.STATUS_CHOICES):
                return Response({"error": "Invalid user status"}, status=400)
            ensure_manageable_member(company_user, user)
            user.status = status_val

        ensure_manageable_member(company_user, user)

        user.save()

        serializer = UserSerializer(user)
        return Response(serializer.data)

# delete user
class DeleteUserView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id):

        company_user = require_permission(request, "can_manage_users")

        try:
            user = CompanyUser.objects.get(
                id=user_id,
                company=company_user.company
            )
        except CompanyUser.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        ensure_manageable_member(company_user, user)

        user.status = "INACTIVE"
        user.invite_token = None
        user.invited_at = None
        user.invite_expires_at = None
        user.save(update_fields=["status", "invite_token", "invited_at", "invite_expires_at"])
        if user.user and not CompanyUser.objects.filter(user=user.user, status="ACTIVE").exclude(id=user.id).exists():
            user.user.is_active = False
            user.user.save(update_fields=["is_active"])

        return Response({
            "success": True,
            "message": "User access has been deactivated. Their work history was preserved."
        })

# SET PASSWORD VIEW
class SetPasswordView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_setup"

    def post(self, request, token):
        serializer = SetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        #  Validate invite token
        try:
            company_user = CompanyUser.objects.get(invite_token=token)
        except CompanyUser.DoesNotExist:
            return Response({"error": "Invalid or expired link"}, status=400)

        if company_user.invite_expires_at and company_user.invite_expires_at <= timezone.now():
            return Response({"error": "This invitation has expired. Ask your administrator to resend it."}, status=400)

        #  Set user password and activate account
        user = company_user.user
        user.set_password(serializer.validated_data["password"])
        user.is_active = True
        user.save()

        # Update company user record
        company_user.status = "ACTIVE"
        company_user.invite_token = None  # prevent reuse
        company_user.invited_at = None
        company_user.invite_expires_at = None
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
        company_user = require_permission(self.request, "can_manage_roles")
        candidate = Role(company=company_user.company, **serializer.validated_data)
        ensure_role_permissions_within_authority(company_user, candidate, serializer.validated_data)
        serializer.save(company=company_user.company)

    # UPDATE ROLE
    def perform_update(self, serializer):

        company_user = require_permission(self.request, "can_manage_roles")
        role = self.get_object()
        ensure_role_permissions_within_authority(company_user, role, serializer.validated_data)

        serializer.save()

    # DELETE ROLE
    def perform_destroy(self, instance):

        company_user = require_permission(self.request, "can_manage_roles")
        if instance.company_id != company_user.company_id:
            raise PermissionDenied("The role belongs to another company.")
        if instance.level >= company_user.role.level:
            raise PermissionDenied("You cannot delete an equal or higher role.")
        if CompanyUser.objects.filter(role=instance).exists():
            raise ValidationError("This role is assigned to users. Reassign those users before deleting the role.")
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
