"""Shared, efficient query shapes for task API responses."""


def with_task_relations(queryset):
    """Avoid per-row user/project lookups during task serialization."""
    return queryset.select_related(
        "company",
        "project",
        "assigned_to__user",
        "assigned_to__role",
        "created_by__user",
        "created_by__role",
    )
