
# Twitch Viewer Chooser

An IRC chatbot that stores a list of viewers on a Twitch stream and allows their names to be drawn in three ways: the order chatters joined, randomly, and weighted randomly.

## How weighted randomness works

In the case that there is too many people to draw during one stream, streamers can use weighted-random drawing to give everyone a chance to be drawn across multiple uses of the bot. Each time the pool is closed while weighted-random drawing is active, undrawn viewers who are still in the pool earn priority points that give them more weight to be drawn in the future. One priority point is equivalent to an extra "person" in the pool, which means that if a viewer has 12 priority points, it is as if 12 *extra* copies of them are placed in the pool. This would make it so that someone with 0 priority points gets only *one* entry and no *bonus* entries from priority points. In this example the first viewer gets 13 total entries versus the second only getting 1 entry, making it very likely that the first viewer will get drawn. When a viewer *is* drawn, their priority points are reset to zero, allowing those who aren't drawn multiple times more and more likely to be drawn.

---
Viewers earn priority points in these ways:

1. Being a subscriber to the channel (1 persistent priority point)

2. Having joined the pool with the `join` command and not getting drawn by the time the `close` command is used (+3 temporary priority points)
---
When a user is drawn from the pool, **their priority points are reset to 0 if they aren't subbed and 1 if they are**. Viewers that have been drawn since the `open` command was used will be **ineligible** for earning priority points from the `close` command. This makes it easier for those who join frequently and don't get drawn unlikely to go undrawn for long periods of time.  
## Command Reference
### Prefixes 
All commands use a prefix before their command name which can be set with the `prefix` command. The default prefix is an exclamation point: `!`
`prefix [new prefix]` - Sets the string that will precede commands for your channel. (ex: If the prefix for the channel was `!`, using `!prefix #` would change the prefix to `#` and all further commands would use this word/character to activate (i.e. to change the prefix back to `!`, you would have to run `#prefix !`))

### Pooling commands:
`join` - Puts the viewer using the command into the drawing pool

`leave` - If the viewer using the command is in the pool, removes them from it

`pool` - Sends the list of names of people who are in the pool to the chat
  
`pp` - Sends the amount of priority points the user using the command has in chat

### Moderator commands:
`draw` - Draws a viewer from the pool using the method set by the `use` command

`open` - Allows chat members to use the pooling commands to join, leave, and check who's in the pool 

`close` - Disallows chat members to use pooling commands and awards priority points in weighted-random pooling

`remove [username]` - Forcibly removes a person from the pool but doesn't prevent them from rejoining

`use [drawing type]` - switches to the specified system for pooling. The three types are as follows:
1) `priority` - Uses accumulated priority points to weight drawing in favor of those who aren't drawn as often across separate pools
2) `random` - Randomly chooses viewers with an extra entry for those subscribed to the channel
3) `order` - The simplest method, draws people in the order they entered the pool
