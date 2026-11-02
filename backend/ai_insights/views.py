import json

from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle

from companies.utils import get_company_user

from .serializers import AIProjectPlanRequestSerializer, AIProjectPlanReviseSerializer, TaskPrioritizationSerializer, WorkloadRecommendationSerializer
from .copilot import AIProviderUnavailable, apply_project_plan, generate_project_plan, provider_status, revise_project_plan
from .models import AIProjectPlan
from .services import (
    build_ai_analytics_summary,
    build_delay_predictions,
    build_escalations,
    build_task_priorities,
    build_workload_balancing,
)


def get_request_company_user(request):
    company_user = get_company_user(request.user)
    if not company_user:
        return None, Response({"error": "Company user not found"}, status=404)
    return company_user, None


def can_plan_work(company_user):
    """The AI Project Architect is limited to company owners and managers."""
    from companies.utils import get_permission_dict

    permissions = get_permission_dict(company_user.role)
    if permissions.get("can_manage_company"):
        return True
    is_manager = "manager" in str(company_user.role.name).lower()
    return bool(is_manager and permissions.get("can_create_project") and permissions.get("can_assign_task"))


class AICopilotStatusAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user, error = get_request_company_user(request)
        if error:
            return error
        status = provider_status()
        status["can_plan"] = can_plan_work(company_user)
        return Response(status)


class AIProjectPlanAPI(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ai"

    def post(self, request):
        company_user, error = get_request_company_user(request)
        if error:
            return error
        if not can_plan_work(company_user):
            raise PermissionDenied("You do not have permission to create a project plan.")
        serializer = AIProjectPlanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            plan = generate_project_plan(company_user, **serializer.validated_data)
        except AIProviderUnavailable as error:
            return Response({"error": str(error), "provider_status": provider_status()}, status=503)
        except (ValueError, json.JSONDecodeError) as error:
            return Response({"error": f"The AI response could not be used safely: {error}"}, status=422)
        return Response(serialize_plan(plan), status=201)


class AIProjectPlanApplyAPI(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ai"

    def post(self, request, plan_id):
        company_user, error = get_request_company_user(request)
        if error:
            return error
        if not can_plan_work(company_user):
            raise PermissionDenied("You do not have permission to apply a project plan.")
        try:
            plan = AIProjectPlan.objects.get(id=plan_id, company=company_user.company)
        except AIProjectPlan.DoesNotExist:
            return Response({"error": "AI plan not found."}, status=404)
        if plan.created_by_id != company_user.id and not company_user.role.can_manage_company:
            raise PermissionDenied("Only the plan creator or a company owner can apply this AI plan.")
        try:
            project = apply_project_plan(plan, company_user)
        except ValueError as error:
            return Response({"error": str(error)}, status=400)
        payload = serialize_plan(plan)
        payload["created_project_id"] = project.id
        return Response(payload, status=201)


class AIProjectPlanReviseAPI(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ai"

    def post(self, request, plan_id):
        company_user, error = get_request_company_user(request)
        if error:
            return error
        if not can_plan_work(company_user):
            raise PermissionDenied("You do not have permission to revise a project plan.")
        try:
            plan = AIProjectPlan.objects.get(id=plan_id, company=company_user.company)
        except AIProjectPlan.DoesNotExist:
            return Response({"error": "AI plan not found."}, status=404)
        if plan.created_by_id != company_user.id and not company_user.role.can_manage_company:
            raise PermissionDenied("Only the plan creator or a company owner can revise this AI plan.")
        if plan.status == AIProjectPlan.STATUS_APPLIED:
            return Response({"error": "An applied plan can no longer be revised."}, status=400)
        serializer = AIProjectPlanReviseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            plan = revise_project_plan(plan, company_user, serializer.validated_data["instruction"])
        except AIProviderUnavailable as error:
            return Response({"error": str(error), "provider_status": provider_status()}, status=503)
        except (ValueError, json.JSONDecodeError) as error:
            return Response({"error": f"The AI response could not be used safely: {error}"}, status=422)
        return Response(serialize_plan(plan))


def serialize_plan(plan):
    public_plan = dict(plan.plan)
    public_plan.pop("candidate_assignments", None)
    return {
        "id": plan.id,
        "title": plan.title,
        "brief": plan.brief,
        "plan": public_plan,
        "provider": plan.provider,
        "model": plan.model_name,
        "status": plan.status,
        "created_at": plan.created_at,
        "applied_at": plan.applied_at,
        "project_id": plan.project_id,
    }


class DelayPredictionAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user, error = get_request_company_user(request)
        if error:
            return error

        return Response(build_delay_predictions(company_user))


class EscalationInsightsAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user, error = get_request_company_user(request)
        if error:
            return error

        return Response(build_escalations(company_user))


class AIAnalyticsSummaryAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user, error = get_request_company_user(request)
        if error:
            return error

        return Response(build_ai_analytics_summary(company_user))


class SmartTaskPrioritizationAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user, error = get_request_company_user(request)
        if error:
            return error

        serializer = TaskPrioritizationSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        return Response(
            build_task_priorities(
                company_user,
                project_id=serializer.validated_data.get("project_id"),
                limit=serializer.validated_data.get("limit", 20),
            )
        )


class WorkloadBalancingAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user, error = get_request_company_user(request)
        if error:
            return error

        serializer = WorkloadRecommendationSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        return Response(
            build_workload_balancing(
                company_user,
                project_id=serializer.validated_data.get("project_id"),
                priority=serializer.validated_data.get("priority", "MEDIUM"),
            )
        )
