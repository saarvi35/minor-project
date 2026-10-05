from rest_framework import serializers
from companies.utils import get_company_user
from .models import Project


class ProjectSerializer(serializers.ModelSerializer):

    class Meta:
        model = Project
        fields = "__all__"
        read_only_fields = ["created_at", "company" , "progress"]

    def validate_progress(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("Progress must be between 0 and 100")
        return value

    def validate(self, data):
        start_date = data.get("start_date", getattr(self.instance, "start_date", None))
        end_date = data.get("end_date", getattr(self.instance, "end_date", None))

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {"end_date": "End date cannot be before start date"}
            )

        request = self.context.get("request")
        company_user = get_company_user(request.user) if request and request.user.is_authenticated else None
        expected_company = company_user.company if company_user else getattr(self.instance, "company", None)

        for field_name in ("manager", "client"):
            member = data.get(field_name)
            if member and expected_company and member.company_id != expected_company.id:
                raise serializers.ValidationError({field_name: "This user belongs to another company."})

        return data
