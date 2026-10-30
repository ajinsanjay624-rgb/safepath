# SafePath Pro: Women Safety Route Planner (Project 13)

Compares walking or cab routes by a **safety score** built from crowd-sourced street ratings, scored **separately for day and night**. React + Leaflet front end, Django REST back end (SQLite by default, MySQL optional).

## What is new in this version
**Look and feel**: colourful gradient theme, dark mode (toggle in the header), CARTO map tiles that switch with the theme, animated SOS button, toasts, bottom navigation on phones and a top navigation bar on desktop, loading and empty states everywhere.

**New features**
- **Home dashboard**: greeting, "your area right now" safety gauge, quick actions, community stats, recent ratings and nearest open safe places
- **Route colouring**: the selected route is painted stretch by stretch (green safe, amber okay, red risky, grey not rated), with a mini safety strip on every route card and a legend
- **Day vs night on every route**: each card also shows what the route scores in the other period; changing Day/Night re-scores instantly
- **Safety heatmap**, rating dots and safe-spot layers with toggle switches
- **Search as you type** for places, swap start and destination, recent trips, "Navigate in Google Maps", copy route summary
- **Safe-arrival timer**: start a trip (or a 15 to 90 minute timer). Not confirmed in time, you get 30 seconds to say "I'm safe", then SOS starts
- **Fake incoming call** (with ringtone) and **panic siren**, no audio files needed
- **SOS upgrades**: works for guests (direct 112/1091 calls), "Send now", siren, "I'm safe now" which resolves the alert and stops sharing
- **Live link upgrades**: family sees the path travelled (dotted trail), battery level, time left and a flashing SOS banner
- **Contribute upgrades**: tap the map and the street name fills itself, see nearby ratings, report false/abusive ratings (3 reports hide a rating), view and delete your own ratings, see the review status of your suggested spots
- **Safety tab**: helplines (112, 1091, 181, 100, 108, 1930), tips, SOS history
- Admin: ratings show abuse flags, with actions to hide or restore

**Fixes**: ratings and street names are now escaped in map popups (they were an XSS risk), a stale login token no longer breaks public pages, SQLite is now the default so no MySQL is needed to start.

## Run it
### 1. Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
python manage.py makemigrations safety
python manage.py migrate
python manage.py seed             # demo ratings, safe spots and a demo user around Chennai
python manage.py createsuperuser  # optional, for /admin/
python manage.py runserver        # http://127.0.0.1:8000
```
**Upgrading from the old version?** Delete the old `db.sqlite3` (or run `makemigrations` + `migrate`) because new fields were added.

**Want MySQL?** `pip install -r requirements-mysql.txt`, create the database `safepath`, then set `USE_MYSQL=1`, `DB_USER`, `DB_PASSWORD` before the commands above. On Ubuntu, if `mysqlclient` fails: `sudo apt install libmysqlclient-dev pkg-config`.

### 2. Frontend (second terminal)
```bash
cd frontend
npm install
npm run dev                       # http://localhost:5173
```
Allow location access in the browser. Demo login: **9000000001 / demo1234** (route planning works without logging in).

Try it: Start "Adyar", Destination "T Nagar", press Find, then switch between Day and Night. To approve suggested safe spots open `http://127.0.0.1:8000/admin/` > Safe spots > "Mark selected spots as verified".

## How the score works (`backend/safety/utils.py`)
1. The route is sampled about every 100 m.
2. Each point averages nearby ratings (within 150 m). Same-period ratings weigh 1.0, other-period 0.3, and weight fades with age (120 day scale) and distance. Ratings hidden by abuse reports are ignored.
3. Points with no ratings get a neutral 3.0 and count as "unrated".
4. Score = average rating mapped to 0-100, plus up to +10 for points covered by a verified safe spot open in that period (within 250 m), minus up to -15 for the share of points rated below 2.5.
5. 70+ "Safer", 45+ "Moderate", below that "Risky". The API also returns a per-point `profile` used to colour the route.

## API (`/api`, token auth: `Authorization: Token <key>`; public ones marked *)
| Method | Path | Purpose |
|---|---|---|
| POST | auth/register/, auth/login/ * | Account |
| GET, PATCH | me/ | Profile |
| GET * | stats/ | Home page numbers |
| GET, POST | contacts/ ; DELETE contacts/{id}/ | Emergency contacts (max 5) |
| GET * , POST | ratings/ (`?lat&lng&radius&period&mine=1`) | Read or add ratings |
| DELETE | ratings/{id}/ | Delete your own rating |
| POST | ratings/{id}/report/ | Report a rating (3 reports hide it) |
| GET * , POST | spots/ (`?mine=1`) | Verified safe spots; suggest a spot |
| POST * | routes/score/ | `{routes:[{coords,distance,duration}], period?}` returns scores, `profile`, `best` |
| POST | share/start/, share/{token}/update/, share/{token}/stop/ | Live share (update accepts `battery`) |
| GET * | share/{token}/ | Latest location, trail and battery for anyone with the link |
| GET, POST | sos/ ; POST sos/{id}/resolve/ | SOS alerts ("I'm safe" also ends the share) |

## Good to know
- **External services**: routes from `routing.openstreetmap.de`, place search and street names from Nominatim, tiles from CARTO/OpenStreetMap. All are free for light use only; use your own or a paid provider for a real launch.
- **SOS sends no SMS by itself**: it opens your phone's SMS, WhatsApp and dialer with the message ready. A production version should add a server-side SMS gateway (Twilio, MSG91) and push notifications.
- **Fake call and the timer run in the open browser tab**; a native app would be needed for them to fire with the screen locked.
- **Safety and privacy**: this app supports decisions, it does not replace emergency services (call 112). Live links are secret URLs that expire after 6 hours; use HTTPS before real use and moderate ratings. Seed data is demo data.

## Structure
```
backend/safepath/   Django settings and URLs
backend/safety/     models, views, utils.py (scoring), admin, seed command
frontend/src/       App, MapView, PlaceInput, SOS, TripBar, FakeCall, sound, ui, labels
frontend/src/pages/ Home, Plan, Contribute, Share, Safety, Auth, Track (public link)
```
