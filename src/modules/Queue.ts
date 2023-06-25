import {ChatUserstate} from "tmi.js";
import PriorityDB from "./PriorityDB";
import UserPicker from "./UserPicker";
import {AvailableChannel, QueueUser, QueueList, UserList, QueueMap} from "./Types";

export default class Queue {
	
	// Stores a list of all people that are in line waiting to be drawn
	private queue: QueueList;

	// Stores a list of all people that have joined the queue at any point
	// while the queue is open. Only increases in size until the queue is closed.
	private hasJoinedQueue: QueueMap;

	// stores the people who have queued and gotted drawn
	private drawn: UserList;

	private willBeRemoved: UserList;

	// this data structure needs to be changed but right now I dont have time
	private available: AvailableChannel[];
	private picker: UserPicker;

	/**
	 * Makes a new instance of the queue class
	 * @param channels the list of channels that queues should be created for
	 * @param db the mongoose database that holds channel settings and priority points
	 */
	constructor(channels: string[], db: PriorityDB) {
		this.queue = {};
		this.hasJoinedQueue = {};
		this.drawn = {};
		this.available = [];
		this.willBeRemoved = {};
		for (let channel of channels) {
			this.queue[channel] = [];
			this.hasJoinedQueue[channel] = new Map();
			this.drawn[channel] = [];
			this.available.push({
				channel: channel,
				active: false
			});
			this.willBeRemoved[channel] = [];
		}
		this.picker = new UserPicker(db);
	}
	
	/**
	 * Adds a user to a channel's queue 
	 * @param channel the channel the queue is in
	 * @param user the user that is joining queue
	 * @returns true if they could join the queue, false if they are already in the queue
	 */
	public join(channel: string, user: ChatUserstate): boolean {
		if (this.getUserPos(channel, user["user-id"]) >= 0) {
			return false;
		}
		let entry = {
			twitchid: user["user-id"],
			user: user.username,
			// Sometimes the user.badges object is null if the user doesn't have any badges
			priority: user.badges ? "subscriber" in user.badges || "founder" in user.badges : false
		};
		// Add the user to the queue
		this.queue[channel].push(entry);
		// Mark the user as having joined
		this.hasJoinedQueue[channel].set(entry.twitchid, entry);
		return true;
	}

	/**
	 * Removes a user from the queue
	 * @param channel the channel the queue is in
	 * @param user the user that is joining the queue
	 * @returns if the user successfully left queue 
	 */
	public leave(channel: string, user: ChatUserstate): boolean {
		let queuePos = this.getUserPos(channel, user["user-id"]);
		// If the user is found, remove them from the queue
		if (queuePos >= 0) {
			this.queue[channel].splice(queuePos, 1);
			return true;
		}
		return false;
	}

	/**
	 * Users are drawn according to the channel's specified method of drawing users
	 * @param channel the channel the queue is for
	 * @param num the number of users to draw from queue
	 * @returns an array of chosen users who have won the drawing
	 */
	public async selectUsers(channel: string, num?: number): Promise<QueueUser[]> {
		// Draw 1 viewer by default
		num = num > 0 ? num : 1;
		// Draw only if there are people in the queue
		if (num > this.queue[channel].length) return null;
		
		let chosenOnes = await this.picker.chooseNFrom(channel, this.queue[channel], num);

		for(let winner of chosenOnes) {
			let index = this.queue[channel].findIndex(u => (u.twitchid === winner.twitchid));
			this.queue[channel].splice(index, 1);
			this.drawn[channel].push(winner.twitchid);
		}
		return chosenOnes;
	}

	/**
	 * Gets a user's index in the current queue for a channel
	 * @param channel the channel the queue is for
	 * @param userid the id of the user whose index is being checked
	 * @returns the user's index in the queue 
	 */
	private getUserPos(channel: string, userid: string): number {
		for (let i = 0; i < this.queue[channel].length; i++) {
			if (this.queue[channel][i].twitchid === userid) {
				return i;
			}
		}
		return -1;
	}
	

	/**
	 * Culls users from the queue that aren't in the provided list
	 * @param channel the channel the queue is for
	 * @param list the list of users that can remain in queue
	 */
	public removeNotInList(channel: string, list: string[]) {
		let inQueueNotInList = this.queue[channel].map(n=>n.user).filter(x => !list.includes(x));
		let isNowInList = this.willBeRemoved[channel].filter(n => list.includes(n));
		for (let res of isNowInList) {
			this.resetRemovalStatus(channel, res);
		}
		for (let i = 0; i < inQueueNotInList.length; i++) {
			if (this.willBeRemoved[channel].includes(inQueueNotInList[i])) {
				this.removeUser(channel, inQueueNotInList[i]);
				this.resetRemovalStatus(channel, inQueueNotInList[i]);
			} else {
				this.willBeRemoved[channel].push(inQueueNotInList[i]);
			}
		}
	}

	/**
	 * Removes a user from the queue removal array
	 * @param channel the channel the user is on
	 * @param username the username of the person who is being removed
	 * @returns true if the removal was successful
	 */
	private resetRemovalStatus(channel: string, username: string): boolean {
		let index = this.willBeRemoved[channel].findIndex(n => n === username);
		if (index >= 0) {
			this.willBeRemoved[channel].splice(index, 1);
			return true;
		}
		return false;
	}
	
	/**
	 * Forcibly removes a user from queue by twitch id
	 * @param channel the channel the queue is for
	 * @param username the username of the person being removed from queue
	 * @returns true if the user was removed, false if the user couldn't be removed
	 */
	public removeUser(channel: string, username: string): boolean {
		if (!username) return false;
		for(let i = 0; i < this.queue[channel].length; i++) {
			if (this.queue[channel][i].user.toLowerCase() === username.toLowerCase()) {
				this.queue[channel].splice(i, 1);
				return true;
			}
		}
		return false;
	}

	/**
	 * Sets the queue to run and accept queue commands in a channel
	 * @param channel the channel to set the queue state of
	 * @param active whether the queue should be disabled (false) or enabled (true)
	 */
	public setState(channel: string, active: boolean): void {
		let index = this.available.findIndex(n=>n.channel === channel);
		this.available[index].active = active;
		if (!active) {
			this.queue[channel] = [];
			this.hasJoinedQueue[channel] = new Map();
			this.drawn[channel] = [];
		}
	}

	/**
	 * Checks if a queue is currently running in the given channel
	 * @param channel the channel to check whether there is an active queue in
	 * @returns true if the queue is running, false if it isn't
	 */
	public isActive(channel: string): boolean {
		let c = this.available.find(n=>n.channel === channel);
		if (c) return c.active;
		return false;
	}

	/**
	 * Gets a list of viewers that have joined queue but haven't been drawn
	 * @param channel the channel to get unchosen viewers for
	 * @returns the list of people that haven't been drawn yet
	 */
	public getUnchosenViewers(channel: string): QueueUser[] {
		return Array.from(this.hasJoinedQueue[channel].values()).filter(x =>
			!this.drawn[channel].includes(x.twitchid)
		);
	}
	
	/**
	 * Generates a string out of all the people currently in queue
	 * @param channel the channel to generate a queue string for
	 * @returns the queue in a human-readable string form
	 */
	public toString(channel: string): string {
		if (this.queue[channel].length === 0) {
			return "Pool is empty!";
		}
		return `Pool (${this.queue[channel].length}): ${this.queue[channel].map(u=>u.user).join(" ")}`;
	}
}

