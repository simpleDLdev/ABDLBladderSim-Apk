# Conditioning events review (v52)

Reviewed against the conditioning notes already in the app: a repeated cue, a small routine, a reward the person chose, steps that get harder only when check-ins agree, and no forced holding on an untraining profile. A real need still ends every event.

Direction A is less control. Direction B is more control. A hold drill is direction B, and an untraining profile only receives it when `hold_longer` is opted in.

| Event | Purpose | Direction | When it fires | Change in v52 |
| --- | --- | --- | --- | --- |
| Surprise urge | Shorten the warning so the cue is the urge itself | A, day | Consent on, day track is A | Kept. Still says stop if it gets strong. |
| Just noticed | Notice after the fact, without catching up | A, day | Day track is A | Kept. No push. |
| Relax drill | Passive release, the routine for the relaxed method | A, day | Relaxed method opted in | Kept. Reward is the ease, not a score. |
| Partial moment | Let a little go and stay relaxed | A, day | Day track is A | The second step no longer says "then stop". Staying relaxed replaces a catch. |
| Same cue | Cue, one small step, then the chosen reward | Both, day | Either direction | Added. This is the habit loop in one prompt. |
| Pass request | Asking can be a no | A, day | Day track is A | Kept. Not a guaranteed toilet trip. |
| Sleep through it | Night cue stays quiet | A, night | Stay-in-bed or deeper-sleep method | Kept. |
| Deeper-sleep wind-down | Same bedtime cue | A, night | Deeper-sleep method | Kept. Sip only if thirsty. |
| Hold a bit longer | Short shaping wait, then go | B, day | Day track is B, or A only with `hold_longer` | Untraining no longer receives it unless that method is on. Copy says it is not a max clench. |
| Urge surfing | Notice the wave, then go | B, day | Urge-surfing method | Kept as the more-control drill. |
| Scheduled void | Go at the planned time | B, day | Timed-void method | Kept. |
| Pelvic-floor set | Gentle squeeze, full relax | Both tracks | Kegels method | Kept. Not a max clench. |
| Wake on urge | Get up and finish | B, night | Night track is B | Kept. |

Regular session tables (the full-accident and micro tables) are still the ones a full session rolls. They are not rewritten here. Conditioning-only prompts are the ones in this table, and a high urgency on direction A pulls the next queued session event forward instead of asking for a longer hold.

Hydration follows the existing profile sip counts. Infant (lowest control) uses the dependent profile, whose sip range is the largest. Higher control uses a higher-control profile's smaller range. The prompt is still the regular session sip reminder, and the 1 L cap stays off unless it is turned on.
