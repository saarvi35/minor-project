"""Invitation issuing and delivery helpers."""

from django.conf import settings
from django.core.mail import send_mail


def invitation_link(company_user):
    base_url = settings.FRONTEND_BASE_URL.rstrip("/")
    if not base_url:
        raise ValueError("FRONTEND_BASE_URL must be configured before invitations can be sent.")
    return f"{base_url}/set-password/{company_user.invite_token}"


def send_invitation(company_user):
    if not company_user.user or not company_user.user.email:
        raise ValueError("The invited user has no email address.")
    link = invitation_link(company_user)
    return send_mail(
        subject=f"You're invited to join {company_user.company.name}",
        message=(
            f"Hello {company_user.name or ''},\n\n"
            f"You have been invited to join {company_user.company.name}.\n"
            f"Set your password within 7 days: {link}\n\n"
            "If you were not expecting this invitation, you can ignore this email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[company_user.user.email],
        fail_silently=False,
    )
