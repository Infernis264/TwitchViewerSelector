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

	private selectRandomNoSubLuck(list: QueueUser[], num?: number): QueueUser[] {
		let winners = [];
		for (let i = 0; i < num; i++) {
			winners.push(list[Math.floor(random() * list.length)]);
		}
		return winners
	}

	private selectInOrder(list: QueueUser[], num?: number) {
		return list.slice(0, num ? num : 1);		
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
		let rand = Math.floor(random() * this.list.length);
		let user = this.list.splice(rand, 1)[0];
		return user;
	}

}

function random(): number {
	return parseInt(randomBytes(4).toString("hex"), 16) / 0xffffffff;
}