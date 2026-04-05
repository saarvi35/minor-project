from rest_framework import serializers

from companies.models import CompanyUser
from hr.models import LeaveRequest
from projects.models import Project
from tasks.models import Task


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


class OverviewSerializer(serializers.Serializer):
    total_clients = serializers.IntegerField()
    total_employees = serializers.IntegerField()
    total_projects = serializers.IntegerField()
    total_tasks = serializers.IntegerField()
    completed_tasks = serializers.IntegerField()
    pending_tasks = serializers.IntegerField()
    completion_rate = serializers.FloatField()
    overdue_tasks = serializers.IntegerField()


class UserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="role.name")
    level = serializers.IntegerField(source="role.level")
    name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()

    class Meta:
        model = CompanyUser
        fields = ["id", "name", "email", "role", "level", "status"]

    def get_name(self, obj):
        if obj.name:
            return obj.name
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return None

    def get_email(self, obj):
        if obj.email:
            return obj.email
        if obj.user:
            return obj.user.email
        return None


class ProjectSerializer(serializers.ModelSerializer):

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "status",
            "progress",
            "priority",
            "start_date",
            "end_date",
        ]


class TaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "description",
            "assigned_to",
            "assigned_to_name",
            "created_by",
            "created_by_name",
            "company",
            "status",
            "priority",
            "due_date",
            "attachment",
            "image",
            "reference_link",
            "progress",
            "created_at",
            "project",
        ]

    def get_assigned_to_name(self, obj):
        return get_company_user_name(getattr(obj, "assigned_to", None))

    def get_created_by_name(self, obj):
        return get_company_user_name(getattr(obj, "created_by", None))


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

    def get_employee_name(self, obj):
        return get_company_user_name(getattr(obj, "company_user", None))

    def get_employee_role(self, obj):
        company_user = getattr(obj, "company_user", None)
        role = getattr(company_user, "role", None)
        return getattr(role, "name", None)


class ClientProjectProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "progress",
            "status",
            "start_date",
            "end_date",
            "budget",
            "actual_cost"
        ]
