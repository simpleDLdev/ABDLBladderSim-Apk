# One event at a time (v54)

A sip prompt and a spasm were sharing the alarm banner. Tapping the sip (or Reveal, after the sip had replaced the button) finished the wrong thing and the visual guide never ran, or it was closed early.

Banners and guides now go through one queue. If a guide or a banner is already up, the next sip or event waits. Logging or skipping a sip does not close a guide. When the guide finishes, or the user logs or aborts it on purpose, the waiting sip shows. A second copy of the same sip or the same banner is dropped, including when a notification tap or a resume fires the catch-up twice.
