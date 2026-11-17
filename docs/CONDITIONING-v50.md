# Conditioning sips (v50)

A playtest logged a 250 ml drink and then got no sip about 19 minutes later. Two things were stacked.

A full conditioning event called `createDrinkPrompt`, which asks for one glass (200–250 ml) and records it through `BSSafety.capDrink`. That start the 2 hour gap. The real sip timer (`scheduleNextHydration` → `triggerHydrationEvent` → `capSips`) then came back `spacing` and did not show a banner or a phone notification.

## What a conditioning drink is now

Full Session on My Conditioning, and Natural Urge while its profile is My Conditioning, use the same sip loop as a regular session.

- The gap is the profile hydration window from `BSOnboard.sessionPlan` (`hydration.min` / `hydration.max`, usually a few sips, spread out).
- The prompt is "take N sips", not "drink 250 ml".
- `createDrinkPrompt` does nothing while the session profile is conditioning, so a full event cannot add a glass on top.
- The session clock shows **Next sip** and the time. Natural Urge shows the same line when that profile is selected.
- If the 1 L day is used up, the clock says **Sips paused: daily 1 L reached** instead of dropping the reminder.
- When the app is in the background, the sip uses the existing hydration alarm (`native-notify.js`, id 1003). The text is "Sip reminder — a few sips if you are thirsty."

## Safety ledger

`js/safety.js`

- A sip is about 15 ml. Sips count toward the 1 L of prompted drinks per day.
- The 2 hour gap applies to a large prompt (100 ml or more). Sips do not start that clock and are not blocked by it.
- Sips have their own gap: at least 10 minutes, or the profile's hydration minimum when that is longer.
- A drink you log yourself is never blocked and never blocks a large prompt. A logged glass (100 ml or more) only pushes the next sip by about 15 minutes.

A 250 ml prompt or a logged glass, then a sip 19 minutes later inside a 15–35 minute window, still goes through.
