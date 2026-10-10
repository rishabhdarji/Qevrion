# Design notes from the references

Written in Round 0 from the eight images in `design-refs/` (kept out of the repo). They are mood references: this file records the feel to borrow, not anything to copy. Sizes are estimates by eye from phone screenshots, so treat them as starting points.

## What each reference shows

### Ref 1: splash
- Flat, very dark background with a faint blue-violet cast (about `#1B1B20`). One off-white mark dead centre, roughly a quarter of the screen width. Nothing else.
- **Maps to:** Qevrion splash (SPEC 6, first bullet).

### Ref 2: onboarding, full-bleed image
- A photo fills the whole screen and fades into slate at the top and near-black at the bottom, so text sits on darkness without a box behind it.
- Headline: light-weight sans, about 32 pt, left-aligned, off-white. Body: about 17 pt, softer off-white, three lines, generous line height.
- One wide pill button: cream fill, near-black semibold label, about 52 pt tall, 16 pt side margins.
- **Maps to:** onboarding pages, `PrimaryButton`.

### Ref 3: chat, dark
- A sheet with large rounded top corners over black, a slate glow behind the header, a grey bubble for the user's message, plain text for the reply, light-weight headings, a hairline divider, and a pill input pinned to the bottom with a small caption under it.
- **Maps to:** backlog only ("Ask Qevrion"). Worth keeping: the sheet shape and the reading-text rhythm (17 pt, loose line height).

### Ref 4: selection list
- Slate-blue glow behind the header that is gone by mid-screen. Header: close icon left, 17 pt regular title centred, a round 44 pt icon button right.
- Group labels in sentence case, secondary grey, about 17 pt.
- Cards: slightly raised fill, radius about 14 pt, rows about 52 pt tall, a hairline between rows in the same card. Each row has a title, and under it a status line in accent blue.
- The selected card has a 1 px bright off-white outline and a slightly lighter fill.
- An "add" row with a plus icon and a blue label. A cream pill button at the bottom.
- **Maps to:** Settings, Import calendar picker, `Card`, the selected-card state.

### Ref 5: map and stats
- Sheet with the same top glow. An overline in small uppercase with wide tracking, a light-weight title at about 30 pt, a secondary-grey subtitle.
- Map card: dark map with a navy tint, radius about 12 pt. Route line in accent blue, about 4 pt wide with rounded joins. Start is a green dot with a white ring, end is a coral-red dot with a white ring.
- Stat grid: two columns. Label is 12 pt uppercase, semibold, wide tracking, secondary grey. Value is 17 pt regular in primary. About 28 pt between rows.
- **Maps to:** Navigate, `StatGrid`.

### Ref 6: chat, light, suggestion pills
- Light theme. Three stacked, centred suggestion pills (emoji plus a short phrase), a pill input with a round send button.
- **Maps to:** backlog only. The pill shape is a fair model for filter `Chip`s. The light theme is not used in v0.0.1.

### Ref 7: onboarding, photo with two buttons
- Wordmark top centre over a full-bleed photo. A dark scrim covers the lower half.
- Two-line headline, about 30 pt, light geometric sans, left-aligned.
- Primary pill (light, dark label) and directly under it an outlined pill (1 px white at low opacity, white label). Both about 56 pt tall with a 12 pt gap. A small centred caption below.
- **Maps to:** onboarding with a primary action and "Not now", `PrimaryButton`, `SecondaryButton`.

### Ref 8: home
- True near-black background, about `#0F0F0F`.
- Top-left: small mark plus a serif wordmark at about 28 pt. Top-right: a dark pill with a hairline border and a white pill, both icon plus label, about 40 pt tall.
- Section labels: 12 pt uppercase, very wide tracking, tertiary grey.
- Photo card: portrait, radius about 24 pt, serif title laid over the top of the photo, and under it a countdown row with a clock icon ("3d 8h left"). A small floating action button sits on the card's bottom edge.
- A full-width hairline between sections. List rows have a serif title on the left and a tertiary-grey date range on the right.
- A small "SAMPLE" badge: tiny rounded rectangle, dark blue fill, light blue uppercase text.
- Bottom bar: a floating dark panel with two uppercase text tabs (active white, inactive tertiary) and a profile icon on the right.
- **Maps to:** Home, `EventHeroCard`, `SectionLabel`, `Pill`, the bottom bar, and the project rule that sample data is visibly labelled "Sample".

## How this lines up with SPEC section 6

| Spec item | Seen in | Verdict |
|---|---|---|
| Background `#0E0E10` | Ref 8 | Matches. Ref 1 is lighter, but one background everywhere is calmer. Keep. |
| Surface / Surface raised | Refs 4, 8 | Match. |
| Hairline, white at 8% | Refs 3, 4, 8 | Matches. |
| Text primary `#F2EFEA` | Refs 2, 5, 8 | Matches the warm off-white. |
| Primary button, cream, fully rounded | Refs 2, 4, 7 | Matches. Refs measure 52 to 56 pt tall; keep 56. |
| Secondary button, 1 px white at 25% | Ref 7 | Matches. |
| Accent `#4FB3E8` | Refs 4, 5 | Matches (status text, route line). |
| Start green, end red | Ref 5 | Matches. |
| Top glow, slate blue | Refs 3, 4, 5 | Matches. Not present on the home reference. |
| Serif for event titles, light sans for headings | Ref 8 serif; Refs 2, 5, 7 light sans | Matches. |
| Section labels 12 pt uppercase, wide tracking | Refs 5, 8 | Matches. |
| Text tabs at the bottom, icon on the right | Ref 8 | Matches. |

## Tokens I'd adjust (decide in Round 1)

1. **Tertiary text fails the spec's own contrast rule.** `#6B6B73` on the background is 3.65:1, and 3.25:1 on Surface. The spec asks for 4.5:1 and uses tertiary for 12 pt section labels. Suggest `#85858D` (5.27:1 on background, 4.70:1 on Surface) for any tertiary text that has to be read, and keep `#6B6B73` only for decoration such as inactive icons.
2. **Two card radii, not one.** The references use about 24 pt for photo and hero cards and about 12 to 16 pt for list and map cards. Suggest 24 for `EventHeroCard` and photo cards, 16 for grouped list cards and the map card. The spec already has both numbers; this just says which goes where.
3. **Top glow is not everywhere.** It appears on header-led screens (detail, navigate, settings, import) and not on the home reference. Suggest `Screen` takes a glow on/off option, with Home using it faintly or not at all.

### Decisions (10 Oct 2026)

1. **Label grey: accepted.** Readable tertiary text uses `#85858D`. `#6B6B73` stays only for decoration.
2. **Card radius split: rejected.** The owner did not like the corner rounding shown. Until they say otherwise, use the spec as written (cards 24, inner elements 16) and do not introduce the 24/16 split by card type. Open question for Round 1: whether they want less rounding overall. Show the hero card on the phone and ask before building the other cards.
3. **Top glow: partly accepted** ("maybe some of it"). `Screen` gets a glow on/off option. Use it sparingly and keep it subtle: on for header-led screens, off on Home. Confirm by eye in Round 1.

Checked and fine as they are: primary text 16.81:1, secondary 7.70:1, accent 8.21:1, destructive 5.63:1, button label on cream 16.19:1 (all against the background).

## Where Qevrion should deliberately differ

- The home reference's hero is a narrow portrait card. SPEC F1 asks for a large hero card, so ours is full width.
- No photos of products or people. Covers are gradients or the user's own images.
- The Qevrion mark is original (SPEC 6: a ring with a short diagonal tail). Ref 1's mark is also ring-based, so ours needs the tail and proportions to make it clearly different.
- No brand names, wordmarks or copy from any reference.
