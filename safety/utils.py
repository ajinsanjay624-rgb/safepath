import math

from django.utils import timezone

# +1 tags make a place safer, -1 tags make it riskier (shown as reasons in the UI)
TAGS = {"lit": 1, "crowded": 1, "cctv": 1, "police_nearby": 1, "shops_open": 1,
        "dark": -1, "isolated": -1, "harassment": -1, "no_footpath": -1, "drunk_crowd": -1}
NEUTRAL = 3.0       # score used where nobody has rated yet
RADIUS = 150        # metres: a rating counts for route points this close
SPOT_RADIUS = 250   # metres: a safe spot "covers" route points this close


def haversine_m(lat1, lng1, lat2, lng2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(a))


def current_period(hour=None):
    """Night is 7 pm to 6 am (local time)."""
    if hour is None:
        hour = timezone.localtime().hour
    return "night" if hour >= 19 or hour < 6 else "day"


def sample(coords, step=100):
    """Points about every `step` metres along a route."""
    out, carry = [tuple(coords[0])], 0.0
    for (a, b), (c, d) in zip(coords, coords[1:]):
        seg = haversine_m(a, b, c, d)
        if seg == 0:
            continue
        pos = step - carry
        while pos <= seg:
            f = pos / seg
            out.append((a + (c - a) * f, b + (d - b) * f))
            pos += step
        carry = seg - (pos - step)
    out.append(tuple(coords[-1]))
    return out


def score_route(coords, ratings, spots, period, now):
    """Safety score 0-100 for one route, using ratings for the given period (day or night)."""
    pts = sample(coords)
    scores, used, by_id, hit, covered, unrated, prof = [], set(), {}, set(), 0, 0, []
    for p in pts:
        num = den = 0.0
        for r in ratings:
            if abs(r.lat - p[0]) > 0.0016 or abs(r.lng - p[1]) > 0.0016:
                continue
            d = haversine_m(p[0], p[1], r.lat, r.lng)
            if d > RADIUS:
                continue
            # same-period ratings count fully, other period only a little; old ratings fade out
            w = (1 if r.period == period else 0.3) * math.exp(-(now - r.created_at).days / 120) * (1 - 0.5 * d / RADIUS)
            num, den = num + w * r.score, den + w
            used.add(r.id)
            by_id[r.id] = r
        if den > 0.05:
            scores.append(num / den)
            prof.append([round(num / den, 1), 0])
        else:
            scores.append(NEUTRAL)
            prof.append([NEUTRAL, 1])
            unrated += 1
        near = [s.id for s in spots if abs(s.lat - p[0]) < 0.003 and abs(s.lng - p[1]) < 0.003
                and haversine_m(p[0], p[1], s.lat, s.lng) <= SPOT_RADIUS]
        if near:
            covered += 1
            hit.update(near)
    n = len(pts)
    avg = sum(scores) / n
    low = sum(1 for s in scores if s < 2.5) / n
    safety = max(0, min(100, (avg - 1) / 4 * 100 + 10 * covered / n - 15 * low))
    win = [sum(scores[i:i + 3]) / len(scores[i:i + 3]) for i in range(max(1, n - 2))]
    wi = min(range(len(win)), key=win.__getitem__)
    wp = pts[min(wi + 1, n - 1)]
    tags = {}
    for rid in used:
        for t in by_id[rid].tag_list():
            tags[t] = tags.get(t, 0) + 1

    def top(sign):
        return [[t, c] for t, c in sorted(tags.items(), key=lambda x: -x[1]) if TAGS.get(t) == sign][:3]

    return {"safety": round(safety), "label": "Safer" if safety >= 70 else "Moderate" if safety >= 45 else "Risky",
            "avg_rating": round(avg, 1), "unrated_pct": round(100 * unrated / n),
            "spots_near": len(hit), "positives": top(1), "negatives": top(-1),
            "weakest": {"lat": wp[0], "lng": wp[1], "score": round(win[wi], 1)},
            "profile": prof, "step": 100}  # profile: [score, unrated] about every 100 m, used to colour the route
