from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from companies.models import CompanyUser
from companies.utils import get_company_user, get_permission_dict
from hr.models import LeaveRequest
from projects.models import Project
from tasks.models import Task

from .serializers import (
    ClientProjectProgressSerializer,
    LeaveSerializer,
    OverviewSerializer,
    ProjectSerializer,
    TaskSerializer,
    UserSerializer,
)


def has_permission(request, permission_name):
    company_user = get_company_user(request.user)
    permissions = get_permission_dict(company_user.role)

    if not permissions.get(permission_name):
        return None, Response({"error": "Permission denied"}, status=403)

    return company_user, None


def is_manager_company_user(company_user):
    role_name = str(getattr(company_user.role, "name", "")).lower()
    role_slug = str(getattr(company_user.role, "slug", "")).lower()
    return "manager" in f"{role_name} {role_slug}".strip()



class DashboardOverviewAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user = get_company_user(request.user)
        permissions = get_permission_dict(company_user.role)

        if not permissions.get("can_manage_company"):
            return Response({"error": "Permission denied"}, status=403)

        company = company_user.company

        total_tasks = Task.objects.filter(company=company).count()
        completed_tasks = Task.objects.filter(company=company, status="COMPLETED").count()
        pending_tasks = Task.objects.filter(company=company, status="PENDING").count()

        completion_rate = (completed_tasks / total_tasks) * 100 if total_tasks > 0 else 0

        overdue_tasks = Task.objects.filter(
            company=company,
            due_date__lt=timezone.now(),
            status__in=["PENDING", "IN_PROGRESS"],
        ).count()

        data = {
            "total_clients": Project.objects.filter(company=company)
            .values("client")
            .distinct()
            .count(),
            "total_employees": CompanyUser.objects.filter(company=company).count(),
            "total_projects": Project.objects.filter(company=company).count(),
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "pending_tasks": pending_tasks,
            "completion_rate": round(completion_rate, 2),
            "overdue_tasks": overdue_tasks,
        }

        serializer = OverviewSerializer(data)
        return Response(serializer.data)

class MyTasksAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user = get_company_user(request.user)

        if not company_user:
            return Response({"error": "Company user not found"}, status=404)

        permissions = get_permission_dict(company_user.role)

        if not permissions.get("can_view_assigned_tasks"):
            return Response({"error": "Permission denied"}, status=403)

        tasks = Task.objects.filter(assigned_to=company_user)

        serializer = TaskSerializer(tasks, many=True)
        return Response(serializer.data)

class MyProjectsAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user = get_company_user(request.user)
        permissions = get_permission_dict(company_user.role)

        if not permissions.get("can_view_project_progress"):
            return Response({"error": "Permission denied"}, status=403)

        projects = Project.objects.filter(
            tasks__assigned_to=company_user
        ).distinct()

        serializer = ProjectSerializer(projects, many=True)
        return Response(serializer.data)

class UserListAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user = get_company_user(request.user)
        permissions = get_permission_dict(company_user.role)

        if not permissions.get("can_manage_users"):
            return Response({"error": "Permission denied"}, status=403)

        users = CompanyUser.objects.filter(company=company_user.company)
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)


class MyLeaveListAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user = get_company_user(request.user)
        leaves = LeaveRequest.objects.filter(company_user=company_user)
        serializer = LeaveSerializer(leaves, many=True)
        return Response(serializer.data)

class AllTasksAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        company_user = get_company_user(request.user)

        if not company_user:
            return Response({"error": "Company user not found"}, status=404)

        permissions = get_permission_dict(company_user.role)

        project_id = request.query_params.get("project_id")

        # OWNER / ADMIN
        if permissions.get("can_view_all_tasks"):
            tasks = Task.objects.filter(company=company_user.company)

        # MANAGER
        elif permissions.get("can_view_team_tasks"):
            tasks = Task.objects.filter(
                project__manager=company_user
            )

        # EMPLOYEE
        elif permissions("can_view_assigned_tasks"):
            tasks = Task.objects.filter(
                assigned_to=company_user
            )

        tasks = tasks.select_related("assigned_to", "project")

        serializer = TaskSerializer(tasks, many=True)

        return Response(serializer.data)


class TaskAnalyticsAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user, error = has_permission(request, "can_view_task_analytics")
        if error:
            return error

        company = company_user.company

        total = Task.objects.filter(company=company).count()
        completed = Task.objects.filter(company=company, status="COMPLETED").count()
        overdue = Task.objects.filter(
            company=company,
            due_date__lt=timezone.now(),
            status__in=["PENDING", "IN_PROGRESS"],
        ).count()

        return Response(
            {
                "total_tasks": total,
                "completed_tasks": completed,
                "overdue_tasks": overdue,
            }
        )

class TeamLeaveListAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user, error = has_permission(request, "can_approve_leave")
        if error:
            return error

        leaves = LeaveRequest.objects.select_related(
            "company_user__role", 
            "company_user__user"
        ).filter(
            company_user__company=company_user.company,
            company_user__role__slug__in=["manager", "employee"]
        ).order_by("-applied_on")

        serializer = LeaveSerializer(leaves, many=True)
        return Response(serializer.data)


class AllProjectsAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user, error = has_permission(request, "can_create_project")
        if error:
            return error

        projects = Project.objects.filter(company=company_user.company)
        serializer = ProjectSerializer(projects, many=True)
        return Response(serializer.data)


class ClientProjectsProgressAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user, error = has_permission(request, "can_view_client_projects")
        if error:
            return error

        projects = Project.objects.filter(client=company_user)
        serializer = ClientProjectProgressSerializer(projects, many=True)
        return Response(serializer.data)


class ManagerProjectsAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user = get_company_user(request.user)
        if not company_user:
            return Response({"error": "Company user not found"}, status=404)

        projects = Project.objects.filter(manager=company_user)
        serializer = ProjectSerializer(projects, many=True)
        return Response(serializer.data)


class ManagerOverviewAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user = get_company_user(request.user)
        if not company_user:
            return Response({"error": "Company user not found"}, status=404)

        permissions = get_permission_dict(company_user.role)
        manager_role = is_manager_company_user(company_user)

        if not (
            permissions.get("can_view_all_tasks")
            or permissions.get("can_view_team_tasks")
            or permissions.get("can_view_assigned_tasks")
            or manager_role
        ):
            return Response({"error": "Permission denied"}, status=403)

        projects = Project.objects.filter(manager=company_user)
        total_projects = projects.count()

        if permissions.get("can_view_all_tasks"):
            tasks = Task.objects.filter(company=company_user.company)
        elif permissions.get("can_view_team_tasks") or manager_role:
            tasks = Task.objects.filter(company=company_user.company).filter(
                Q(project__manager=company_user)
                | Q(project__isnull=True, created_by=company_user)
            ).distinct()
        else:
            tasks = Task.objects.filter(assigned_to=company_user)

        total_tasks = tasks.count()
        completed_tasks = tasks.filter(status="COMPLETED").count()
        pending_tasks = tasks.filter(status="PENDING").count()
        in_progress_tasks = tasks.filter(status="IN_PROGRESS").count()

        overdue_tasks = tasks.filter(
            due_date__lt=timezone.now().date(),
            status__in=["PENDING", "IN_PROGRESS"],
        ).count()

        return Response(
            {
                "total_projects": total_projects,
                "total_tasks": total_tasks,
                "completed_tasks": completed_tasks,
                "pending_tasks": pending_tasks,
                "in_progress_tasks": in_progress_tasks,
                "overdue_tasks": overdue_tasks,
            }
        )
