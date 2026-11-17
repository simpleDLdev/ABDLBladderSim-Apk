# UI review (v49)

Reviewed Settings and the main tabs after conditioning profiles landed at the top of Session and Urge.

## What was cluttered

- **Settings opened two large sections by default** (Play & content, and Calibration & Conditioning) plus the About note. On a phone that is a long scroll before you reach Safety or Data. The conditioning quiz no longer needs to live open here, because the profile picker is the first block on Session and Urge.
- **The conditioning picker repeated a long explanation** under every button row (quiz, export, retake). The same manager is on three screens, so the paragraph showed three times.
- **Session** already collapses nights, the classic board, how-to-start, more actions, test tools, and leak duration. Those were fine. They were just stuck in HTML order.
- **Urge** keeps the classic roll inside one collapse. The new profile picker sits above the drink log, which is the right place, and it does not need a second copy in Settings.
- **The tab bar** has seven icons. Putting up/down controls on the bar would make it harder to hit, not easier.

## What changed

- Play & content, Calibration & Conditioning, and About start **closed**. Tap to open.
- The profile picker note is one short line.
- Every `<details>` inside a tab gets **↑ ↓ Pin Hide** on its summary. Up and down reorder it among the collapses in the same parent. Pin keeps it first. Hide removes it and lists it under **Hidden sections** with a Show button.
- Order, pin, hide, and open/closed are stored in `bs_layout_v1`.
- **Reset layout** is at the top of Settings and restores the original order, shows hidden sections, and clears pins.
- **Tab order** is a list on Settings (Session, Path, Log, Urge, Calendar, Profiles, Settings) with up and down. The bar itself stays icon-only: seven tabs already fill the width, and a drag handle on a 44px tab is easy to miss. The list is the reliable control.

Nothing that starts a session, a roll, or a quiz was removed. Duplicate conditioning editors in Settings were already replaced by a link in v49; this pass only shortens that area and makes the collapses movable.
