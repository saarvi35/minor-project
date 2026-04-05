from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from companies.models import CompanyUser
from companies.utils import get_company_user, get_permission_dict

from .models import *
from .serializers import *


def manager_employee_company_users(company):
    return CompanyUser.objects.filter(company=company).filter(
        Q(role__name__icontains="manager")
        | Q(role__slug__icontains="manager")
        | Q(role__name__icontains="employee")
        | Q(role__slug__icontains="employee")
    ).distinct()


class HRDashboardAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user = get_company_user(request.user)
        permissions = get_permission_dict(company_user.role)

        if not permissions.get("can_manage_hr"):
            return Response({"error": "Permission denied"}, status=403)

        company = company_user.company
        today = timezone.now().date()

        total_employees = CompanyUser.objects.filter(
            company=company
        ).count()

        present = Attendance.objects.filter(company_user__company=company, date=today, status="PRESENT").count()
        absent = Attendance.objects.filter(company_user__company=company, date=today, status="ABSENT").count()
        half_day = Attendance.objects.filter(company_user__company=company, date=today, status="HALF_DAY").count()
        on_leave = LeaveRequest.objects.filter(
            company_user__company=company,
            start_date__lte=today,
            end_date__gte=today,
            status="APPROVED"
        ).count()

        attendance_percentage = round((present / total_employees) * 100) if total_employees else 0

        leave_summary = {
            "approved": LeaveRequest.objects.filter(company_user__company=company, status="APPROVED").count(),
            "pending": LeaveRequest.objects.filter(company_user__company=company, status="PENDING").count(),
            "rejected": LeaveRequest.objects.filter(company_user__company=company, status="REJECTED").count()
        }

        return Response({
            "total_employees": total_employees,
            "attendance": {
                "present": present,
                "absent": absent,
                "half_day": half_day,
                "on_leave": on_leave,
                "attendance_percentage": attendance_percentage
            },
            "leave_summary": leave_summary
        })


class MyProfileAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user = get_company_user(request.user)

        profile = EmployeeProfile.objects.get(company_user=company_user)
        serializer = EmployeeProfileSerializer(profile)
        return Response(serializer.data)

    def put(self, request):
        company_user = get_company_user(request.user)
        profile = EmployeeProfile.objects.get(company_user=company_user)

        serializer = EmployeeProfileSerializer(
            profile, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class DepartmentListCreateAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user = get_company_user(request.user)
        departments = Department.objects.filter(company=company_user.company)
        serializer = DepartmentSerializer(departments, many=True)
        return Response(serializer.data)

    def post(self, request):
        company_user = get_company_user(request.user)
        permissions = get_permission_dict(company_user.role)

        if not permissions.get("can_manage_hr"):
            return Response({"error": "Permission denied"}, status=403)

        serializer = DepartmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(company=company_user.company)
        return Response(serializer.data, status=201)


class MyAttendanceAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user = get_company_user(request.user)
        permissions = get_permission_dict(company_user.role)

        if permissions.get("can_manage_hr"):
            scoped_user_ids = manager_employee_company_users(company_user.company).values_list("id", flat=True)
            attendance = Attendance.objects.select_related("company_user__role", "company_user__user").filter(
                company_user_id__in=scoped_user_ids,
                check_in__isnull=False
            ).order_by("-date", "-check_in")
        else:
            attendance = Attendance.objects.select_related("company_user__role", "company_user__user").filter(
                company_user=company_user
            ).order_by("-date", "-check_in")

        serializer = AttendanceSerializer(attendance, many=True)
        return Response(serializer.data)


class UpdateLeaveStatusAPI(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, leave_id):
        company_user = get_company_user(request.user)
        permissions = get_permission_dict(company_user.role)

        if not permissions.get("can_manage_hr"):
            return Response({"error": "Permission denied"}, status=403)

        leave = LeaveRequest.objects.select_related("company_user__role", "company_user__user").get(
            id=leave_id,
            company_user__company=company_user.company
        )

        leave.status = str(request.data.get("status") or "").upper()
        leave.save()

        serializer = LeaveSerializer(leave)
        return Response(serializer.data)


class AddPerformanceReviewAPI(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, employee_id):
        company_user = get_company_user(request.user)
        permissions = get_permission_dict(company_user.role)

        if not permissions.get("can_manage_hr"):
            return Response({"error": "Permission denied"}, status=403)

        employee = CompanyUser.objects.get(id=employee_id)

        serializer = PerformanceReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        serializer.save(
            company_user=employee,
            reviewer=company_user
        )

        return Response(serializer.data, status=201)
