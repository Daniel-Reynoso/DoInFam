# DoInFam — Design QA

## Comparison setup

- Source visual truth:
  - `design-qa-assets/selector-reference.png`
  - `design-qa-assets/pin-reference.png`
- Implementation evidence:
  - `design-qa-assets/selector-implementation.png`
  - `design-qa-assets/pin-implementation.png`
- Side-by-side evidence:
  - `design-qa-assets/selector-comparison.png`
  - `design-qa-assets/pin-comparison.png`
  - `design-qa-assets/onboarding-style-comparison.png`
- Onboarding implementation evidence:
  - `design-qa-assets/onboarding-welcome-web.png`
  - `design-qa-assets/onboarding-account-web.png`
- Viewport: 390 × 844 CSS px, device scale factor 1.
- Source dimensions: 780 × 1688 px at 2× density.
- Implementation dimensions: 390 × 844 px at 1× density.
- Normalization: the source was downsampled to 390 px wide. The iOS-owned
  status bar (47 px) and home-indicator region were excluded from the visual
  comparison; the implementation capture compares app-owned content only.
- State: member selector with Gabriel marked as the last access; PIN screen
  for Gabriel with two digits entered.
- Onboarding state: unauthenticated welcome and create-account form. These
  screens have no one-to-one Figma frame, so they were checked as an extension
  of the approved visual system rather than as an exact layout clone.
- Onboarding browser capture: 1280 × 720 px at device scale factor 1. The
  app-owned 520 × 720 px region was cropped for the visual-system comparison.

## Full-view comparison

The app-owned composition, content order, alignment, list rhythm, avatar sizes,
PIN hierarchy, keypad geometry and bottom action match the approved references.
No actionable P0, P1 or P2 differences remain.

The onboarding preserves the same warm field, teal emphasis, Inter hierarchy,
quiet neutral copy and restrained use of surfaces. Its mobile content remains
within the approved 520 px maximum width and avoids introducing cards,
illustrations or a second visual language.

## Required fidelity surfaces

- Fonts and typography: Inter is loaded in the same regular, semibold and bold
  hierarchy. Text size, weight, wrapping and alignment match at 390 px.
- Spacing and layout rhythm: the selector uses 24 px outer insets, 80 px rows,
  48 px avatars and inset separators. PIN uses the same vertical anchors as the
  reference, an 87 × 48 px keypad and 9 px keypad gaps.
- Colors and visual tokens: the warm `#F8F4EE` background, neutral text and
  borders, approved teal actions and the sampled `#FF9F1C` Gabriel avatar are
  reproduced. Strong colors remain limited to identity and interaction state.
- Image and icon fidelity: the screens contain no raster content. The chevron
  and backspace glyphs use the existing Material Community Icons library and
  visually match the references.
- Copy and content: family name, question, member order, last-access label,
  greeting, PIN instruction and change-member action match exactly.
  Onboarding copy clearly separates account, family and first-member setup.

## Focused-region comparison

- Member rows: avatar and text anchors, chevrons and separators were checked
  against the selector reference.
- PIN controls: filled/empty indicators, all keypad rows, zero/backspace
  placement and the bottom link were checked against the PIN reference.
- Onboarding: brand label, display heading, secondary copy, input geometry and
  primary/secondary buttons were checked together with the approved selector
  reference in `onboarding-style-comparison.png`. No exact positional claims
  were made because the Figma file has no onboarding frame.

## Comparison history

1. Initial selector pass: P2 — rows were full width, avatars started too close
   to the edge, secondary notes appeared for every member and the member order
   differed. Fixed with inset list geometry, selector-only row behavior and the
   approved Gabriel/Mamá/Papá/Sofía order.
2. Initial PIN pass: P2 — the old implementation used boxed PIN cells, a native
   keypad and a Continue button. Fixed with circular PIN indicators, the custom
   numeric keypad, automatic four-digit continuation and the approved link.
3. Second PIN pass: P2 — PIN indicators were 31 px too low after spacing
   compensation. Fixed while keeping the keypad anchor unchanged. The final
   side-by-side comparison shows matching vertical anchors.
4. Initial onboarding pass: P2 — an imperative route change executed while the
   welcome screen rendered. Replaced it with Expo Router's declarative redirect;
   a clean reload produced no further application error.

## Interaction checks

- Selecting Gabriel opens the PIN screen with the correct name and avatar.
- Numeric keys update the four PIN indicators.
- Four digits automatically navigate to Inicio.
- Change member returns to the selector.
- Welcome opens create-account and existing-account variants.
- Empty account submission surfaces inline validation without contacting
  Supabase.
- Account creation was not submitted during QA, avoiding creation of a test
  Auth user with invented credentials.
- TypeScript check passes.
- The final Metro/browser reload has no application errors. The obsolete
  Supabase `lock` option that generated a warning was removed.

## Findings

- No actionable P0/P1/P2 findings.
- P3: tiny platform-rendering differences in Inter antialiasing and icon stroke
  may remain between Figma's iOS preview and React Native Web. These are expected
  and should be rechecked on a physical iPhone/Android device later.

## Implementation checklist

- [x] Match selector structure and member ordering.
- [x] Match PIN structure and two-digit visual state.
- [x] Verify primary navigation interactions.
- [x] Run TypeScript validation.
- [x] Check runtime console.

final result: passed

## Desktop centering regression — 2026-09-03

- User evidence: `design-qa-assets/pin-desktop-before.png`.
- Corrected implementation: `design-qa-assets/pin-desktop-centered.png`.
- Combined evidence: `design-qa-assets/pin-desktop-centering-comparison.png`.
- Viewport checked: 1280 × 720 px.
- State checked: PIN screen for Daniel with the incorrect-PIN message visible.
- P2 fixed: non-scrolling screens did not center their 520 px maximum-width
  content column on wide browser viewports.
- P2 fixed: the incorrect-PIN label used a negative horizontal offset tied to
  the PIN dots instead of a centered status region.
- Mobile behavior is unchanged: below the maximum width, the screen continues
  to occupy the available width.
- No actionable P0/P1/P2 findings remain in this state.

final result: passed
