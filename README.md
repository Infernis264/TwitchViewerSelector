
# Simple Queue Bot

  

This is an IRC chatbot that stores a queue of viewers on a Twitch stream, and allows them to be drawn in a weighted random order.
  

## How queue priority works

The formerly sub-luck weighted random queue has been reworked in an effort to make drawing names more equitable for all viewers. The new method of queuing is opt-in and can be changed to the new one with the broadcaster only command `!usepriority` and to the old with `!useluck`.

In priority queuing mode, people earn priority points that give them a higher chance of being drawn from the queue. One priority point is equivalent to an extra entry into the queue, which in turn makes it more likely for a viewer to be drawn if they have more points. 

---
Viewers earn priority points in these ways:

1. Being a subscriber to the channel (1 persistent point)

3. Having joined the queue with `!join` and not getting drawn by the time the `!stopqueue` command is used (+3 temporary priority points)
---
When a user is drawn from the queue, **their priority points are reset to 0 if they aren't subbed and 1 if they are**. Viewers that have been drawn since the `!startqueue` command was used will be ineligible for earning priority points from the `!stopqueue` command. This makes it harder for frequently-queuing and undrawn individuals to go without being drawn for long periods of time.  
## Command Reference
### Queue commands:
`!join` - Puts the user of the command into the queue

`!leave` - If the user is in the queue, removes them from it

`!queue` - Sends the list of names of people in the queue in the chat
  

### Moderator commands:
`!draw` - Draws a random person from the queue

`!startqueue` - Allows regular chat members to use the queue commands and opens up the queue for joining

`!stopqueue` - Disallows queue commands, closes the queue, and awards priority points to undrawn users in priority queuing mode

`!remove` - Forcibly removes a person from the queue and resets their priority points to zero in priority queuing mode
  

### Broadcaster only commands:
`!usepriority` - switches to the priority point system for queuing

`!useluck` - switches to the original sub-weighted random queuing. Priority points will **NOT** be awarded in this mode