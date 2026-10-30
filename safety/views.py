import json
import math
import re
from datetime import timedelta

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import F
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import HIDE_AFTER_FLAGS, EmergencyContact, LiveShare, Rating, RatingReport, SafeSpot, SOSAlert
from .utils import TAGS, current_period, haversine_m, score_route


def err(msg, code=400):
    return Response({"error": msg}, status=code)


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def box(lat, lng, r):
    """Rough bounding box filter (r in metres) so we never scan the whole table."""
    dlat = r / 111000
    dlng = r / (111000 * max(0.2, math.cos(math.radians(lat))))
    return {"lat__range": (lat - dlat, lat + dlat), "lng__range": (lng - dlng, lng + dlng)}


def profile(u):
    return {"name": u.first_name, "phone": u.username}


def rating_dict(r, uid=None):
    return {"id": r.id, "street": r.street, "lat": r.lat, "lng": r.lng, "period": r.period,
            "score": r.score, "tags": r.tag_list(), "comment": r.comment, "created_at": r.created_at,
            "own": uid is not None and r.user_id == uid}


def visible():
    """Ratings that have not been hidden by abuse reports."""
    return Rating.objects.filter(flags__lt=HIDE_AFTER_FLAGS)


def add_trail(s, lat, lng):
    """Keep the last 150 breadcrumbs (only when she moved 10 m or more) so family can see the path."""
    try:
        pts = json.loads(s.trail or "[]")
    except ValueError:
        pts = []
    if not pts or haversine_m(pts[-1][0], pts[-1][1], lat, lng) >= 10:
        pts.append([round(lat, 5), round(lng, 5)])
    s.trail = json.dumps(pts[-150:])


def spot_dict(s, origin=None):
    d = {"id": s.id, "name": s.name, "kind": s.kind, "lat": s.lat, "lng": s.lng,
         "phone": s.phone, "open_24h": s.open_24h, "verified": s.verified}
    if origin:
        d["distance_m"] = round(haversine_m(origin[0], origin[1], s.lat, s.lng))
    return d


def open_now(s, period):
    return period == "day" or s.open_24h or s.kind in ("police", "hospital")


# ---------- auth ----------
@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    d = request.data
    phone = str(d.get("phone", "")).strip()
    if not re.fullmatch(r"\d{10}", phone):
        return err("Enter a 10 digit phone number")
    if len(str(d.get("password", ""))) < 6:
        return err("Password must have at least 6 characters")
    if User.objects.filter(username=phone).exists():
        return err("This phone number is already registered")
    u = User.objects.create_user(phone, password=d["password"], first_name=str(d.get("name", ""))[:30])
    return Response({"token": Token.objects.create(user=u).key, "profile": profile(u)}, status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    u = authenticate(username=str(request.data.get("phone", "")).strip(), password=request.data.get("password", ""))
    if not u:
        return err("Wrong phone number or password", 401)
    return Response({"token": Token.objects.get_or_create(user=u)[0].key, "profile": profile(u)})


@api_view(["GET", "PATCH"])
def me(request):
    if request.method == "PATCH" and "name" in request.data:
        request.user.first_name = str(request.data["name"])[:30]
        request.user.save()
    return Response(profile(request.user))


@api_view(["GET", "POST"])
def contacts(request):
    if request.method == "POST":
        name, phone = str(request.data.get("name", "")).strip(), str(request.data.get("phone", "")).strip()
        if not name or not re.fullmatch(r"\+?\d{10,13}", phone):
            return err("Enter a name and a valid phone number")
        if request.user.contacts.count() >= 5:
            return err("You can save up to 5 emergency contacts")
        EmergencyContact.objects.create(user=request.user, name=name[:80], phone=phone)
    return Response([{"id": c.id, "name": c.name, "phone": c.phone} for c in request.user.contacts.all()])


@api_view(["DELETE"])
def delete_contact(request, pk):
    request.user.contacts.filter(pk=pk).delete()
    return Response(status=204)


# ---------- crowd data ----------
@api_view(["GET"])
@permission_classes([AllowAny])
def stats(request):
    """Public numbers for the home screen."""
    return Response({"ratings": visible().count(), "spots": SafeSpot.objects.filter(verified=True).count(),
                     "contributors": Rating.objects.values("user").distinct().count(),
                     "areas": Rating.objects.values("street").distinct().count()})


@api_view(["DELETE"])
def delete_rating(request, pk):
    request.user.ratings.filter(pk=pk).delete()
    return Response(status=204)


@api_view(["POST"])
def report_rating(request, pk):
    """Flag a rating as false or abusive. After HIDE_AFTER_FLAGS different users flag it, it disappears."""
    r = Rating.objects.filter(pk=pk).first()
    if not r:
        return err("Rating not found", 404)
    if r.user_id == request.user.id:
        return err("You cannot report your own rating")
    _, created = RatingReport.objects.get_or_create(user=request.user, rating=r)
    if created:
        Rating.objects.filter(pk=pk).update(flags=F("flags") + 1)
    return Response({"ok": True, "already": not created})


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def ratings(request):
    if request.method == "GET":
        q = request.query_params
        lat, lng = num(q.get("lat")), num(q.get("lng"))
        uid = request.user.id if request.user.is_authenticated else None
        if q.get("mine") == "1":
            if uid is None:
                return err("Please log in", 401)
            qs = Rating.objects.filter(user_id=uid)
        else:
            qs = visible()
        if lat is not None and lng is not None:
            qs = qs.filter(**box(lat, lng, num(q.get("radius")) or 3000))
        if q.get("period") in ("day", "night"):
            qs = qs.filter(period=q["period"])
        return Response([rating_dict(r, uid) for r in qs.order_by("-created_at")[:500]])
    if not request.user.is_authenticated:
        return err("Please log in to add a rating", 401)
    d = request.data
    lat, lng, street = num(d.get("lat")), num(d.get("lng")), str(d.get("street", "")).strip()
    try:
        score = int(d.get("score"))
    except (TypeError, ValueError):
        score = 0
    if lat is None or lng is None or not street:
        return err("Pick a place on the map and enter the street name")
    if not 1 <= score <= 5 or d.get("period") not in ("day", "night"):
        return err("Choose day or night and a score from 1 to 5")
    if Rating.objects.filter(user=request.user, created_at__gte=timezone.now() - timedelta(days=1)).count() >= 20:
        return err("You can add up to 20 ratings a day", 429)
    tags = ",".join(t for t in d.get("tags", []) if t in TAGS)
    r = Rating.objects.create(user=request.user, street=street[:120], lat=lat, lng=lng, period=d["period"],
                              score=score, tags=tags, comment=str(d.get("comment", ""))[:300])
    return Response(rating_dict(r, request.user.id), status=201)


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def spots(request):
    if request.method == "GET":
        q = request.query_params
        lat, lng = num(q.get("lat")), num(q.get("lng"))
        if q.get("mine") == "1":
            if not request.user.is_authenticated:
                return err("Please log in", 401)
            return Response([spot_dict(x) for x in SafeSpot.objects.filter(added_by=request.user).order_by("-created_at")[:50]])
        qs = SafeSpot.objects.filter(verified=True)
        origin = None
        if lat is not None and lng is not None:
            qs, origin = qs.filter(**box(lat, lng, num(q.get("radius")) or 3000)), (lat, lng)
        out = [spot_dict(s, origin) for s in qs[:300]]
        return Response(sorted(out, key=lambda s: s.get("distance_m", 0)))
    if not request.user.is_authenticated:
        return err("Please log in to suggest a safe spot", 401)
    d = request.data
    lat, lng, name = num(d.get("lat")), num(d.get("lng")), str(d.get("name", "")).strip()
    if lat is None or lng is None or not name:
        return err("Pick a place on the map and enter a name")
    kind = d.get("kind") if d.get("kind") in dict(SafeSpot.KINDS) else "other"
    s = SafeSpot.objects.create(name=name[:120], kind=kind, lat=lat, lng=lng, phone=str(d.get("phone", ""))[:20],
                                open_24h=bool(d.get("open_24h")), added_by=request.user)
    return Response(spot_dict(s), status=201)  # stays hidden until an admin verifies it


# ---------- route scoring ----------
@api_view(["POST"])
@permission_classes([AllowAny])
def score_routes(request):
    """Body: {routes: [{coords: [[lat, lng], ...], distance, duration}], period?: day|night, hour?: 0-23}"""
    routes = request.data.get("routes")
    if not isinstance(routes, list) or not 1 <= len(routes) <= 5:
        return err("Send 1 to 5 routes")
    try:
        paths = [[(float(a), float(b)) for a, b in r["coords"]] for r in routes]
    except (KeyError, TypeError, ValueError):
        return err("Each route needs coords as [lat, lng] pairs")
    if any(len(p) < 2 or len(p) > 3000 for p in paths):
        return err("A route needs between 2 and 3000 points")
    period = request.data.get("period")
    if period not in ("day", "night"):
        period = current_period(request.data.get("hour"))
    pts = [pt for p in paths for pt in p]
    s, n = min(p[0] for p in pts), max(p[0] for p in pts)
    w, e = min(p[1] for p in pts), max(p[1] for p in pts)
    m = 0.002
    near = {"lat__range": (s - m, n + m), "lng__range": (w - m, e + m)}
    rs = list(visible().filter(**near)[:3000])
    ss = [x for x in SafeSpot.objects.filter(verified=True, lat__range=(s - 2 * m, n + 2 * m),
                                              lng__range=(w - 2 * m, e + 2 * m)) if open_now(x, period)]
    now, out = timezone.now(), []
    for r, p in zip(routes, paths):
        res = score_route(p, rs, ss, period, now)
        res.update(distance=r.get("distance"), duration=r.get("duration"))
        out.append(res)
    best = max(range(len(out)), key=lambda i: (out[i]["safety"], -(out[i]["duration"] or 0)))
    return Response({"period": period, "routes": out, "best": best})


# ---------- live share and SOS ----------
@api_view(["POST"])
def share_start(request):
    request.user.shares.filter(active=True).update(active=False)
    lat, lng = num(request.data.get("lat")), num(request.data.get("lng"))
    s = LiveShare.objects.create(user=request.user, lat=lat, lng=lng,
                                 trail=json.dumps([[round(lat, 5), round(lng, 5)]]) if lat is not None and lng is not None else "[]")
    return Response({"token": s.token, "expires_at": s.expires_at}, status=201)


@api_view(["POST"])
def share_update(request, token):
    s = LiveShare.objects.filter(token=token, user=request.user, active=True).first()
    lat, lng = num(request.data.get("lat")), num(request.data.get("lng"))
    if not s or lat is None or lng is None:
        return err("Sharing is not active", 404)
    if s.expires_at < timezone.now():
        return err("This share has expired. Start a new one.", 410)
    s.lat, s.lng = lat, lng
    battery = num(request.data.get("battery"))
    if battery is not None:
        s.battery = max(0, min(100, int(battery)))
    add_trail(s, lat, lng)
    s.save()
    return Response({"ok": True})


@api_view(["POST"])
def share_stop(request, token):
    request.user.shares.filter(token=token).update(active=False)
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([AllowAny])
def share_view(request, token):
    """Public: anyone with the link can see the latest location while sharing is on."""
    s = LiveShare.objects.filter(token=token).select_related("user").first()
    if not s:
        return err("Link not found", 404)
    live = s.active and s.expires_at > timezone.now()
    out = {"name": s.user.first_name or "Someone", "active": live}
    if live:
        try:
            trail = json.loads(s.trail or "[]")
        except ValueError:
            trail = []
        out.update(lat=s.lat, lng=s.lng, updated_at=s.updated_at, started_at=s.created_at, expires_at=s.expires_at,
                   battery=s.battery, trail=trail, sos=s.sos_alerts.filter(resolved=False).exists())
    return Response(out)


@api_view(["GET", "POST"])
def sos(request):
    if request.method == "GET":
        return Response([{"id": a.id, "lat": a.lat, "lng": a.lng, "resolved": a.resolved, "created_at": a.created_at}
                         for a in request.user.sos_alerts.order_by("-created_at")[:20]])
    lat, lng = num(request.data.get("lat")), num(request.data.get("lng"))
    if lat is None or lng is None:
        return err("Location is needed to send an SOS")
    request.user.shares.filter(active=True).update(active=False)
    share = LiveShare.objects.create(user=request.user, lat=lat, lng=lng, trail=json.dumps([[round(lat, 5), round(lng, 5)]]))
    alert = SOSAlert.objects.create(user=request.user, lat=lat, lng=lng, share=share,
                                    message=str(request.data.get("message", ""))[:200])
    period = current_period()
    near = [x for x in SafeSpot.objects.filter(verified=True, **box(lat, lng, 5000)) if open_now(x, period)]
    near = sorted((spot_dict(x, (lat, lng)) for x in near), key=lambda x: x["distance_m"])[:3]
    return Response({
        "id": alert.id, "share_token": share.token, "spots": near,
        "contacts": [{"name": c.name, "phone": c.phone} for c in request.user.contacts.all()],
        "helplines": [{"name": "Emergency", "number": "112"}, {"name": "Women helpline", "number": "1091"}],
    }, status=201)


@api_view(["POST"])
def sos_resolve(request, pk):
    a = request.user.sos_alerts.filter(pk=pk).select_related("share").first()
    if not a:
        return err("Not found", 404)
    a.resolved = True
    a.save()
    if a.share:  # "I'm safe" also ends the live link
        a.share.active = False
        a.share.save()
    return Response({"resolved": True})
