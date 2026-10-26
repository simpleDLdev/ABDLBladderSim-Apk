# Changelog

## v40 — 2026-10-26

Version name **40**, version code **40**.

- DryClip connect: `BOND_NONE` is logged and does not block connect, arm, re-arm, or the background watch. Forget bond is a supported workflow. Find a clip scans advertising names (and the remembered MAC). Classic pairing is optional.
- Export log copies the full text (JS log plus the native background section) to the clipboard, with a toast. A file download remains if the clipboard is unavailable.
- Natural / office play is a new key, `bs_natural_play_v1`. It is separate from Office Mode (`bs_office_mode`). Protection prompts in Urge, Path, and follow-ups become a restroom trip or a hold of at most 20 minutes. Real urge still wins. DryClip logging stays available.
- Looks: Baby, Toddler, and Teen bedwetter are deeper skins (wallpaper or playroom or dusk diary: background, cards, type, and chrome). Girl and Boy are full skins too — rose dusk with soft cards, slate with a sky stripe — still stored on `bs_play_prefs_v1.theme`.

## v39 — 2026-10-26

Version name **39**, version code **39**.

- DryClip settle latch: a wet bit that started during the settle window and is still latched afterward is cleared once and does not re-arm. The next arm waits until the plate reads dry, or you tap Arm. Unpaired clips (`bond none`) back off instead of reconnecting into another settle loop.
- Clip assists Path: a pending go counts before Start timer, and the hold marker stays after the timer hits 0 until the go is resolved. Soft play stays a flag. The interrupt still needs a tap.
- Padding check before re-arm: random timer inside the existing re-arm window (tunable spread, works with Match protection) so the clip can be aimed at padding that is still dry. Caregiver copy when caregiver mode is on; plainer copy otherwise.
- Path classes: Pull-up Soft (full-length holds, not Leaky Girl), Pad Girl clarified, Night Little for nights. Old picker aliases are gone. Storage ids are unchanged (`pullup`, `leaky`, `little`, …). Every Path and Campaign class has a small #2 modifier. Campaign `dribbler` and Path Leaky Girl are one identity.
- Looks: Baby, Toddler, and Teen bedwetter change background, cards, and type. Girl and Boy accents remain. Stored on `bs_play_prefs_v1.theme`.
