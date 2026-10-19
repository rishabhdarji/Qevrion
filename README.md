<div align="center">

# Qevrion

**Every event you've said yes to, in one calm place.**

Reminders at the right moment, the key details at a glance,<br>
and a camera view that walks you to the door.

[![CI](https://github.com/rishabhdarji/Qevrion/actions/workflows/ci.yml/badge.svg)](https://github.com/rishabhdarji/Qevrion/actions/workflows/ci.yml)
![Version](https://img.shields.io/badge/version-0.0.1-F4ECE8?labelColor=0E0E10)
![Expo SDK](https://img.shields.io/badge/Expo%20SDK-57-4FB3E8?labelColor=0E0E10)
![Platform](https://img.shields.io/badge/iOS-16.4%2B-7ED321?labelColor=0E0E10)

</div>

> [!NOTE]
> **Early days.** Qevrion is being built in the open, one round at a time. Rounds 0 to 2 are done and eight more follow. Today you can add, edit and delete events by hand, each with its own photo; they are stored on the phone, and the countdown to the next one, search, filters and the archive all work on them. Nothing is imported yet, there are no reminders, and the map and AR Walk are mock-ups. Everything under "What it will do" is the plan, not what is in the code yet. [STATUS.md](STATUS.md) always says what actually works.

## Why

Invites pile up. They live in different apps, the details are buried in long descriptions, and the reminder you needed never comes at the right time. Qevrion is a personal iOS app for people with a lot of events on their plate: it pulls them into one list, tells you what each one is about, and gets you there on foot.

## What it will do

| | |
|---|---|
| **One library** | Your next event as a large card with a live countdown, then this week, then the months ahead. Search and filters. Past events move to an archive. |
| **Import, not retyping** | Bring events in from the iOS Calendar, an `.ics` file, or by hand. Re-syncing never creates duplicates and never overwrites your notes. |
| **Reminders that fit** | A day before, two hours before, thirty minutes before. A morning digest on days with events and a Sunday preview of the week. |
| **Key details at a glance** | Dress code, what to bring, cost, parking, schedule and RSVP deadline, pulled out of the description on your phone. |
| **Navigate** | A map with the walking route, the distance, the walking time and a "leave by" time. |
| **AR Walk** | A live camera view with an arrow on the ground that points to your next turn. |

## Principles

- **Local-first.** Your events live in a database on your phone. There is no backend, no account and no analytics.
- **Free to build and run.** No paid services and nothing that needs a credit card.
- **Asks only when it has to.** Each permission is requested at the moment it is needed, with a reason, and the app stays usable if you say no.
- **Honest about its limits.** See below.

## Roadmap

| Round | What gets built | Status |
|:---:|---|---|
| 0 | Preflight and hello world | **Done** |
| 1 | Design system and app shell | **Done** |
| 2 | Database and manual events | **Done** |
| 3 | Import from Calendar and `.ics` | Built, being checked |
| 4 | Map and walking route | Planned |
| 5 | AR Walk | Planned |
| 6 | Reminders | Planned |
| 7 | Key details, weather, conflicts | Planned |
| 8 | Polish, tests and the v0.0.1 release | Planned |
| 9 | Landing website | Planned |
| 10 | Install as a standalone app | Planned |

## Honest limitations

- **iPhone only, inside Expo Go, for now.** It runs on any iPhone that can run Expo Go (iOS 16.4 or later). A standalone install is the last round.
- **AR Walk is not true AR.** It is a camera view with an arrow driven by GPS and the compass. City GPS is often off by 5 to 15 metres and the compass drifts near metal, so it points you toward the next turn rather than tracing the pavement.
- **Reminders are scheduled on the phone.** iOS holds a limited number of pending notifications per app, so with many events you need to open Qevrion every few days for later reminders to be scheduled.
- **No direct Partiful connection.** Partiful has no public API, so its events arrive through your phone's calendar.
- **No AI.** Key details are found with rules, on the device. When the rules find nothing, the app shows nothing rather than guessing.

## Run it on your iPhone

You need Node 22.13 or newer, the Expo Go app from the App Store, a free Expo account, and your computer and phone on the same Wi-Fi. Windows, macOS and Linux all work. You do not need a Mac or Xcode.

```bash
git clone https://github.com/rishabhdarji/Qevrion.git
cd Qevrion
npm install
npx expo login
npx expo start
```

Sign in to the same Expo account inside Expo Go, then scan the QR code from the terminal with the iPhone camera. If the phone can't reach your computer, start the server with `npx expo start --tunnel` instead.

Expo Go supports one SDK version at a time. This project is on SDK 57, which is what the App Store version of Expo Go runs today.

## Tech stack

| | |
|---|---|
| **In the code today** | Expo SDK 57, React Native 0.86, TypeScript in strict mode, Expo Router |
| **Planned, per the spec** | SQLite for storage, local notifications, the iOS calendar, Apple Maps, the camera, GPS and compass |
| **Free services, planned** | openrouteservice for walking routes (bring your own free key), Open-Meteo for weather |
| **Checks** | `npm run typecheck`, `npm run lint` and `npm run test:zones` (the tests, in six time zones), run by GitHub Actions on every push |

## Follow the build

- [SPEC.md](SPEC.md): what Qevrion is meant to be, feature by feature.
- [STATUS.md](STATUS.md): what works today, what is stubbed, and the decisions made so far.
- [LOGBOOK.md](LOGBOOK.md): a plain-language log of every step.
- [docs/DESIGN_NOTES.md](docs/DESIGN_NOTES.md): the look and feel, and why.

## Licence

Qevrion will be released under the MIT licence. The licence file is added with the v0.0.1 release.
