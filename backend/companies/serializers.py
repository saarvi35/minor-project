from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

from .models import CompanyUser, Role, Company
from .permissions import ensure_manageable_member, require_permission

User = get_user_model()


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = "__all__"
        read_only_fields = ["owner", "last_user_number"]


class RegistrationSerializer(serializers.Serializer):
    company = CompanySerializer()

    owner_name = serializers.CharField(max_length=150)
    owner_email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_owner_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                "User with this email already exists."
            )
        return value

    def validate_password(self, value):
        user = User(
            username=self.initial_data.get("owner_email", ""),
            email=self.initial_data.get("owner_email", ""),
            first_name=self.initial_data.get("owner_name", ""),
        )
        validate_password(value, user)
        return value

    @transaction.atomic
    def create(self, validated_data):
        company_data = validated_data.pop("company")

        company = Company.objects.create(**company_data)

        user = User.objects.create_user(
            username=validated_data["owner_email"],
            email=validated_data["owner_email"],
            password=validated_data["password"],
            first_name=validated_data["owner_name"]
        )

        company.owner = user
        company.save()

        owner_role = Role.objects.create(
            name="OWNER",
            company=company,
            level=100,
            can_manage_company=True,
            can_manage_roles=True,
            can_manage_users=True,
            can_create_project=True,
            can_assign_task=True,
            can_view_all_tasks=True,
            can_view_team_tasks=True,
            can_view_assigned_tasks=True,
            can_update_task_status=True,
            can_view_project_progress=True,
            can_manage_hr=True,
            can_approve_leave=True,
            can_view_attendance=True,
            can_manage_payroll=True,
        )

        CompanyUser.objects.create(
            user=user,
            company=company,
            role=owner_role,
            name=user.first_name,
            email=user.email,
            status="ACTIVE"
        )

        return user


class CreateUserSerializer(serializers.Serializer):
    company_id = serializers.IntegerField()
    first_name = serializers.CharField()
    email = serializers.EmailField()
    role_id = serializers.IntegerField()

    def validate(self, data):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication is required.")
        actor = require_permission(request, "can_manage_users")
        try:
            company = Company.objects.get(id=data["company_id"])
        except Company.DoesNotExist:
            raise serializers.ValidationError("Company not found.")

        try:
            role = Role.objects.get(id=data["role_id"], company=company)
        except Role.DoesNotExist:
            raise serializers.ValidationError("Invalid role for this company.")

        if company.id != actor.company_id:
            raise serializers.ValidationError("You can only invite users into your own company.")
        if role.level >= actor.role.level:
            raise serializers.ValidationError("You cannot assign an equal or higher role.")

        existing_user = User.objects.filter(email=data["email"]).first()

        if existing_user:
            if CompanyUser.objects.filter(user=existing_user).exclude(company=company).exists():
                raise serializers.ValidationError("This email already belongs to another company tenant.")
            if CompanyUser.objects.filter(
                user=existing_user,
                company=company
            ).exists():
                raise serializers.ValidationError(
                    "User already exists in this company."
                )

        return data

    def create(self, validated_data):
        company = Company.objects.get(id=validated_data["company_id"])

        user, created = User.objects.get_or_create(
            email=validated_data["email"],
            defaults={
                "username": validated_data["email"],
                "first_name": validated_data["first_name"],
                "is_active": False
            }
        )
        if created:
            user.set_unusable_password()
            user.save(update_fields=["password"])

        company_user = CompanyUser.objects.create(
            user=user,
            company=company,
            role_id=validated_data["role_id"],
            name=validated_data["first_name"],
            email=validated_data["email"],
            status="INVITED"
        )

        return company_user


class RoleSerializer(serializers.ModelSerializer):

    class Meta:
        model = Role
        fields = "__all__"
        read_only_fields = ["company", "slug"]


class CurrentUserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    level = serializers.SerializerMethodField()

    class Meta:
        model = CompanyUser
        fields = ["id", "name", "email", "role", "level", "permissions"]

    def get_name(self, obj):
        if obj.name:
            return obj.name
        if obj.user:
            full_name = obj.user.get_full_name().strip()
            if full_name:
                return full_name
            if obj.user.first_name:
                return obj.user.first_name
            if obj.user.username:
                return obj.user.username
        return obj.email or None

    def get_email(self, obj):
        if obj.email:
            return obj.email
        if obj.user:
            return obj.user.email
        return None

    def get_role(self, obj):
        return obj.role.name

    def get_level(self, obj):
        return obj.role.level

    def get_permissions(self, obj):
        role = obj.role

        permission_fields = [
            field.name
            for field in role._meta.fields
            if field.name.startswith("can_")
        ]

        return {
            field: getattr(role, field)
            for field in permission_fields
        }


class SetPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, data):
        if data["password"] != data["confirm_password"]:
            raise serializers.ValidationError("Passwords do not match")
        validate_password(data["password"])
        return data
