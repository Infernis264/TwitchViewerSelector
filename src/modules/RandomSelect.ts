import PriorityDB from "./PriorityDB";
import { randomBytes } from "crypto";
import {QueueUser, DBUser} from "./Constants";

export default class RandomSelect {
	private db: PriorityDB;
	constructor(db: PriorityDB) {
		this.db = db;
	}
	public async chooseNFrom(channel: string, list: QueueUser[], num?: number ): Promise<QueueUser[]> {
		if (!num) num = 1;
		if (num > list.length) return null;

		let settings = await this.db.getChannelSettings(channel);

		if (settings.usePriority) {
			return await this.selectRandomWithPriorityQueue(list, settings.channel, num);
		} else {
			return await this.selectRandomWithSubLuck(list, num);
		}
	}

	private async selectRandomWithPriorityQueue(list: QueueUser[], channel: string, num: number): Promise<QueueUser[]> {
		list = list.slice();

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

	private selectRandomWithSubLuck(list: QueueUser[], num?: number): QueueUser[] {
		// creates a copy of the list so the original isn't modified
		list = list.slice();

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

	public addPriorityToUsers(list: QueueUser[]) {

	}
}

class WeightedList {

	private list: QueueUser[];

	constructor(list: QueueUser[], weights?: DBUser[]) {
		this.list = [];
		list.forEach(user => {
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
		let rand = Math.floor(this.rand() * this.list.length);
		let user = this.list.splice(rand, 1)[0];
		return user;
	}

	private rand() {
		return parseInt(randomBytes(4).toString("hex"), 16) / 0xffffffff;
	}

}