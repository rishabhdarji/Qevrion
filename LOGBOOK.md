# Qevrion log book

A plain-language record of what was done in each session and why. Newest entries are at the bottom. `STATUS.md` says where the project stands; this file says how it got there. Entries are in the order they happened; the commit history carries the dates.

## Round 0: preflight and hello world

Entries 1 to 12 were written after the fact, in the order they happened.

1. **Read the rules.** Read the project rules, the spec and the build plan. Round 0 is setup only, no features.
2. **Checked the PC.** Node 24.20.0, npm 11.19.1 and Git 2.56.0 were installed. GitHub CLI was missing. You installed it during the session (2.102.0). It is not signed in yet, which is fine until Round 8.
3. **Looked up which SDK Expo Go supports.** Answer: SDK 57. Sources: Expo changelog of 3 Sep 2026 and the App Store listing (Expo Go 57.0.9). One Expo troubleshooting page still says SDK 54; it is out of date.
4. **Found a new requirement.** Since Sep 2026, Expo Go on iPhone needs you signed in to the same Expo account in the terminal and in the app. Free plan is enough.
5. **Wrote the plan and you approved it.**
6. **Started git.** Created the repo on `main`. Moved the eight reference images from the project root into `design-refs/` and git-ignored that folder. First commit: the project docs and `.gitignore`. Then switched to branch `round-0-preflight`.
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
17. The app's preview button failed with "Port 8081 is being used by another process". Cause: the dev server you had started already owns port 8081, and the preview tried to start a second one (its config also pointed at port 3000, which is not Expo's port). Fix: the local preview config now attaches the preview to the server that is already running instead of starting another. Nothing was killed.
18. Opened the preview. It shows "Qevrion 0.0.1" on a near-black screen with no console errors. This is the web version of the screen, so it proves the code runs, not that the phone works. Also confirmed the terminal is now signed in to Expo.
19. Kept the local tool settings folder out of git so it stays out of the public repo.

## Round 0 confirmed

20. You confirmed "Qevrion 0.0.1" shows in the centre of the screen on the iPhone. Round 0 is done.
21. Found `@expo/ngrok` newly added to `package.json`. Expo adds it the first time tunnel mode runs, so it looks like the phone was opened through `npx expo start --tunnel`. It is free and only used during development, so it is kept.
22. Updated `STATUS.md`, committed, and merged `round-0-preflight` into `main`. Nothing has been pushed to GitHub.

## Design decisions

23. Explained the three proposed design token changes with a side-by-side picture, and that HTTPS is the option to pick in `gh auth login`.
24. Recorded your decisions in `docs/DESIGN_NOTES.md`: lighter label grey accepted; top glow partly accepted (subtle, not everywhere); the card corner split rejected. Whether you want less rounding overall is left as a question for Round 1.
25. Checked the GitHub sign-in. `gh auth status` still says not logged in and no saved login exists on this PC, so the login did not finish. Not needed until Round 8.
26. You finished `gh auth login`. Confirmed: GitHub CLI is signed in over HTTPS with the permissions Round 8 needs (create the repo, push code and the CI workflow).
27. You clarified the corners look too round in general and that you'll send a picture for shapes later. Recorded in `docs/DESIGN_NOTES.md`: this overrides the spec's corner sizes, shapes stay adjustable in one place, and Round 1 asks for your picture before finalising them.
28. Showed you an interactive corner picker in the chat: a sample Qevrion screen with sliders for cards, chips and buttons, plus five presets from sharp to the spec's 24. Waiting for you to pick, or to send your own reference picture.
29. You picked the shapes in the corner picker: cards 28, chips and thumbnails 17, buttons as full pills. Recorded in `docs/DESIGN_NOTES.md` and `STATUS.md`. This is slightly rounder than the spec's 24 and 16, and replaces the earlier "too round" note.

## GitHub, CI and privacy

30. You asked for CI on GitHub and for milestones to be pushed so progress is visible. Found your GitHub repo already exists, is public and is empty. Added `.github/workflows/ci.yml`: on every push GitHub installs the packages and runs type-check and lint. Tests get added to it in Round 2.
31. "Continuous deployment" has nothing to deploy yet. The website deploy comes in Round 9 and the installable app build in Round 10; both are already planned as GitHub Actions.
32. Privacy check before the first push: scanned every tracked file for keys, tokens and email addresses and found none. But the commits themselves carry your personal email address, which becomes public and permanent on a public repo.
33. Tried to switch the commits to GitHub's private address before pushing. The safety system blocked it because it rewrites git history. Nothing was changed and nothing has been pushed. Waiting for your decision on the email.
34. Correction: an earlier version of this log carried clock times, and some of them were estimates. They have since been removed.
35. You chose GitHub's private address for commits. Rewrote the 13 unpushed commits to use it (same content, same dates) and set this repo to use it from now on. Your personal email is not in anything pushed.
36. First push: `main` is now on GitHub at github.com/rishabhdarji/Qevrion.
37. The first CI run passed: install, type-check and lint all green. GitHub noted its test machines move to a newer Ubuntu version on 19 Oct 2026; nothing to do.
38. At your request, started a separate agent to audit privacy on what was pushed: commit details, every file and its history, ignored folders, and GitHub's own security settings.
39. You asked for a pull request. Moved the uncommitted doc changes to a new branch, `round-0-ci-docs`, pushed it and opened pull request 1 into `main`.
40. The privacy audit finished. Nothing private is public: no email, key, token, location or event data in any file, commit or CI log, and `design-refs/` never entered the history. GitHub's secret scanning and push protection are both on.
41. Closed two gaps the audit found. `.gitignore` now ignores every `.env` file (it only ignored `.env.local` ones), plus calendar exports (`.ics`), database files and app builds, so real event data can't be committed by accident. The CI workflow now runs with read-only access to the repo.
42. Left for you to decide (details in the chat): your PC's global git setting still uses your personal email for other projects, and the old pre-rewrite commits still exist on this PC as a local backup.
43. You turned on GitHub's two email privacy settings: keep the address private, and block pushes that would expose it.
44. You asked for a README. Wrote `README.md`: what Qevrion is, what it will do, the roadmap by round, honest limitations, how to run it in Expo Go, and the tech stack. It says plainly that only Round 0 is built.
45. You said the app should work on all devices, not one model. The project rules and the README now say every iPhone that can run Expo Go, at any screen size. Whether "all devices" also means iPad or Android is an open question.

46. You asked for no tool credits in the repo. Removed the co-author line from every commit message and the footer from the pull request. The working-rules file and the build-prompts file are now kept on the PC only, out of the repo and its history, and the docs were reworded to match.

47. You asked for the time zone to be kept private. Every commit timestamp is now recorded in UTC and this log carries no clock times. To leave nothing old behind, you deleted the GitHub repo and created it again, and the cleaned history was pushed to the fresh repo.
48. Reopened the pull request in the fresh repo for the README and the privacy follow-ups.

## Round 1: design system and app shell

49. **Read and planned.** Read the rules, spec sections 5 and 6, the design notes, the status file and all eight reference images. Checked the installed packages and Expo's docs for anything the plan relied on. Wrote the plan; you approved it.
50. **The mark.** Showed you three ring-with-a-tail options in the chat. You picked B, the open ring with the tail passing through a gap.
51. **Branch.** Started `round-1-design-shell` from the docs branch, which has the latest files. The open pull request was left alone.
52. **Packages.** Added the SVG drawing library, haptics, and the two font families (Inter and Instrument Serif). For development only: the test runner and an image tool. Removed three template packages nothing used. All free, all confirmed to run inside Expo Go.
53. **Theme.** One file now holds every colour, size, corner radius, text style and animation setting, including your choices: cards 28, small elements 17, pill buttons, the lighter label grey.
54. **Icon and launch image.** Drew the mark as an SVG and wrote a small script that turns it into the app icon and the launch image. First try was too small inside the icon; enlarged it.
55. **Specialists.** Part-way through you asked for three specialists: a researcher, a system designer and a UI/UX designer. They worked as advisers and reviewers while the build continued, so nobody edited the same files at once. The researcher's findings were passed to the system designer to settle on one list.
56. **What the researcher found.** Import fonts one weight at a time (the package's main entry would bundle 18 files; we now bundle 5). A faster list library exists and works in Expo Go. React Native has a built-in gradient style. Judge smoothness with development mode switched off.
57. **What the system designer decided.** Keep the drawn glow and covers as they are (one per screen is cheap; the built-in gradient is still experimental and is being renamed). Use the built-in list rather than a new library, over one flat array, so 100 or more events need no rework in Round 2. Found a real bug: Home read the clock in a way that froze "now" until you typed or tapped; fixed with a once-a-minute tick, so the hero moves on when an event ends.
58. **What the UI/UX designer changed.** Hero card with the countdown in a pill at the top and the serif title at the bottom; smaller serif titles in rows so they are not cut off; date tiles; a capsule tab bar with a raised pill under the active tab; edges that fade instead of cutting off; quicker press feedback; a light tick on chips and tabs; onboarding artwork that shrinks on small phones.
59. **Left out on purpose.** A serif onboarding headline (the spec asks for a light-weight one), a "Sketch" label on the map (the rule says "Sample"), sliding animations on the tab pill, and blur.
60. **Components.** Built the eleven asked for and the small helpers they need. Each press shrinks slightly and settles back without bouncing.
61. **Screens.** Built all ten as navigable shells on thirteen invented events, each labelled "Sample": Splash, onboarding, Home, Archive, event detail, add/edit, import, Navigate, AR Walk, Settings. Plus the component gallery, opened from Settings.
62. **Tests.** Eleven tests: the countdown text ("3d 8h left" down to "Now") and the function that arranges Home and Archive. Added the test step to CI.
63. **A type-check failure and its cause.** Navigation to the event screens failed type-checking. Cause: the running dev server rewrites the route types in a way that rejects one style of link. Switched those links to the other style, which always passes.
64. **Checked in the desktop preview.** Opened every screen at phone size: right content, no errors, nothing running off the edge. Two things looked wrong and were fixed: beside the wordmark the small mark read as a search icon (the tail is now drawn from the ring's centre at small sizes), and the Sample badge squeezed each row's second line (it now sits on the title line).
65. **A preview limit.** The preview stops drawing when the app window is behind another window, so the animated page-turn in onboarding could not be exercised there. The pages themselves were checked; the swipe is for your phone.
66. **Checks.** Type-check, lint, tests and Expo's doctor all pass. An iPhone bundle builds.
67. **Docs.** Updated the status file and added a "where the build differs from the references" section to the design notes.
68. **Design review of the built screens.** The UI/UX designer looked at screenshots of every screen and judged Home the strongest. Fixed what it found: on a real phone the Navigate stats would have sat under the buttons (the map is now wider than tall, "Leave by" comes first and only one button is pinned); sample times now land on the half hour and agree between screens; lines between rows are a full point so they do not vanish on the phone's sharper screen; the Sample badge uses the corner size you chose for tags; Archive's date tiles are easier to read; the hero is slightly shorter so more rows show; Settings and Import use the same small uppercase labels as everywhere else; onboarding uses the same side margin and a calmer wash.
69. **One change to what you approved.** The plan put the mark beside the "Qevrion" wordmark on Home. At that size it looked like a second search icon sitting above the real one, so the header now shows the wordmark alone. The mark is still on the Splash, onboarding, the icon and the Settings footer. Easy to put back if you prefer it.

## Round 1 confirmed

70. **You tested Round 1 on the iPhone.** No major glitches and a good start. Three complaints: the maps button did nothing, the AR screen was unusable, and every address showed the same map.
71. **What was going on.** All three were the placeholders this round was planned to have: the map is a drawing, AR Walk is a mock-up with no camera, and the maps button was not wired up. The plan said so, but the screens did not say it clearly enough, so they looked broken. That is on the build, not on you.
72. **Fixed now.** "Open in Apple Maps" opens walking directions to the event's address in the Maps app. Checked in a browser: the link reaches Apple Maps with the right address. The sample venues are invented, so Maps will not find them; it becomes useful once your own events are in. Navigate now carries a caption saying the map and numbers are samples, and the AR button reads "Preview AR Walk".
73. **Not fixable in this round.** A real map with your position and a walking route is Round 6. The camera view with a moving arrow is Round 7.
74. **Merged and pushed.** You had already merged the earlier docs pull request on GitHub. Round 1 was merged into `main` on top of it and pushed.

## Round order changed, Google Maps added

75. **Your answers.** "Open in Apple Maps" works on your phone. You asked for Google Maps as well, and for the rounds to be reordered so the map and AR Walk come sooner.
76. **New order, renumbered to match.** 2 database, 3 import, 4 map and walking route, 5 AR Walk, 6 reminders, 7 key details, weather and conflicts, then 8 to 10 as before. The map cannot come before Round 3, because that round turns addresses into map coordinates. Entries above this one use the old numbers: map 6, AR Walk 7, reminders 4, key details 5.
77. **Updated to match.** The roadmap in the README, the status file, the design notes, the comments in the code that name a round, and the build prompts.
78. **Google Maps.** Navigate now has "Open in Google Maps" under "Open in Apple Maps". It is a plain link, so it needs no Google key and costs nothing. It opens the Google Maps app if you have it, and the Google Maps website if you do not. The spec says so now too.
79. **Checked in a browser.** The button opens walking directions in Google Maps. One thing to expect: the sample venues are invented, and Google guesses a real place with a similar name, so for sample events it leads somewhere meaningless. Real events will have real addresses.
80. **Not merged yet.** This sits on its own branch until you have tried the Google Maps button on the phone.

81. **You confirmed both map buttons on the iPhone.** The branch was merged into `main` and pushed.

**Next:** Round 2 (database and manual events). Round 3 note: `.ics` files are ignored, so the invented test fixtures written there need an explicit exception in `.gitignore`.
