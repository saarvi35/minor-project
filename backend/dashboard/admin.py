from django.contrib import admin

from .models import ContactMessage


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "email", "subject", "is_read", "created_at")
    list_filter = ("subject", "is_read", "created_at")
    search_fields = ("first_name", "last_name", "email", "message")
    readonly_fields = ("created_at",)

