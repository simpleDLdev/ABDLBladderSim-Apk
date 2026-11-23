# Conditioning session pacing (v53)

A two-hour conditioning session on v52 (profile My Conditioning, level Infant, hybrid pacing) logged voids about every 20 minutes and never logged a sip.

## Why the sips never showed

Three gates could drop a sip without a line in the log.

- `scheduleNextHydration` and `triggerHydrationEvent` both return immediately when `hydrationEnabled` is false. That flag is saved with the session and can be left off by a Quick Session. A resumed conditioning session then never armed the 6–12 minute timer.
- Coming back to the app re-armed the main event, then returned if an alarm banner was already open. The sip timer was after that return, so a missed sip was not put back while an event was on screen.
- Aborting a guide logged "Checking hydration levels..." and called `triggerHydrationEvent()` with no force. The same off switch made that call return before any drink line. The banner setup could also throw before the log, which stopped the sip chain.

Conditioning sessions now turn hydration on, re-arm a sip within 12 minutes on resume, re-arm it even when a banner is up, and log the drink before touching the banner. Aborting a guide forces that prompt, and says the tank is low when it is.

## How the tank paces events

Each sip is 15 ml. A slow baseline adds a little between sips. The session shows an estimate in ml and the next-event ETA.

A void is allowed only once the estimate is at least about 20% of capacity (at least 50 ml). Under that, the void is held off and a sip comes first. Above it, a fuller tank means a sooner event, still at least about 8 minutes so two voids are not stacked on an empty bladder. Lowest control still uses the frequent 6–12 minute sip clock, 1–2 sips each time, with no daily cap. Skipping "Not thirsty" removes those sips from the estimate.
