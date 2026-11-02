"""Project message thread shared by a project's team and its client."""

import os
import re

from django.http import FileResponse
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from companies.utils import get_company_user, get_permission_dict
from tasks.models import Task

from .models import Project, ProjectMessage

PAGE_SIZE = 200
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

# extension -> (content type served, leading bytes the file must start with, or None to skip the check)
_OLE = (b"\xd0\xcf\x11\xe0",)
_ZIP = (b"PK\x03\x04",)
ALLOWED_ATTACHMENTS = {
    "pdf": ("application/pdf", (b"%PDF",)),
    "doc": ("application/msword", _OLE),
    "docx": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", _ZIP),
    "xls": ("application/vnd.ms-excel", _OLE),
    "xlsx": ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", _ZIP),
    "ppt": ("application/vnd.ms-powerpoint", _OLE),
    "pptx": ("application/vnd.openxmlformats-officedocument.presentationml.presentation", _ZIP),
    "txt": ("text/plain", None),
    "csv": ("text/csv", None),
    "png": ("image/png", (b"\x89PNG",)),
    "jpg": ("image/jpeg", (b"\xff\xd8\xff",)),
    "jpeg": ("image/jpeg", (b"\xff\xd8\xff",)),
    "gif": ("image/gif", (b"GIF87a", b"GIF89a")),
    "webp": ("image/webp", (b"RIFF",)),
}
INLINE_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"}


def can_use_project_thread(company_user, project):
    """Owner, the project manager, employees with work on the project, and its client."""
    if project.company_id != company_user.company_id or not project.is_active:
        return False
    permissions = get_permission_dict(company_user.role)
    if permissions.get("can_manage_company"):
        return True
    if project.manager_id == company_user.id:
        return True
    if project.client_id == company_user.id:
        return bool(permissions.get("can_view_project_progress"))
    if permissions.get("can_view_assigned_tasks"):
        return Task.objects.filter(
            company=company_user.company, project=project, assigned_to=company_user, is_archived=False
        ).exists()
    return False


def _safe_filename(name):
    base = os.path.basename(str(name or "").replace("\\", "/"))
    base = re.sub(r"[^\w.\- ()]+", "_", base).strip(" .")
    return base[:200] or "attachment"


def validate_attachment(upload):
    extension = upload.name.rsplit(".", 1)[-1].lower() if "." in upload.name else ""
    if extension not in ALLOWED_ATTACHMENTS:
        raise serializers.ValidationError(
            "This file type is not allowed. Use PDF, Word, Excel, PowerPoint, text, CSV or image files."
        )
    if upload.size > MAX_ATTACHMENT_BYTES:
        raise serializers.ValidationError("Files must be 10 MB or smaller.")
    if upload.size == 0:
        raise serializers.ValidationError("The file is empty.")
    content_type, signatures = ALLOWED_ATTACHMENTS[extension]
    if signatures:
        head = upload.read(8)
        upload.seek(0)
        if not any(head.startswith(signature) for signature in signatures):
            raise serializers.ValidationError("The file content does not match its extension.")
    return content_type


class ProjectMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_role = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()
    attachment = serializers.SerializerMethodField()

    class Meta:
        model = ProjectMessage
        fields = ["id", "sender_id", "sender_name", "sender_role", "body", "attachment", "created_at", "is_mine"]

    def get_sender_name(self, obj):
        return obj.sender.name or "Team member"

    def get_sender_role(self, obj):
        return obj.sender.role.name

    def get_is_mine(self, obj):
        return obj.sender_id == self.context["company_user"].id

    def get_attachment(self, obj):
        if not obj.attachment:
            return None
        return {
            "name": obj.attachment_name,
            "type": obj.attachment_type,
            "size": obj.attachment_size,
            "is_image": obj.attachment_type.startswith("image/"),
            "url": f"/projects/{obj.project_id}/messages/{obj.id}/attachment/",
        }


class ProjectMessageCreateSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
    attachment = serializers.FileField(required=False, allow_empty_file=True)

    def validate_body(self, value):
        return value.strip()

    def validate_attachment(self, value):
        self.content_type = validate_attachment(value)
        return value

    def validate(self, attrs):
        if not attrs.get("body") and not attrs.get("attachment"):
            raise serializers.ValidationError({"body": ["Write a message or attach a file."]})
        return attrs


class ProjectMessagesAPI(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "project_messages"

    def _context(self, request, project_id):
        company_user = get_company_user(request.user)
        if not company_user:
            raise PermissionDenied("Your account is not linked to a company.")
        project = Project.objects.filter(id=project_id, company=company_user.company, is_active=True).first()
        if not project:
            return company_user, None
        if not can_use_project_thread(company_user, project):
            raise PermissionDenied("You are not a participant of this project.")
        return company_user, project

    def get(self, request, project_id):
        company_user, project = self._context(request, project_id)
        if not project:
            return Response({"error": "Project not found."}, status=404)
        queryset = ProjectMessage.objects.filter(project=project).select_related("sender__role")
        try:
            after = int(request.query_params.get("after", 0))
        except ValueError:
            after = 0
        if after > 0:
            rows = list(queryset.filter(id__gt=after)[:PAGE_SIZE])
        else:
            rows = list(queryset.order_by("-id")[:PAGE_SIZE])[::-1]
        data = ProjectMessageSerializer(rows, many=True, context={"company_user": company_user}).data
        return Response(data)

    def post(self, request, project_id):
        company_user, project = self._context(request, project_id)
        if not project:
            return Response({"error": "Project not found."}, status=404)
        serializer = ProjectMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload = serializer.validated_data.get("attachment")
        message = ProjectMessage(project=project, sender=company_user, body=serializer.validated_data.get("body", ""))
        if upload:
            message.attachment_name = _safe_filename(upload.name)
            message.attachment_type = serializer.content_type
            message.attachment_size = upload.size
            message.attachment.save(upload.name, upload, save=False)
        message.save()
        return Response(ProjectMessageSerializer(message, context={"company_user": company_user}).data, status=201)


class ProjectMessageAttachmentAPI(ProjectMessagesAPI):
    """Streams an attachment only to participants of the message's project."""

    parser_classes = [JSONParser]

    def get(self, request, project_id, message_id):
        company_user, project = self._context(request, project_id)
        if not project:
            return Response({"error": "Project not found."}, status=404)
        message = ProjectMessage.objects.filter(id=message_id, project=project).exclude(attachment="").first()
        if not message or not message.attachment:
            return Response({"error": "Attachment not found."}, status=404)
        inline = message.attachment_type in INLINE_TYPES
        response = FileResponse(
            message.attachment.open("rb"),
            as_attachment=not inline,
            filename=message.attachment_name,
            content_type=message.attachment_type,
        )
        response["X-Content-Type-Options"] = "nosniff"
        response["Content-Security-Policy"] = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox"
        response["Cache-Control"] = "private, no-store"
        return response
