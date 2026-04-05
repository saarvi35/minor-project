from django.contrib import admin
from .models import Company, Role, CompanyUser


# ===============================
# 🔹 ROLE INLINE (inside Company)
# ===============================
class RoleInline(admin.TabularInline):
    model = Role
    extra = 1
    fields = (
        "name",
        "level",
        "can_manage_company",
        "can_manage_roles",
        "can_manage_users",
        "can_create_project",
        "can_assign_task",
        "can_view_all_tasks",
        "can_view_team_tasks",
        "can_view_assigned_tasks",
        "can_update_task_status",
        "can_view_project_progress",
    )


# =================================
# 🔹 COMPANY USER INLINE
# =================================
class CompanyUserInline(admin.TabularInline):
    model = CompanyUser
    extra = 0
    fields = ("user", "role", "status")
    readonly_fields = ("invite_token",)


# =================================
# 🔹 COMPANY ADMIN
# =================================
@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "size")
    search_fields = ("name", "email")
    inlines = [RoleInline, CompanyUserInline]


# =================================
# 🔹 ROLE ADMIN
# =================================
@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "company", "level")
    list_filter = ("company",)
    search_fields = ("name",)


# =================================
# 🔹 COMPANY USER ADMIN
# =================================
@admin.register(CompanyUser)
class CompanyUserAdmin(admin.ModelAdmin):
    list_display = ("email", "company", "role", "status")
    list_filter = ("company", "role", "status")
    search_fields = ("user__email",)