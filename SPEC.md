# Qevrion: product spec, v0.0.1

## 1. What it is

A personal iOS app for someone with a lot of events on their plate (about 100 right now, mostly from Partiful). It pulls them into one place, reminds you at the right moments, shows what each event is about at a glance, and guides you to the venue on foot with a camera view that points the way.

Open source (MIT) so anyone can build it for their own phone.

## 2. Constraints that shape everything

These are fixed for v0.0.1. Facts marked "verify" were true when this spec was written (October 2026) and must be re-checked in Round 0.

| Constraint | What it means for the build |
|---|---|
| Windows only, no Mac | Xcode can't run. Day-to-day development and testing happens in Expo Go on the iPhone. |
| Expo Go supports one SDK version at a time | The App Store version of Expo Go has lagged behind the newest Expo SDK (it supported SDK 54 in mid-2026; verify). The project must be created on whichever SDK the App Store Expo Go supports. |
| $0 budget, free Apple ID | Cloud builds for a real iPhone through EAS need the paid Apple Developer Program ($99/year). The free route is: build an unsigned `.ipa` on a GitHub Actions macOS runner (free for public repos), then sign and install it from Windows with a sideloading tool. Apps signed with a free Apple ID stop opening after 7 days and must be re-signed, and only 3 such apps can be installed at once. |
| Free Apple ID cannot do remote push | Every reminder is a local notification scheduled on the device. |
| iOS keeps at most 64 pending local notifications per app | With ~100 events and several reminders each, the app needs a rolling scheduler (section 8). |
| Partiful has no official public API | Import goes through the iOS calendar. Partiful's app has a setting to automatically add your events to your Apple, Google or Outlook calendar. Also support `.ics` files and manual entry. |
| ARKit is not available inside Expo Go | v0.0.1 "AR Walk" is a live camera view with a 3D-looking arrow driven by GPS and compass. It points toward the next turn. It is not lane-accurate: city GPS is often off by 5 to 15 m and the compass drifts near metal. True ARKit world tracking is a later version. |
| No free LLM API that is safe to ship in a public app | "Key details" are extracted on-device with rules, not AI. AI summaries are a later version with a bring-your-own-key setting. |

## 3. Stack

- Expo, React Native, TypeScript strict, Expo Router (file-based navigation).
- Storage: `expo-sqlite`. Secrets: `expo-secure-store`.
- Calendar import: `expo-calendar`. File import: `expo-document-picker` plus an ICS parser that is pure JavaScript.
- Notifications: `expo-notifications` (local only).
- Location and compass: `expo-location` (position, heading, geocoding). Motion: `expo-sensors`.
- Map: `react-native-maps` (Apple Maps on iOS, no key needed).
- Camera: `expo-camera`.
- Animation: `react-native-reanimated`. Haptics: `expo-haptics`.
- Tests: Jest for logic (parsers, scheduler, geo maths).

Every one of these must be confirmed to work in Expo Go on the chosen SDK before use.

### Free external services

| Need | Service | Key | Notes |
|---|---|---|---|
| Address to coordinates | iOS built-in geocoder via `expo-location` | none | Rate limited. Geocode lazily, one at a time, cache in the database. |
| Walking route | openrouteservice, foot-walking profile | free key, user pastes it in Settings | Free plan allows 2,000 direction requests a day (verify). Cache routes. |
| Weather | Open-Meteo | none | Only for events in the next 14 days. |
| Repo, CI, website hosting | GitHub, GitHub Actions, GitHub Pages | free for public repos | |

If no openrouteservice key is set, the app still works: it shows straight-line direction and distance, and offers "Open in Apple Maps" and "Open in Google Maps".

## 4. Features for v0.0.1

### F1. Event library
- Home shows the next event as a large hero card with a live countdown, then "This week", then later events grouped by month.
- Search by title, venue, host. Filter chips: All, Today, This week, Has conflicts, Partiful.
- Past events move to an Archive view.
- Done when: 100+ events scroll smoothly and the next event is always correct after the clock passes an event's start.

### F2. Import
- From iOS Calendar: choose which calendars to read, date range (30 days back to 12 months ahead), and an optional "only events with a partiful.com link" switch.
- From an `.ics` file.
- Manual add and edit.
- Re-sync on app open and on pull-to-refresh. Match by the calendar's event id; fall back to title + start time. Never overwrite my notes, checklist, tags or custom reminders. If an event disappears from the calendar, mark it "Removed from calendar" instead of deleting it.
- If an event contains a `partiful.com` link, tag it as Partiful and show an "Open in Partiful" button.
- Done when: importing the same calendar twice creates zero duplicates.

### F3. Reminders
- Default reminders per event: 1 day before, 2 hours before, 30 minutes before. Editable globally and per event.
- Morning digest at 8:00 on days with events ("3 events today, first at 6:30 PM").
- Sunday 6:00 PM preview of the coming week.
- Tapping a notification opens that event.
- See section 8 for the scheduler rules.

### F4. Event detail and key details
- Cover area, title, date and time in my time zone, venue with small map, host, full description, link.
- "Key details" chips extracted from the description by rules: schedule lines with times, dress code, what to bring, cost or tickets, age limit, parking, food and drink, RSVP deadline, links.
- My notes and a simple prep checklist.
- Weather forecast for the event time if it's within 14 days.
- Conflict warning when two events overlap, and a "tight gap" warning when there's under 45 minutes between the end of one and the start of the next at a different venue.

### F5. Navigate
- Map card with my position, the venue, and the walking route.
- Stats: distance, walking time, "leave by" time.
- Buttons: "Start AR Walk", "Open in Apple Maps" and "Open in Google Maps". The two map buttons are plain links that hand the address to the other app (Google Maps falls back to its website if the app is not installed). No Google SDK and no key.

### F6. AR Walk
- Full-screen rear camera. An arrow that looks anchored to the ground rotates to point toward the next turn on the route (or straight to the venue if no route).
- Top: distance to next turn and the instruction text. Bottom sheet: total distance left, arrival time, "End".
- Haptic tap when a turn is close and when I arrive (within about 25 m).
- Smooth the compass heading so the arrow doesn't jitter.
- A "low accuracy" banner when GPS accuracy is worse than about 30 m or the compass needs calibration.
- On first use, a one-time safety note: keep your eyes on the road, not the screen.
- Keep the screen awake while active. Stop sensors when the screen closes.

### F7. Settings
- Import sources, default reminders, digest toggles and times, openrouteservice key, units (mi or km), "Delete all data", version number, link to the GitHub repo.

### F8. Onboarding
- Splash with the Qevrion mark.
- Three short screens: what it does, import your events, turn on reminders. Each has one primary button and a "Not now".

## 5. Screens

1. Splash
2. Onboarding (3 pages)
3. Home (Upcoming) with search and filters
4. Archive
5. Event detail
6. Add / edit event
7. Import (source picker, calendar picker, result summary: added, updated, skipped)
8. Navigate (map + stats)
9. AR Walk
10. Settings

Bottom bar with two text tabs, "UPCOMING" and "ARCHIVE", and a profile/settings icon on the right.

## 6. Design system

Dark-first, calm, premium. The screenshots in `design-refs/` set the mood. Borrow the feel, not the assets.

### What to take from each reference
- Splash on near-black with one centred mark: Qevrion splash.
- Full-bleed image, large light-weight headline, one wide pill button, outlined secondary button: onboarding.
- Wordmark top-left, small dark pill and light pill top-right, uppercase section labels, photo card with serif title and a "3d 8h left" countdown, text tabs at the bottom: Home.
- Rounded map card with a blue route line, green start dot, red end dot, and a two-column stat grid with small uppercase labels: Navigate.
- Grouped cards with a title, grey subtitle and blue status text, one selected card with a bright outline: Settings and Import.
- Chat screen with suggestion pills: saved for a later "Ask Qevrion" feature.

### Tokens (starting values; tune by eye against the references)

| Token | Value |
|---|---|
| Background | `#0E0E10` |
| Surface | `#1A1B20` |
| Surface raised | `#24262C` |
| Hairline border | white at 8% |
| Text primary | `#F2EFEA` (warm off-white) |
| Text secondary | `#A3A3AB` |
| Text tertiary | `#6B6B73` |
| Primary button | background `#F4ECE8`, text `#111111`, height 56, fully rounded |
| Secondary button | transparent, 1 px white at 25%, text primary |
| Accent (route, links, status) | `#4FB3E8` |
| Start / success | `#7ED321` |
| End / destructive | `#F0564A` |
| Top glow | soft radial gradient of slate blue `#2B4256` fading to transparent behind headers |

- Type: a serif display face for event titles and big moments (for example Instrument Serif or Fraunces, both free). A clean sans for everything else (for example Inter). Large headings are light weight, 32 to 36 pt. Body 16 to 17 pt. Section labels are 12 pt, uppercase, wide letter-spacing, tertiary colour.
- Shape: cards radius 24, inner elements 16, buttons fully rounded. Screen padding 20 to 24. 4-pt spacing grid.
- Motion: gentle springs, nothing bouncy. Light haptic on primary actions.
- Accessibility: support Dynamic Type, VoiceOver labels on every control, contrast of at least 4.5:1 for body text, tap targets at least 44 pt.
- Logo: an original mark. A ring with a short diagonal tail that reads as both a "Q" and a compass needle. It must not resemble any logo in the references. Deliver as SVG plus app icon and splash assets.
- Dark theme only in v0.0.1, but keep every colour in one theme file so a light theme can be added later.

## 7. Data model

**Event**: id, source (`calendar` | `ics` | `manual`), sourceId, title, startsAt, endsAt, allDay, timeZone, locationText, lat, lng, geocodeStatus, url, host, description, isPartiful, tags, notes, checklist, keyDetails (derived), reminderOffsets (null means use defaults), removedFromSource, createdAt, updatedAt, lastSyncedAt.

**Settings**: defaultOffsets, digestEnabled, digestTime, weeklyPreviewEnabled, importCalendarIds, onlyPartifulLinks, units, onboardingDone. The openrouteservice key is in secure storage, not in SQLite.

**ScheduledNotification**: id, eventId (or null for digests), kind, fireAt, osNotificationId.

Store times in UTC, display in the device time zone. Use migrations from the first version of the schema.

## 8. Reminder scheduler rules

1. Build the full list of future fire times: every event's reminders, plus digests.
2. Sort by time. Schedule only the nearest 60 with iOS. Record them in `ScheduledNotification`.
3. Re-run the scheduler: on app open, after any import, after any event or settings edit, and when a notification is tapped.
4. Re-running must be idempotent: cancel and replace only what changed.
5. Because background execution is unreliable in Expo Go, the daily digest doubles as a nudge to open the app so the window rolls forward. Say this plainly in Settings: "Open Qevrion every few days so later reminders get scheduled."
6. Unit-test this logic with 150 fake events.

## 9. Geo maths for Navigate and AR Walk

- Bearing and distance with the haversine formula.
- Arrow rotation = bearing to the next waypoint minus smoothed device heading (use true heading when available).
- Advance to the next waypoint when within about 15 m of the current one.
- Off-route: if more than about 40 m from the route line for 10 seconds, request a new route (respect the daily quota; at most one re-route per 30 seconds).
- Start the arrow as a 2D chevron with perspective transforms. Only move to a real 3D scene if that looks flat on the device.

## 10. Not in v0.0.1 (backlog)

True ARKit world tracking and geo anchors; home-screen widgets and Live Activities; remote push; AI summaries and an "Ask Qevrion" chat (bring your own key); adding events from the share sheet; reading invite emails; travel-time-aware "leave now" alerts; photos and memories per event; light theme; Android.

## 11. Repo and website

- Public GitHub repo `qevrion`, MIT licence, README with screenshots and "build it for your own phone" steps, CHANGELOG, issue templates.
- A one-page landing site in `/site`, plain HTML and CSS in the same visual style, deployed to GitHub Pages by a GitHub Action: what it is, three features, screenshots, link to the repo and install guide.
