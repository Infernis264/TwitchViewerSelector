# Queue Priority Mechanism
The queue has been reworked in an effort to make drawing names more equitable for everyone. People are assigned priority points that give them a higher chance of being drawn from the queue (one priority point equals one more entry into the queue that can be drawn). Viewers earn priority points in these ways:
1. Being a subscriber to the channel (1 persistant point)
2. Being in the queue when the `!stopqueue` command is used (+1 temporary priority point)
3. Being given priority through the broadcaster-only command `!priority [num]` (+num priority points \[default is 1\])
When a user is drawn from the queue, their priority points are reset to 0 if they aren't subbed and to 1 if they are. Viewers that have been drawn since the `!startqueue` command was used will be ineligible for earning priority points from the `!stopqueue` command (this makes it harder for consecutive wins across multiple queuing sessions). 
---
This should have the effect of increasing the odds of being chosen the longer a viewer isn't drawn. Keep in mind that this *does* disadvantage those who cannot stay around to the end of streams or whenever queueing is stopped, so in the future, points awarded might be based on whoever joins the queue during the time it is open and is not drawn.