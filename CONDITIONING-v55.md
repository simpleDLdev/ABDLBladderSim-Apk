# Sip batches (v55)

Sips were a prompt every few minutes, and a low-tank check could show a second drink alarm on top of the scheduled one.

A conditioning prompt is now one batch, then a quiet gap. The default, and the lowest-control level, is 4 sips and then 30 minutes. Higher control steps down a little (3, then 2). The batch size and the gap are on the conditioning profile (1–12 sips, 5–180 minutes).

A low tank, or stopping a guide early, uses that same gap. If a batch was already shown, there is no second alarm. The log can say the tank is low and when the next batch is. A batch can come early only when none has been shown in the gap. The tank adds 15 ml per sip, so a batch of 4 is 60 ml, and a void still waits until the estimate is high enough.
