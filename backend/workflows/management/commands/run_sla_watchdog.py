from django.core.management.base import BaseCommand

from workflows.tasks import run_sla_watchdog


class Command(BaseCommand):
    help = "Evaluate overdue task workflow rules immediately."

    def handle(self, *args, **options):
        executed_count = run_sla_watchdog.run()
        self.stdout.write(self.style.SUCCESS(f"SLA watchdog executed {executed_count} workflow action(s)."))
