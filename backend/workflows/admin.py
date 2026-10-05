from django.contrib import admin

from .models import WorkflowRule, WorkflowRun

admin.site.register(WorkflowRule)
admin.site.register(WorkflowRun)
