from django.db import models


class EmployeeProfile(models.Model):
    company_user = models.OneToOneField(
        "companies.CompanyUser",
        on_delete=models.CASCADE,
        related_name="profile"
    )

    department = models.ForeignKey(
        "Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    designation = models.CharField(max_length=100, blank=True, null=True)

    date_joined = models.DateField(null=True, blank=True)

    salary = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    phone = models.CharField(max_length=15, blank=True, null=True)

    address = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.company_user}"


class Department(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.name} - {self.company.name}"


class Attendance(models.Model):
    company_user = models.ForeignKey(
        "companies.CompanyUser",
        on_delete=models.CASCADE,
        related_name="attendance_records"
    )

    date = models.DateField()
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)

    status_choices = [
        ("PRESENT", "Present"),
        ("ABSENT", "Absent"),
        ("HALF_DAY", "Half Day"),
    ]

    status = models.CharField(
        max_length=20,
        choices=status_choices,
        default="PRESENT"
    )

    class Meta:
        unique_together = ("company_user", "date")


class LeaveRequest(models.Model):

    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
    ]

    company_user = models.ForeignKey(
        "companies.CompanyUser",
        on_delete=models.CASCADE,
        related_name="leave_requests"
    )

    start_date = models.DateField()
    end_date = models.DateField()

    reason = models.TextField()

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PENDING"
    )

    applied_on = models.DateTimeField(auto_now_add=True)


class PerformanceReview(models.Model):

    company_user = models.ForeignKey(
        "companies.CompanyUser",
        on_delete=models.CASCADE,
        related_name="reviews"
    )

    reviewer = models.ForeignKey(
        "companies.CompanyUser",
        on_delete=models.SET_NULL,
        null=True,
        related_name="given_reviews"
    )

    rating = models.IntegerField()  
    feedback = models.TextField()

    review_date = models.DateField(auto_now_add=True)


