# CHARACTER-SPEC.md — measured from the client's reference sheets

Sources (client-supplied):
- Sheet A: standing pictogram pose sheet (13 poses, solid black).
- Sheet B: walking / running / crawling cycle sheets (18 figures, side view).

All units are **head diameters (D)**. Measured by overlaying head circles on the
sheets and reading bone lengths / widths against them. Values are rounded to
the nearest 0.05 D; client's starting values are kept where consistent.

| Property | Measured (Sheet A/B) | Value used |
| --- | --- | --- |
| Total standing height | 6.6–7.1 D | **7.0 D** |
| Head diameter | 1.00 D | **1.00 D** (r = 0.5 D) |
| Head→torso gap (visible cream) | 0.15–0.25 D | **0.20 D** |
| Shoulder width | 1.9–2.1 D | **2.00 D** (half 1.0 D) |
| Hip width | 1.35–1.5 D | **1.40 D** (half 0.7 D) |
| Torso length (shoulder line → hip line) | 2.6–2.8 D | **2.70 D** |
| Thigh length | 1.5–1.7 D | **1.60 D** |
| Shin length | 1.5–1.7 D | **1.60 D** |
| Upper arm | 1.3–1.5 D | **1.40 D** |
| Forearm + hand | 1.2–1.4 D | **1.30 D** |
| Arm thickness | 0.40–0.50 D | **0.45 D** |
| Leg thickness | 0.55–0.65 D | **0.60 D** |
| Foot (forward tab at the leg end) | ~0.5 D long, ~0.2 D tall | **0.50 D × 0.20 D** |

## Separation lines (cream) — where they appear in the references
- Between the two legs, from the crotch down to the ankles (the only standing
  separation in every pose) → we achieve it by a cream seam between the two
  legs (the far leg's start offset), not by outlines.
- Where a near arm crosses the torso (e.g. "hand on chest", arms crossed) —
  a thin cream line **only along the crossing**, starting at least one arm
  thickness (0.45 D) away from the shoulder joint — never a ring at the joint.
- Where an arm crosses another arm (side view cycles) — same rule.
- **Never**: outlines around any part, rings at shoulders/hips, cream around
  the head beyond the head-gap itself.

## Construction rules (from the sheets)
1. ONE fill colour for the whole figure (site deep green). Far-side limbs use
   the SAME colour — the silhouette is unified.
2. Each limb = ONE continuous path: shoulder→elbow→wrist and hip→knee→ankle,
   `stroke-linecap: round`, `stroke-linejoin: round`. Hands are the rounded cap
   of the forearm; feet are a small forward shape at the shin end.
3. Torso: rounded trapezoid (2.0 D → 1.4 D), no neck.
4. Head: separate circle with exactly the 0.20 D cream gap.
5. Forward kinematics: fixed bone lengths; poses are **joint angles**; every
   frame interpolates angles (never positions), so bones can never stretch.

## Motion limits (from the cycles in Sheet B)
- Idle/calm joints: ≤ 1.5°/frame. Slump and lean-back: ≤ 3°/frame.
- Breathing: torso+head 1–2 px, period ≈ 3.5 s (105 frames @30fps).
- Loop: frame 479 ≡ frame 0; relief→tired return ≥ 2.5 s, continuous.
