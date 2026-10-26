# Changelog

## v39 — 2026-10-26

Version name **39**, version code **39**.

- DryClip settle latch: a wet bit that started during the settle window and is still latched afterward is cleared once and does not re-arm. The next arm waits until the plate reads dry, or you tap Arm. Unpaired clips (`bond none`) back off instead of reconnecting into another settle loop.
- Clip assists Path: a pending go counts before Start timer, and the hold marker stays after the timer hits 0 until the go is resolved. Soft play stays a flag. The interrupt still needs a tap.
- Padding check before re-arm: random timer inside the existing re-arm window (tunable spread, works with Match protection) so the clip can be aimed at padding that is still dry. Caregiver copy when caregiver mode is on; plainer copy otherwise.
- Path classes: Pull-up Soft (full-length holds, not Leaky Girl), Pad Girl clarified, Night Little for nights. Old picker aliases are gone. Storage ids are unchanged (`pullup`, `leaky`, `little`, …). Every Path and Campaign class has a small #2 modifier. Campaign `dribbler` and Path Leaky Girl are one identity.
- Looks: Baby, Toddler, and Teen bedwetter change background, cards, and type. Girl and Boy accents remain. Stored on `bs_play_prefs_v1.theme`.
