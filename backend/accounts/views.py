from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import LoginSerializer , LogoutSerializer
from rest_framework.exceptions import ValidationError
from companies.models import CompanyUser
from hr.models import Attendance, LeaveRequest
from django.utils import timezone 
from datetime import datetime
from rest_framework.permissions import IsAuthenticated 


# login view
class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except ValidationError as e:
           
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.validated_data, status=status.HTTP_200_OK)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):

        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        serializer.save()

        return Response(
            {
                "success": True,
                "message": "Logged out successfully"
            },
            status=status.HTTP_200_OK
        )

class MarkAttendanceAPI(APIView):

    def post(self, request):

        try:
            company_user = CompanyUser.objects.select_related("role").get(user=request.user)
            permission_classes = [IsAuthenticated]
        except CompanyUser.DoesNotExist:
            return Response({"error": "Not linked to company"}, status=403)

        today = timezone.now().date()
        now = timezone.localtime()
        check_in = now.time()
        attendance, created = Attendance.objects.get_or_create(
            company_user=company_user,
            date=today,
            defaults={
                "check_in": check_in,
                "status": "PRESENT"
            }
        )

        if not created:
            return Response({"message": "Already marked today"}, status=400)

        return Response({
            "message": "Attendance marked successfully",
            "data": {
                "date": attendance.date,
                "check_in": attendance.check_in
            }
        }, status=201)

class CheckoutAttendanceAPI(APIView):

    def post(self, request):

        try:
            company_user = CompanyUser.objects.get(user=request.user)
            permission_classes = [IsAuthenticated]
        except CompanyUser.DoesNotExist:
            return Response({"error": "Not linked to company"}, status=403)

        today = timezone.now().date()

        try:
            attendance = Attendance.objects.get(
                company_user=company_user,
                date=today
            )
        except Attendance.DoesNotExist:
            return Response({"error": "Check-in not done"}, status=404)

        if attendance.check_out:
            return Response({"message": "Already checked out"}, status=400)

        attendance.check_out = timezone.now().time()
        attendance.save()
        check_in_datetime = datetime.combine(today, attendance.check_in)
        check_out_datetime = datetime.combine(today, attendance.check_out)

        duration = check_out_datetime - check_in_datetime

        return Response({
            "message": "Checked out successfully",
            "check_out": attendance.check_out,
            "working_hours": str(duration)
        })



class ApplyLeaveAPI(APIView):

    def post(self, request):

        try:
            company_user = CompanyUser.objects.get(user=request.user)
            permission_classes = [IsAuthenticated]
        except CompanyUser.DoesNotExist:
            return Response({"error": "Not linked to company"}, status=403)

        start_date_str = request.data.get("start_date")
        end_date_str = request.data.get("end_date")
        reason = request.data.get("reason")

        if not start_date_str or not end_date_str or not reason:
            return Response({"error": "All fields required"}, status=400)

        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response({"error": "Invalid date format. Use YYYY-MM-DD"}, status=400)

        if start_date > end_date:
            return Response({"error": "End date must be after start date"}, status=400)
        reason = request.data.get("reason")

        if not start_date or not end_date or not reason:
            return Response({"error": "All fields required"}, status=400)
        existing = LeaveRequest.objects.filter(
            company_user=company_user,
            start_date__lte=end_date,
            end_date__gte=start_date
        )

        if existing.exists():
            return Response({"error": "Leave dates overlap with existing leave"}, status=400)
        
        leave = LeaveRequest.objects.create(
            company_user=company_user,
            start_date=start_date,
            end_date=end_date,
            reason=reason
        )

        return Response({
            "message": "Leave request submitted",
            "leave_id": leave.id,
            "status": leave.status
        }, status=201)




