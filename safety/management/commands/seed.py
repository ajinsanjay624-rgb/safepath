from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from safety.models import EmergencyContact, Rating, SafeSpot

# (street, lat, lng, day score, night score, day tags, night tags): demo data around Chennai
STREETS = [
    ("Marina Beach Road", 13.0500, 80.2824, 4, 2, "crowded,lit", "dark,isolated"),
    ("Anna Salai, Teynampet", 13.0436, 80.2507, 5, 4, "crowded,lit,shops_open", "lit,cctv"),
    ("Usman Road, T. Nagar", 13.0418, 80.2341, 4, 4, "crowded,shops_open", "lit,crowded,shops_open"),
    ("2nd Avenue, Besant Nagar", 13.0003, 80.2667, 5, 3, "crowded,lit", "lit,drunk_crowd"),
    ("Gandhi Nagar, Adyar", 13.0063, 80.2574, 4, 3, "lit", "lit"),
    ("Velachery Main Road", 12.9815, 80.2180, 4, 2, "crowded,shops_open", "dark,no_footpath"),
    ("Guindy Industrial Estate road", 13.0067, 80.2206, 3, 1, "no_footpath", "dark,isolated,harassment"),
    ("ECR, Thiruvanmiyur", 12.9830, 80.2594, 4, 2, "lit", "dark,isolated"),
    ("Luz Church Road, Mylapore", 13.0368, 80.2676, 5, 4, "crowded,shops_open", "lit,crowded"),
    ("Pantheon Road, Egmore", 13.0732, 80.2609, 4, 4, "lit,police_nearby", "lit,police_nearby,cctv"),
    ("Anna Nagar 2nd Avenue", 13.0850, 80.2101, 5, 4, "crowded,lit,shops_open", "lit,cctv"),
    ("Nungambakkam High Road", 13.0569, 80.2425, 5, 4, "crowded,lit,cctv", "lit,crowded"),
    ("Kodambakkam Station Road", 13.0521, 80.2255, 4, 3, "crowded,shops_open", "lit,drunk_crowd"),
    ("Saidapet Bridge Road", 13.0213, 80.2231, 3, 2, "crowded", "dark,isolated"),
    ("Kotturpuram Bridge Road", 13.0243, 80.2410, 4, 3, "lit", "dark"),
    ("Alwarpet CP Ramaswamy Road", 13.0339, 80.2519, 5, 4, "lit,crowded,cctv", "lit,cctv"),
    ("Central Station Approach", 13.0827, 80.2757, 4, 3, "crowded,police_nearby", "crowded,police_nearby,drunk_crowd"),
    ("Koyambedu Bus Terminus road", 13.0694, 80.1948, 4, 3, "crowded,shops_open", "lit,crowded"),
    ("Sholinganallur OMR service road", 12.9010, 80.2279, 4, 2, "lit,crowded", "dark,no_footpath,isolated"),
    ("Besant Nagar Elliots Beach road", 13.0006, 80.2733, 5, 3, "crowded,lit", "dark,drunk_crowd"),
]
# (name, kind, lat, lng, phone, open 24h): demo points, not real listings
SPOTS = [
    ("Demo Police Booth, Adyar", "police", 13.0075, 80.2570, "100", True),
    ("Demo Government Hospital, Egmore", "hospital", 13.0720, 80.2610, "108", True),
    ("Demo 24h Pharmacy, T. Nagar", "pharmacy", 13.0412, 80.2335, "", True),
    ("Demo Police Booth, Marina", "police", 13.0510, 80.2820, "100", True),
    ("Demo Cafe, Besant Nagar", "cafe", 13.0010, 80.2662, "", False),
    ("Demo Police Booth, T. Nagar", "police", 13.0430, 80.2340, "100", True),
    ("Demo 24h Store, Anna Nagar", "shop", 13.0860, 80.2105, "", True),
    ("Demo Hospital, Nungambakkam", "hospital", 13.0600, 80.2430, "108", True),
    ("Demo Police Booth, Central", "police", 13.0825, 80.2750, "100", True),
    ("Demo 24h Pharmacy, Velachery", "pharmacy", 12.9810, 80.2185, "", True),
    ("Demo Police Booth, Guindy", "police", 13.0075, 80.2210, "100", True),
]


class Command(BaseCommand):
    help = "Create demo ratings, safe spots and a demo user"

    def handle(self, *a, **k):
        crowd, _ = User.objects.get_or_create(username="9000000099", defaults={"first_name": "Community"})
        for st, la, ln, ds, ns, dt, nt in STREETS:
            if not Rating.objects.filter(street=st).exists():
                Rating.objects.create(user=crowd, street=st, lat=la, lng=ln, period="day", score=ds, tags=dt)
                Rating.objects.create(user=crowd, street=st, lat=la, lng=ln, period="night", score=ns, tags=nt)
        for n, kd, la, ln, ph, o in SPOTS:
            if not SafeSpot.objects.filter(name=n).exists():
                SafeSpot.objects.create(name=n, kind=kd, lat=la, lng=ln, phone=ph, open_24h=o, verified=True)
        u, _ = User.objects.get_or_create(username="9000000001", defaults={"first_name": "Priya"})
        u.set_password("demo1234")
        u.save()
        if not u.contacts.exists():
            EmergencyContact.objects.create(user=u, name="Amma", phone="9000000011")
            EmergencyContact.objects.create(user=u, name="Anna", phone="9000000012")
        self.stdout.write(self.style.SUCCESS("Seeded. Demo user 9000000001 / demo1234"))
