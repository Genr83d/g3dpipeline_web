---
name: GENR8 Pipeline
description: Production control for a 3D-print and manufacturing shop, drawn as a technical drafting sheet.
colors:
  primary: "#2454d8"
  primary-pressed: "#1d47ba"
  primary-soft: "#dfe8ff"
  primary-night: "#a5b4fc"
  secondary: "#087f74"
  secondary-soft: "#d7f2ed"
  signal-amber: "#f59e0b"
  danger: "#b42318"
  danger-soft: "#fde2df"
  ink: "#0d1726"
  appbg: "#eef3f7"
  slate-label: "#64748b"
  slate-body: "#475569"
  night-bg: "#020617"
typography:
  headline:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
  title:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "JetBrains Mono Variable, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "0.68rem"
    fontWeight: 500
    letterSpacing: "0.12em"
  readout:
    fontFamily: "JetBrains Mono Variable, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
    fontFeature: "tnum"
rounded:
  hairline: "1px"
  sm: "2px"
  card: "4px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.card}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-pressed}"
  button-secondary:
    backgroundColor: "{colors.secondary-soft}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.card}"
    padding: "10px 16px"
  button-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    rounded: "{rounded.card}"
    padding: "10px 16px"
  button-ghost:
    textColor: "{colors.slate-body}"
    rounded: "{rounded.card}"
    padding: "10px 16px"
  field:
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "10px 14px"
  card:
    rounded: "{rounded.card}"
    padding: "16px"
  status-pill:
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: GENR8 Pipeline

## Overview

**Creative North Star: "The Drafting Sheet"**

The app is a technical drawing laid over an instrument panel. The page is drafting paper: a fine 42px grid with a heavier major line every 210px, under a faint blue wash at the top. Cards are sheets on that paper: near-square corners, hairline borders, and registration ticks at all four corners. Everything that is measured (order numbers, counts, dates, percentages, section labels) is set in a monospace; everything that is read is set in Inter.

Colour is scarce on purpose. The interface is ink and slate. Blue marks action and the active signal. Status hue (blue, amber, teal, red) appears only where an instrument would show it: indicator lamps, gauge fills, and corner-tick tints. Density is high but ordered, because this is a working shop tool and people scan it all day.

Every surface has light, dark, and high-contrast forms, and every motion is gated by the user's reduce-motion setting.

**Key Characteristics:**
- Drafting-paper grid background; translucent sheets with corner registration ticks.
- Inter for prose, JetBrains Mono for data and drafting labels only.
- Ink/slate base, blue for action, status hue on LEDs, gauges, and ticks only.
- Crisp 4px corners; hairline rules and dotted leaders instead of boxes inside boxes.
- Motion is purposeful (panel slide, gauge travel, tab marker) and fully suppressible.

## Colors

Ink on cool paper, with one blue for action and a small signal set reserved for instruments.

### Primary
- **Drafting Blue** (primary): primary buttons, focus rings, links, the active tab marker, order numbers in the title block, the default corner-tick tint, and the "pending" signal. Pressed/hover state is **Deep Drafting Blue** (primary-pressed). On dark, blue moves to **Night Periwinkle** (primary-night, Tailwind indigo-300) for text, ticks, and markers.
- **Blueprint Wash** (primary-soft): manufacturing category badge and soft blue chip fills.

### Secondary
- **Machinist Teal** (secondary): the "completed / ready" signal, completion dates, secondary buttons. Dark mode uses emerald-300/400.
- **Teal Wash** (secondary-soft): secondary button fill.

### Tertiary
- **Caution Amber** (signal-amber, Tailwind amber-500): the "in progress" signal on LEDs, gauges, and ticks; amber-700 for amber text in light mode, amber-300 in dark.
- **Fault Red** (danger) with **Fault Wash** (danger-soft): overdue, destructive actions, invalid fields. Dark mode uses red-300/400.

### Neutral
- **Ink** (ink): headings and primary text in light mode.
- **Cool Paper** (appbg): page background beneath the grid.
- **Slate Label** (slate-label, slate-500): technical labels, secondary metadata, idle signal (slate-400).
- **Slate Body** (slate-body, slate-600): body and spec-row text.
- **Night Sheet** (night-bg, slate-950): dark page background; dark surfaces are slate-900 at 88-97% opacity.
- Hairlines come from CSS variables, not fixed hexes: `--surface-border` (slate at 30% / 20% dark), `--rule` (slate at 32% / 24% dark), `--grid-line`, `--grid-major`, `--tick`.

### Named Rules
**The Instrument Hue Rule.** Status colour lives only on LEDs, gauge fills, corner-tick tints, and the mono status label beside its LED. The rest of the interface stays ink and slate, so a lit lamp actually reads.

**The Three Modes Rule.** Every colour ships with a dark variant and a high-contrast behaviour. In `.hc`, ticks and rules become `currentColor`, surfaces become solid white/black with 2px borders, and shadows are removed.

## Typography

**Body Font:** Inter Variable (pinned via jsDelivr, fallback system-ui)
**Display Font:** the same Inter Variable, set bold and tight
**Label/Mono Font:** JetBrains Mono Variable (bundled from `src/assets/fonts`)

**Character:** A neutral grotesk carries the words; a drafting mono carries the numbers. The pairing reads like annotation on a drawing.

### Hierarchy
- **Headline** (700, 1.5rem rising to 1.875rem at sm+): page titles in the page header and settings shell.
- **Title** (700, 1.125-1.25rem, tracking-tight): card titles, panel and modal titles, empty-state headings. Clamp to two lines on cards and panels.
- **Stat value** (mono readout, 700, 1.5rem, tabular): headline counts on summary strips — the same JetBrains Mono readout as every other measured value.
- **Body** (400-600, 0.875rem): spec rows, form fields, descriptions; 0.75rem for secondary metadata.
- **Label** (mono 500, 0.68rem, 0.12em tracking, uppercase, slate-500): drafting labels on dimension rules, stat captions, panel tabs (mono 600, 0.75rem, 0.08em).
- **Readout** (mono, tabular figures, tracking-tight): any measured value: order numbers, quantities, percentages, dates, counts.

Text size follows the user's appearance setting: root 14px / 16px / 18px.

### Named Rules
**The Measured-Only Mono Rule.** Mono is for data and measurement, never prose. If a phrase is a sentence, it is Inter.

## Layout

The app shell is a sticky translucent header (blurred, hairline bottom border) over a centred column capped at `max-w-7xl`, padded 16px / 24px / 32px across mobile, sm, and lg, with 24-32px vertical padding. Collections are responsive card grids: one column, two at sm, three at xl, with 16px gaps (12px for stat strips).

Spacing rhythm is a 4px base, in practice 6 / 8 / 12 / 16 / 20px: 12-16px between card blocks, 16px card padding, 20px panel padding, 16-24px between page sections.

Detail and editing happen in a side panel: a right-hand slide-over up to 36rem wide on sm+, and a bottom sheet on mobile. Forms inside it run two columns at sm+ with a sticky save bar pinned to the panel foot.

## Elevation & Depth

Depth is mostly tonal and translucent: sheets are white at 90-97% opacity with an 8-10px backdrop blur over the grid. They carry one quiet two-part shadow: a 1px ground line plus a long, soft, negatively spread drop. Hover deepens the drop and tints the border blue. High-contrast mode removes all shadows.

### Shadow Vocabulary
- **Sheet rest** (`0 1px 0 rgba(13,23,38,0.04), 0 12px 28px -14px rgba(13,23,38,0.22)`): every surface.
- **Sheet hover** (`0 1px 0 rgba(13,23,38,0.04), 0 18px 36px -16px rgba(13,23,38,0.3)`): interactive cards.
- **Primary button** (`inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(13,23,38,0.2), 0 6px 14px -6px rgba(36,84,216,0.55)`): the one coloured shadow, on the main action only.

### Named Rules
**The Paper-Over-Grid Rule.** A surface is a translucent sheet on the drafting grid, never an opaque slab. Depth comes from blur and a soft ground shadow, not from stacked borders.

## Shapes

Corners are crisp and barely softened: 4px on cards, buttons, fields, panels, and modals; 2px on status labels, chips, and avatar squares; 1px on gauge tracks. Full rounding is reserved for LEDs. Structure inside a sheet comes from hairlines: a ruled title-block line under the card header, dimension-line section rules (end ticks, mono label, hairline, measured value), and dotted leaders joining spec labels to their values. Corner registration ticks (11px arms, 1.5px stroke) sit at all four corners of cards and panels.

## Components

### Buttons
- **Shape:** crisp (4px), 10px x 16px, semibold 0.875rem, 6px icon gap.
- **Primary:** Drafting Blue fill, white text, darker blue border, inner highlight and blue drop shadow; hover goes to Deep Drafting Blue.
- **Hover / Focus:** 150ms colour transitions; focus-visible is a 2px blue ring with 2px offset; active presses to 98% scale.
- **Secondary / Danger:** soft wash fill with matching hue text and a faint same-hue border; hover deepens the wash.
- **Ghost:** translucent white with a slate hairline; used for toolbar and header actions.

### Status Pill
- **Style:** an LED plus an uppercase mono label (0.68rem, 600, 0.08em) on a 2px-radius hairline outline in the signal colour at 25%.
- **State:** pending blue, in progress amber with a slow live halo (2.4s ping, dropped under reduced motion), completed teal, overdue red.

### Cards / Containers
- **Corner Style:** 4px, with corner registration ticks tinted by state (blue by default, amber in progress, teal completed, red overdue).
- **Background:** translucent sheet (see Elevation & Depth).
- **Border:** 1px slate hairline; overdue adds a red border at 35%.
- **Internal Padding:** 16px with 14px block gaps.
- **Anatomy (job card):** title-block line (mono "JOB ORDER • number" plus status pill), bold title, metadata and category chips, gauge rows, spec rows with dotted leaders.
- **Entrance:** spring fade-up (stiffness 350, damping 30); layout animation off under reduced motion.

### Inputs / Fields
- **Style:** 4px corners, 1px slate-300 border, near-white translucent fill with an inner top highlight, 10px x 14px.
- **Focus:** border turns Drafting Blue with a 4px blue ring at 15%.
- **Error / Disabled:** `aria-invalid` draws a red border and red ring at 10%; disabled drops to 60% opacity.

### Navigation
- **Shell tabs:** a segmented control in a translucent rounded tray; the active tab sits on a white pill that springs between tabs (shared layout, stiffness 450, damping 35) with bold blue text.
- **Panel tabs:** uppercase mono tabs on a hairline rule; the active tab gets a 2px blue underline marker that springs between tabs (stiffness 500, damping 40). Counts show as small mono readouts.

### Side Panel (signature)
A strong sheet with corner ticks that slides in from the right (spring, stiffness 420, damping 40) over a 40% slate scrim with a 2px blur. On mobile it rises as a bottom sheet. It has a title header, optional tabs, a scrolling body, and a pinned footer. Under reduced motion it fades instead of sliding.

### Drafting Instruments (signature)
- **LED:** 8px lamp with a white ring; the live halo appears only for running work.
- **Gauge:** 6px track tinted at 12-15% of the signal hue; the fill travels to its value over 700ms on `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Dimension Rule:** a section rule drawn as `├ LABEL ──────── value ┤`.

## Do's and Don'ts

### Do:
- **Do** set every measured value (order numbers, counts, dates, percentages) in the mono readout style with tabular figures.
- **Do** show status with an LED, gauge fill, or corner-tick tint, paired with a mono text label.
- **Do** give every new colour a dark-mode value and a high-contrast behaviour; route hairlines and ticks through `--rule` and `--tick` so `.hc` can turn them into `currentColor`.
- **Do** keep motion to purposeful moves (panel slide, gauge fill on `cubic-bezier(0.16,1,0.3,1)`, tab-marker spring) and gate every framer-motion animation on `motionReduced`.
- **Do** keep corners at 4px for sheets and controls, and 2px for chips.

### Don't:
- **Don't** set prose, headings, or sentences in mono.
- **Don't** put coloured left-border strips on cards; status shows through the LED and the corner ticks.
- **Don't** add uppercase eyebrow kickers above titles on new screens.
- **Don't** spread status hue onto backgrounds, headings, or large fills; colour stays mostly ink and slate, with blue for action and signal.
- **Don't** add motion that ignores the reduce-motion setting or exists only for decoration.
