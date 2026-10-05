from rest_framework import serializers
from django.conf import settings
from django.contrib.auth import get_user_model, authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from companies.models import  CompanyUser
from rest_framework_simplejwt.exceptions import TokenError
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen
import json

User = get_user_model()
# LOGIN


def build_login_payload(user, message="Login successful"):
    company_user = CompanyUser.objects.filter(user=user).first()
    refresh = RefreshToken.for_user(user)

    return {
        "success": True,
        "message": message,
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

        return build_login_payload(user)


class GoogleLoginSerializer(serializers.Serializer):
    credential = serializers.CharField(write_only=True, required=False, allow_blank=True)
    access_token = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def validate(self, data):
        credential = data.get("credential")
        access_token = data.get("access_token")
        client_id = getattr(settings, "GOOGLE_CLIENT_ID", "")

        if not client_id:
            raise serializers.ValidationError("Google login is not configured.")

        if not credential and not access_token:
            raise serializers.ValidationError("Google sign-in token is required.")

        try:
            query = urlencode({"id_token": credential} if credential else {"access_token": access_token})
            with urlopen(f"https://oauth2.googleapis.com/tokeninfo?{query}", timeout=8) as response:
                token_info = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, ValueError):
            raise serializers.ValidationError("Invalid Google sign-in token.")

        if token_info.get("aud") != client_id:
            raise serializers.ValidationError("Google token was not issued for this application.")

        if not token_info.get("email_verified"):
            raise serializers.ValidationError("Google email is not verified.")

        email = str(token_info.get("email") or "").strip()
        if not email:
            raise serializers.ValidationError("Google account email was not found.")

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise serializers.ValidationError("No WorkZen account exists for this Google email. Please register first.")

        if not user.is_active:
            raise serializers.ValidationError("User account is disabled.")

        return build_login_payload(user, message="Google login successful")

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
