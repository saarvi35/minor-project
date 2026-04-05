from rest_framework import serializers
from django.contrib.auth import get_user_model, authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from companies.models import  CompanyUser
from rest_framework_simplejwt.exceptions import TokenError

User = get_user_model()
# LOGIN

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            raise serializers.ValidationError("Email and password are required.")

        user = authenticate(username=email, password=password)

        if not user:
            raise serializers.ValidationError("Invalid email or password.")

        if not user.is_active:
            raise serializers.ValidationError("User account is disabled.")

        # Get company + role info
        company_user = CompanyUser.objects.filter(user=user).first()

        refresh = RefreshToken.for_user(user)

        return {
            "success": True,
            "message": "Login successful",
            "data": {
                "user_id": user.id,
                "name": f"{user.first_name} {user.last_name}".strip() or "User",
                "email": user.email,
                "role": company_user.role.name if company_user else None,
                "company": company_user.company.name if company_user else None,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            }
        }

class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()

    def validate(self, attrs):
        self.token = attrs["refresh"]
        return attrs

    def save(self, **kwargs):
        try:
            token = RefreshToken(self.token)
            token.blacklist()
        except TokenError:
            raise serializers.ValidationError("Invalid or expired token")

class ApplyLeaveSerializer(serializers.ModelSerializer):

    def validate(self, data):
        if data["end_date"] < data["start_date"]:
            raise serializers.ValidationError("End date cannot be before start date")
        return data