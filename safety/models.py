import uuid
from datetime import timedelta

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


def new_token():
    return uuid.uuid4().hex


def in_six_hours():
    return timezone.now() + timedelta(hours=6)


class Rating(models.Model):
    """A crowd-sourced safety rating for one place, for either day or night."""
    PERIODS = [("day", "Day"), ("night", "Night")]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="ratings")
    street = models.CharField(max_length=120)
    lat = models.FloatField(db_index=True)
    lng = models.FloatField(db_index=True)
    period = models.CharField(max_length=5, choices=PERIODS)
    score = models.PositiveSmallIntegerField(help_text="1 (unsafe) to 5 (very safe)")
    tags = models.CharField(max_length=200, blank=True, help_text="comma separated")
    comment = models.CharField(max_length=300, blank=True)
    flags = models.PositiveSmallIntegerField(default=0, help_text="abuse reports; hidden at HIDE_AFTER_FLAGS")
    created_at = models.DateTimeField(auto_now_add=True)

    def tag_list(self):
        return [t for t in self.tags.split(",") if t]

    def __str__(self):
        return f"{self.street} {self.period} {self.score}"


HIDE_AFTER_FLAGS = 3  # a rating reported by this many different users is hidden from maps and scores


class RatingReport(models.Model):
    """One abuse report per user per rating."""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    rating = models.ForeignKey(Rating, on_delete=models.CASCADE, related_name="reports")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "rating")


class SafeSpot(models.Model):
    """Police booths, hospitals, 24h shops etc. Only verified spots count in route scores."""
    KINDS = [("police", "Police"), ("hospital", "Hospital"), ("pharmacy", "Pharmacy"),
             ("shop", "Shop"), ("cafe", "Cafe"), ("other", "Other")]
    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=10, choices=KINDS, default="other")
    lat = models.FloatField(db_index=True)
    lng = models.FloatField(db_index=True)
    phone = models.CharField(max_length=20, blank=True)
    open_24h = models.BooleanField(default=False)
    verified = models.BooleanField(default=False)
    added_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class EmergencyContact(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="contacts")
    name = models.CharField(max_length=80)
    phone = models.CharField(max_length=15)


class LiveShare(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="shares")
    token = models.CharField(max_length=32, unique=True, default=new_token)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    active = models.BooleanField(default=True)
    battery = models.PositiveSmallIntegerField(null=True, blank=True)
    trail = models.TextField(default="[]", help_text="JSON list of [lat, lng] breadcrumbs")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(default=in_six_hours)


class SOSAlert(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sos_alerts")
    lat = models.FloatField()
    lng = models.FloatField()
    message = models.CharField(max_length=200, blank=True)
    share = models.ForeignKey(LiveShare, null=True, blank=True, on_delete=models.SET_NULL, related_name="sos_alerts")
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
