from rest_framework import serializers
from .models import (
    EmployeeProfile,
    Department,
    Attendance,
    LeaveRequest,
    PerformanceReview,
)


def get_company_user_name(company_user):
    if not company_user:
        return None
    if company_user.name:
        return company_user.name

    user = getattr(company_user, "user", None)
    if user:
        full_name = f"{user.first_name} {user.last_name}".strip()
        if full_name:
            return full_name
        if user.email:
            return user.email
        if user.username:
            return user.username

    return company_user.email


class DepartmentSerializer(serializers.ModelSerializer):

    class Meta:
        model = Department
        fields = ["id", "name", "description"]


class EmployeeProfileSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        source="department",
        write_only=True,
        required=False
    )

    class Meta:
        model = EmployeeProfile
        fields = [
            "id",
            "department",
            "department_id",
            "designation",
            "date_joined",
            "salary",
            "phone",
            "address",
        ]


class AttendanceSerializer(serializers.ModelSerializer):
    company_user_id = serializers.IntegerField(source="company_user.id", read_only=True)
    employee_name = serializers.SerializerMethodField()
    employee_role = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = [
            "id",
            "company_user_id",
            "employee_name",
            "employee_role",
            "date",
            "check_in",
            "check_out",
            "status",
        ]

    def get_employee_name(self, obj):
        return get_company_user_name(getattr(obj, "company_user", None))

    def get_employee_role(self, obj):
        company_user = getattr(obj, "company_user", None)
        role = getattr(company_user, "role", None)
        return getattr(role, "name", None)


class LeaveSerializer(serializers.ModelSerializer):
    company_user_id = serializers.IntegerField(source="company_user.id", read_only=True)
    employee_name = serializers.SerializerMethodField()
    employee_role = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = [
            "id",
            "company_user_id",
            "employee_name",
            "employee_role",
            "start_date",
            "end_date",
            "reason",
            "status",
            "applied_on",
        ]
        read_only_fields = ["status"]

    def get_employee_name(self, obj):
        return get_company_user_name(getattr(obj, "company_user", None))

    def get_employee_role(self, obj):
        company_user = getattr(obj, "company_user", None)
        role = getattr(company_user, "role", None)
        return getattr(role, "name", None)


class PerformanceReviewSerializer(serializers.ModelSerializer):

    class Meta:
        model = PerformanceReview
        fields = [
            "id",
            "rating",
            "feedback",
            "review_date",
        ]
