from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("workflows", "0001_initial")]

    operations = [
        migrations.AlterField(
            model_name="workflowrule",
            name="trigger",
            field=models.CharField(
                choices=[("TASK_UPDATED", "Task updated"), ("TASK_OVERDUE", "Task overdue")],
                default="TASK_UPDATED",
                max_length=40,
            ),
        ),
    ]
