import PriorityDB from "./PriorityDB";
import { randomBytes } from "crypto";
import {QueueUser, DBUser} from "./Types";

export default class RandomSelect {

	private db: PriorityDB;

	constructor(db: PriorityDB) {
		this.db = db;
	}

	/**
	 * Chooses num users from a queue using a given channel's method of queuing
	 * @param channel the twitch channel
	 * @param list the list of people in queue
	 * @param num the number of people to draw. default is 1
	 * @returns the users that were selected
	 */
	public async chooseNFrom(channel: string, list: QueueUser[], num?: number ): Promise<QueueUser[]> {
		if (!num) num = 1;
		if (num > list.length) return null;

		let settings = await this.db.getChannelSettings(channel);

		// creates a copy of the list so the original isn't modified
		list = list.slice();

		switch (settings.method) {
			case "priority":
				return await this.selectRandomWithPriorityQueue(list, channel, num);
			case "random":
				return await this.selectRandomWithSubLuck(list, num);
			case "order":
				return await this.selectInOrder(list, num);
			case "random-nosub":
				return await this.selectRandomNoSubLuck(list, num);
			default:
				return null;
		}
	}

	/**
	 * Draws users from a list using channel points
	 * @param list the list of people in queue
	 * @param channel the twitch channel that priority points should be used for
	 * @param num the number of people to draw
	 * @returns a list of users that have won
	 */
	private async selectRandomWithPriorityQueue(list: QueueUser[], channel: string, num: number): Promise<QueueUser[]> {
		let winners = [];
		let weights = await this.db.getUsersInList(channel, list.map(n=>n.twitchid));

		for (let i = 0; i < num; i++) {
			// draw a winner from the list
			let weighted = new WeightedList(list, weights as any as DBUser[]);
			let winner = weighted.drawOne();
			// remove the winner from the list copy
			let index = list.findIndex(u => (u.twitchid === winner.twitchid));
			list.splice(index, 1);
			// add the winner to the winners array
			winners.push(winner);
			// reset their priority points
			this.db.resetUserPriority(winner.twitchid, channel);
		}
		return winners;
	}

	/**
	 * Draw users from a list giving an extra entry for subs
	 * @param list the list of users to draw from
	 * @param num the number of users to draw
	 * @returns a list of users that have won
	 */
	private selectRandomWithSubLuck(list: QueueUser[], num?: number): QueueUser[] {
		let winners = [];

		for (let i = 0; i < num; i++) {
			// draw a winner from the list
			let weighted = new WeightedList(list);
			let winner = weighted.drawOne();
			// remove the winner from the list copy
			let index = list.findIndex(u => (u.twitchid === winner.twitchid));
			list.splice(index, 1);
			// add the winner to the winners array
			winners.push(winner);
		}
		return winners;
	}

	/**
	 * Randomly draw users from a list
	 * @param list the list of users to draw from
	 * @param num the number of users to draw
	 * @returns a list of winners of the draw
	 */
	private selectRandomNoSubLuck(list: QueueUser[], num?: number): QueueUser[] {
		let winners = [];
		for (let i = 0; i < num; i++) {
			winners.push(list[Math.floor(random() * list.length)]);
		}
		return winners
	}

	/**
	 * Returns the users in the order they joined the list
	 * @param list the list to draw from 
	 * @param num the number of users to draw
	 * @returns the list of winners
	 */
	private selectInOrder(list: QueueUser[], num?: number) {
		return list.slice(0, num ? num : 1);		
	}
}

/**
 * Represents a list with multiple entries per person based on each 
 * user's priority property, giving them an extra entry if they 
 * have priority (if they are subbed) and adding any extra provided weights.
 */
class WeightedList {

	private list: QueueUser[];

	constructor(list: QueueUser[], weights?: DBUser[]) {
		this.list = [];
		list.forEach(user => {
			// Give two entries if user has priority
			let entries = user.priority ? 2 : 1;
			if (weights) {
				let weight = weights.find(w => w.twitchid === user.twitchid);
				entries += weight.priorityPoints;
			}
			for (let i = 0; i < entries; i++) {
				this.list.push(user);
			}			
		});
	}

	public drawOne(): QueueUser {
		let rand = Math.floor(random() * this.list.length);
		let user = this.list.splice(rand, 1)[0];
		return user;
	}

}

/**
 * Cryptographically secure random number probably
 */
function random(): number {
	return parseInt(randomBytes(4).toString("hex"), 16) / 0xffffffff;
}