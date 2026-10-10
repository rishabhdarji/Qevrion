# Qevrion log book

A plain-language record of what was done in each session and why. Newest entries are at the bottom. `STATUS.md` says where the project stands; this file says how it got there.

## 10 Oct 2026: Round 0, preflight and hello world

Entries 1 to 12 were written after the fact, in the order they happened. Timed entries start at 13.

1. **Read the rules.** Read the project rules, the spec and the build plan. Round 0 is setup only, no features.
2. **Checked the PC.** Node 24.20.0, npm 11.19.1 and Git 2.56.0 were installed. GitHub CLI was missing. You installed it during the session (2.102.0). It is not signed in yet, which is fine until Round 8.
3. **Looked up which SDK Expo Go supports.** Answer: SDK 57. Sources: Expo changelog of 3 Sep 2026 and the App Store listing (Expo Go 57.0.9). One Expo troubleshooting page still says SDK 54; it is out of date.
4. **Found a new requirement.** Since Sep 2026, Expo Go on iPhone needs you signed in to the same Expo account in the terminal and in the app. Free plan is enough.
5. **Wrote the plan and you approved it.**
6. **Started git.** Created the repo on `main`. Moved the eight reference images from the project root into `design-refs/` and git-ignored that folder. First commit: the three docs and `.gitignore`. Then switched to branch `round-0-preflight`.
7. **Created the Expo project.** The folder was not empty, so the SDK 57 template was generated in a temp folder and only the needed files were brought over: `package.json`, `tsconfig.json`, `.gitignore`. The template's demo screens, components and Expo logo images were left behind.
8. **Set the app config.** `app.json`: name Qevrion, version 0.0.1, dark interface, background `#0E0E10`. No icon yet, because the Qevrion mark is drawn in Round 1.
9. **Wrote the hello screen.** `src/app/_layout.tsx` and `src/app/index.tsx`: near-black screen, "Qevrion 0.0.1" centred. The version number is read from `app.json`.
10. **Installed packages.** `npm install`, 607 packages, Expo 57.0.27 confirmed.
11. **Ran the checks.** Type-check passed. The first lint run only installed ESLint and then errored; the second run passed. `expo-doctor` passed 21 of 21. A test iOS bundle built cleanly (2.3 MB).
12. **Committed.** Two commits on the branch: the scaffold, then the hello screen.
13. Looked at all eight reference images and wrote `docs/DESIGN_NOTES.md`. Measured the colour contrast of the spec's tokens. One problem found: the tertiary grey `#6B6B73` is 3.65:1 on the background, below the 4.5:1 the spec asks for. Three token changes are proposed for Round 1.
14. Wrote `STATUS.md`.
15. Checked the Expo sign-in on the PC: the terminal is not signed in yet (`npx expo whoami` says "Not logged in"). Tried to open `npx expo login` in the Terminal panel for you. It failed: the panel's shell integration script is missing on this PC, so commands cannot be typed there for you. You run the two commands yourself instead.
16. Started this log book at your request.

17. The app's preview button failed with "Port 8081 is being used by another process". Cause: the dev server you started already owns port 8081, and the preview tried to start a second one (its config also pointed at port 3000, which is not Expo's port). Fix: the local preview config now attaches the preview to the server that is already running instead of starting another. Nothing was killed.
18. Opened the preview. It shows "Qevrion 0.0.1" on a near-black screen with no console errors. This is the web version of the screen, so it proves the code runs, not that the phone works. Also confirmed the terminal is now signed in to Expo.
19. Git-ignored the local tool settings folder so local tool settings stay out of the public repo.

## 10 Oct 2026: Round 0 confirmed

20. You confirmed "Qevrion 0.0.1" shows in the centre of the screen on the iPhone. Round 0 is done.
21. Found `@expo/ngrok` newly added to `package.json`. Expo adds it the first time tunnel mode runs, so it looks like the phone was opened through `npx expo start --tunnel`. It is free and only used during development, so it is kept.
22. Updated `STATUS.md`, committed, and merged `round-0-preflight` into `main`. Nothing has been pushed to GitHub.

23. Explained the three proposed design token changes with a side-by-side picture, and that HTTPS is the option to pick in `gh auth login`.
24. Recorded your decisions in `docs/DESIGN_NOTES.md`: lighter label grey accepted; top glow partly accepted (subtle, not everywhere); the card corner split rejected. Whether you want less rounding overall is left as a question for Round 1.
25. Checked the GitHub sign-in. `gh auth status` still says not logged in and no saved login exists on this PC, so the login did not finish. Not needed until Round 8.

26. You finished `gh auth login`. Confirmed: GitHub CLI is signed in over HTTPS with the permissions Round 8 needs (create the repo, push code and the CI workflow).

27. You clarified the corners look too round in general and that you'll send a picture for shapes later. Recorded in `docs/DESIGN_NOTES.md`: this overrides the spec's corner sizes, shapes stay adjustable in one place, and Round 1 asks for your picture before finalising them.

**Next:** Round 1 (design system and app shell).
