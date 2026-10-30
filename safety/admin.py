from django.contrib import admin
from .models import EmergencyContact, LiveShare, Rating, RatingReport, SafeSpot, SOSAlert


@admin.register(SafeSpot)
class SafeSpotAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "open_24h", "verified", "added_by", "created_at")
    list_filter = ("verified", "kind", "open_24h")
    actions = ["verify"]

    @admin.action(description="Mark selected spots as verified")
    def verify(self, request, qs):
        qs.update(verified=True)


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ("street", "period", "score", "tags", "flags", "user", "created_at")
    list_filter = ("period", "score", "flags")
    search_fields = ("street", "comment")
    actions = ["clear_flags", "hide"]

    @admin.action(description="Clear abuse flags (show again)")
    def clear_flags(self, request, qs):
        qs.update(flags=0)

    @admin.action(description="Hide selected ratings (set flags to 3)")
    def hide(self, request, qs):
        qs.update(flags=3)


@admin.register(SOSAlert)
class SOSAdmin(admin.ModelAdmin):
    list_display = ("user", "lat", "lng", "resolved", "created_at")
    list_filter = ("resolved",)
    actions = ["resolve"]

    @admin.action(description="Mark selected alerts as resolved")
    def resolve(self, request, qs):
        qs.update(resolved=True)


admin.site.register(EmergencyContact)
admin.site.register(LiveShare)
admin.site.register(RatingReport)
