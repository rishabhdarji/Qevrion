# Qevrion status

Last updated: Round 0 complete (10 Oct 2026). Version 0.0.1.

## What works

- Expo SDK 57 project with TypeScript (strict) and Expo Router.
- One screen: near-black background with "Qevrion 0.0.1" in the centre. The version is read from `app.json`. Confirmed on the iPhone in Expo Go on 10 Oct 2026.
- `npm run typecheck`, `npm run lint` and `npx expo-doctor` all pass. An iOS bundle exports cleanly.

## What is stubbed or missing

- Everything in SPEC section 4. No features yet.
- No theme file, fonts or components (Round 1).
- No app icon or splash image (Round 1 draws the Qevrion mark). `app.json` has no icon entries on purpose.
- No tests. Jest is added in Round 2 with the first real logic.

## Known issues

- None in the app.

## Decisions

- **SDK 57.** The App Store version of Expo Go is 57.0.9 and runs SDK 57 projects (Expo changelog, 3 Sep 2026, and the App Store listing). Expo's version-mismatch troubleshooting page still says the App Store stops at SDK 54; that page is out of date.
- **Expo login is required.** Since Sep 2026, Expo Go on iOS only opens a project when the terminal (`npx expo login`) and the Expo Go app are signed in to the same Expo account. The free plan is enough.
- **SDK 58 is in beta.** When it goes stable the App Store Expo Go will move to 58 and stop opening SDK 57 projects. Plan a short upgrade step when that happens.
- **Scaffold.** Started from the official `default@sdk-57` template, then removed its demo screens, components and Expo-branded images. Its packages are still installed; prune in Round 1 once the design system shows what is used.
- **Source layout.** Screens live in `src/app/` (the template's layout). `@/` points at `src/`.
- **Design references** live in `design-refs/`, which is git-ignored. Notes are in `docs/DESIGN_NOTES.md`.
- **Design tokens (10 Oct 2026).** Lighter label grey `#85858D`: accepted. Top glow: partly accepted, subtle and not on every screen. Corner sizes chosen by the owner on a sample screen: cards 28, chips/tags/thumbnails 17, buttons fully rounded. These override SPEC section 6 (see `docs/DESIGN_NOTES.md`, Decisions).
- **Tunnel mode.** `@expo/ngrok` is a dev dependency, added by Expo when `npx expo start --tunnel` was run. Use `--tunnel` whenever the phone can't reach the PC over Wi-Fi.
- **Preview.** the local preview config (git-ignored) attaches the desktop preview to a dev server that is already running on port 8081. Start the server yourself with `npx expo start` first.
- **Git.** Work happens on `round-N-short-name` branches and merges to `main` after the round is confirmed on the phone. Nothing has been pushed.

## Tools on this PC

- Node 24.20.0, npm 11.19.1, Git 2.56.0, GitHub CLI 2.102.0.
- GitHub CLI is signed in over HTTPS (confirmed 10 Oct 2026) with the `repo` and `workflow` scopes, which is what Round 8 needs to create the repo and push the CI workflow.
