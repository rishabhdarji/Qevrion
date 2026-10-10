# Qevrion status

Last updated: Round 1 complete, confirmed on the iPhone in Expo Go (10 Oct 2026). Version 0.0.1.

**Waiting on the owner:** the branch `round-1-maps-and-reorder` (the "Open in Google Maps" button and the new round order) is not in `main` yet. Merge it into `main` and push once the owner confirms the Google Maps button on the phone, and before starting Round 2. Then delete this note.

## What works

- Expo SDK 57 project with TypeScript (strict) and Expo Router. Round 0 was confirmed on the iPhone in Expo Go on 10 Oct 2026.
- **Design system (Round 1).** `src/theme.ts` holds every colour, size, corner radius, type style and spring. Inter and Instrument Serif load at start-up. Components live in `src/components/`: `Screen` (optional top glow, pinned footer), `PrimaryButton`, `SecondaryButton`, `Pill`, `SectionLabel`, `Card` with `ListRow`, `EventHeroCard` (live countdown), `EventRow`, `StatGrid`, `Chip`, `EmptyState`, plus helpers `Txt`, `Icon`, `QevrionMark`, `SampleBadge`, `ScreenHeader`, `PressableScale`, `EventCover`, `Fade`, `StepBars`.
- **The Qevrion mark.** An open ring with a diagonal tail through the gap (option B, chosen by the owner). Source is `assets/mark.svg`; `npm run icons` redraws the app icon and launch image from it.
- **All ten screens, navigable, on sample data.** Splash, onboarding (3 pages), Home with search and filter chips, Archive, event detail, add/edit, import (3 steps), Navigate, AR Walk, Settings. A component gallery opens from Settings, Developer.
- **Home and Archive** render one flat list built by `src/lib/homeItems.ts` (hero, then "This week", then months; a single results list when searching or filtering). The hero moves on to the next event when one ends.
- **Checks.** `npm run typecheck`, `npm run lint`, `npm test` (11 tests: countdown text and list building) and `npx expo-doctor` pass. An iOS bundle exports cleanly. Every screen was opened in the desktop web preview with no errors and no layout overflow at phone width.

## What is stubbed or missing

Round 1 is look and navigation only. These are placeholders, each marked in the code with a `ponytail:` comment naming the round that makes it real:

- **Events are invented samples** (`src/data/sampleEvents.ts`), each labelled "Sample". Screens read them through `useEvents()` and `useEvent()` in `src/data/events.ts`; Round 2 swaps those two functions for the database.
- **Nothing is saved.** Add/edit fields, notes, the checklist and Settings rows do not persist (Round 2 onward).
- **Onboarding shows on every full restart**, because nothing remembers that it was finished (Round 2).
- **No permission is asked for.** Onboarding's "Import events" and "Turn on reminders" only move to the next page (Rounds 3 and 6).
- **Import shows sample calendars and a sample result** (Round 3).
- **Navigate's map is a drawing**, the same picture, distance and time for every event (Round 4). A caption on the screen says so.
- **AR Walk has no camera, GPS or compass**; the arrow does not move (Round 5). The button that opens it reads "Preview AR Walk" until then.
- **"Open in Apple Maps" and "Open in Google Maps" work**: each opens walking directions to the event's address in that app (Google Maps falls back to its website if the app is not installed). Sample venues are invented, so neither will find them; they become useful with real events from Round 2. Apple Maps was confirmed on the iPhone on 10 Oct 2026; Google Maps is waiting for the owner's test.
- **"Open in Partiful" and "Delete all data" do nothing yet.** "Source code" in Settings does open the GitHub repo.
- Key details, conflicts, weather and reminders are sample values or absent (Rounds 6 and 7).

## Known issues

- **App icon and launch image are not visible in Expo Go.** Expo Go keeps its own home-screen icon and loading screen. The mark shows on the in-app Splash. The real icon and launch screen appear in the Round 10 standalone build.
- **Typed routes.** While the dev server is running it rewrites `.expo/types/router.d.ts` in a way that rejects template strings such as `` `/event/${id}` ``. Navigate to dynamic screens with the object form, `{ pathname: '/event/[id]', params: { id } }`, which always type-checks.
- **Desktop preview.** When the app window is behind another window the preview stops drawing, so animated things (onboarding paging) cannot be checked there. The phone is the real test.

## Decisions

- **SDK 57.** The App Store version of Expo Go is 57.0.9 and runs SDK 57 projects (Expo changelog, 3 Sep 2026, and the App Store listing). Expo's version-mismatch troubleshooting page still says the App Store stops at SDK 54; that page is out of date.
- **Expo login is required.** Since Sep 2026, Expo Go on iOS only opens a project when the terminal (`npx expo login`) and the Expo Go app are signed in to the same Expo account. The free plan is enough.
- **SDK 58 is in beta.** When it goes stable the App Store Expo Go will move to 58 and stop opening SDK 57 projects. Plan a short upgrade step when that happens.
- **Scaffold.** Started from the official `default@sdk-57` template, then removed its demo screens, components and Expo-branded images. Round 1 removed three unused template packages from `package.json` (`@expo/ui`, `expo-glass-effect`, `expo-device`).
- **Round 1 packages.** Added `react-native-svg` (mark, glow, covers, drawn map, arrow), `expo-haptics`, `@expo-google-fonts/inter` and `@expo-google-fonts/instrument-serif`; dev only: `jest`, `jest-expo`, `@types/jest`, `sharp`. Jest came one round early so the countdown and list logic are tested. Icons are SF Symbols through `expo-symbols`, which was already installed.
- **Fonts.** Imported one weight at a time (`@expo-google-fonts/inter/400Regular`), because the package's main entry pulls in all 18 files. Five font files are bundled.
- **Lists.** Home and Archive use React Native's built-in `FlatList` over one flat array. FlashList was considered and left out: at 100 to 150 rows it adds a dependency without a visible gain. The flat array is the shape FlashList wants, so switching later is small.
- **Gradients.** The top glow, covers and edge fades are single `react-native-svg` views. Never put an SVG in a list row; rows use plain coloured views. React Native's built-in gradient style was left alone because it is still marked experimental in 0.86, is renamed in 0.87, and draws nothing in the web preview.
- **Smoothness check.** Development mode is much slower than the real thing. To judge scrolling honestly, start with `npx expo start --no-dev --minify`.
- **Splash.** The in-app Splash holds for about a second. From Round 2 it should skip straight to Home once onboarding is done.
- **Mark at small sizes.** Beside the Home wordmark at 24 pt the mark read as a second search icon, directly above the real one. The Home and Archive headers now show the serif wordmark alone. The mark appears on the Splash, onboarding page 1, the icon, empty states and the Settings footer; under 32 pt its tail is drawn from the ring's centre (`QevrionMark.tsx`). This departs from the plan, which put the mark beside the wordmark: owner to confirm, and it is a one-line change to put back.
- **Dividers are 1 pt, not hairlines.** A hairline at 8% white nearly vanishes on a 3x iPhone screen.
- **Mock-ups must say so on the screen (owner feedback, 10 Oct 2026).** When testing Round 1 the owner took the drawn map and the AR Walk shell for broken features. A placeholder needs a plain caption on the screen itself, and a button that cannot do its job yet should either work in a simpler way or be named as a preview. A note in the plan is not enough.
- **Apple Maps link.** `src/lib/maps.ts` uses the older `?daddr=...&dirflg=w` link because Apple's newer `/directions?destination=` form needs iOS 18.4 and the app supports 16.4. Apple's server turns the old form into the new one, checked in a browser on 10 Oct 2026. Confirmed on the iPhone on 10 Oct 2026.
- **Round order changed (owner decision, 10 Oct 2026).** The map and AR Walk moved ahead of reminders and key details, and the rounds were renumbered to match: 2 database, 3 import, **4 map and walking route, 5 AR Walk, 6 reminders, 7 key details, weather and conflicts**, then 8 to 10 as before. The map cannot come before Round 3, which turns addresses into coordinates. Log book entries before number 75 use the old numbers (map 6, AR Walk 7, reminders 4, key details 5).
- **Google Maps (owner decision, 10 Oct 2026).** Navigate offers "Open in Google Maps" beside "Open in Apple Maps". It is a plain link (`src/lib/maps.ts`): no Google SDK, no key, no cost.
- **Source layout.** Screens live in `src/app/` (the template's layout). `@/` points at `src/`.
- **Design references** live in `design-refs/`, which is git-ignored. Notes are in `docs/DESIGN_NOTES.md`.
- **Design tokens (10 Oct 2026).** Lighter label grey `#85858D`: accepted. Top glow: partly accepted, subtle and not on every screen. Corner sizes chosen by the owner on a sample screen: cards 28, chips/tags/thumbnails 17, buttons fully rounded. These override SPEC section 6 (see `docs/DESIGN_NOTES.md`, Decisions).
- **Tunnel mode.** `@expo/ngrok` is a dev dependency, added by Expo when `npx expo start --tunnel` was run. Use `--tunnel` whenever the phone can't reach the PC over Wi-Fi.
- **Private working files.** The owner's standing rules and round-by-round build prompts live on the owner's PC and are deliberately not in this repo. `SPEC.md`, this file and `LOGBOOK.md` are the public record.
- **Credits.** Commit messages and pull requests carry no tool credit or co-author lines, at the owner's request.
- **Preview.** A local preview config (kept out of git) attaches the desktop preview to a dev server that is already running on port 8081. Start the server yourself with `npx expo start` first.
- **Git.** Work happens on `round-N-short-name` branches and merges to `main` after the round is confirmed on the phone.
- **GitHub.** `main` is pushed to the public repo `rishabhdarji/Qevrion`. The repo was recreated on 10 Oct 2026 so that a cleaned history could be pushed fresh; local branches should never need a force-push. Commits use GitHub's private noreply address, set in this repo's local git config; the owner's personal email must stay out of commits. The owner's standing instruction is to push `main` at each important milestone without asking each time, after checking nothing private is in the commits. Never force-push.
- **CI.** `.github/workflows/ci.yml` runs `npm ci`, type-check, lint and tests on every push.
- **Privacy audit (10 Oct 2026).** Everything public was checked and found clean. Follow-ups applied: `.gitignore` ignores all `.env*` files, `*.ics`, `*.db`, `*.sqlite`, `*.ipa`, `*.cer` and `*.keystore`; CI has read-only permissions. Round 3 must add a `.gitignore` exception for its invented `.ics` test fixtures. The owner has turned on GitHub's "keep my email private" and "block pushes that expose my email" settings. Still open for the owner: the PC's global git email is the personal address (only this repo is set to noreply); local backup refs under `refs/original/` hold pre-rewrite commits and must never be pushed (do not use `git push --mirror`).
- **Time zone stays private.** Commit with the `TZ` environment variable set to `UTC` so timestamps carry no local offset. Keep local clock times out of every public file, and write dates as UTC dates. `LOGBOOK.md` has no clock times for this reason.
- **Devices.** The app must work on every iPhone that can run Expo Go (iOS 16.4 or later) at any screen size, not one model. Whether iPad or Android should be supported is an open question for the owner; Android is in the spec's backlog and Google Maps on Android would need a key.
- **README.** `README.md` has a roadmap table. Update its Status column, and the "Early days" note, each time a round is confirmed.
- **CD.** Nothing to deploy yet. Planned: site to GitHub Pages (Round 9), unsigned `.ipa` build (Round 10).

## Tools on this PC

- Node 24.20.0, npm 11.19.1, Git 2.56.0, GitHub CLI 2.102.0.
- GitHub CLI is signed in over HTTPS (confirmed 10 Oct 2026) with the `repo` and `workflow` scopes, which is what Round 8 needs to create the repo and push the CI workflow.
