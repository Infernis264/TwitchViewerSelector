# Simple Queue Bot
---
Creates a (now slightly complex) queue that can be interacted with using these commands:

---

## User commands

!join - joins the queue

!leave - leaves the queue

!queue - displays all users in the queue

---

## Mod commands

!draw - draws a random person from the queue

!startqueue - allows regular users to use queue commands

!stopqueue - disallows queue commands so chat will not get spammed with commands when the queue isn't open

!remove - removes a person from queue (doesn't stop them from rejoining)

(non-implemented) !ban - bans a person from queuing (probably won't implement unless people really start behaving bad)

---

## Broadcaster commands

!usepriority - switches to priority point system for queuing

!useluck - switches to the default of sub-weighted random queuing (keep in mind that priority points will NOT be awarded in this mode)
