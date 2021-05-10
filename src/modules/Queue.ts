import {ChatUserstate} from "tmi.js";

interface QueueList {
	[key: string]: User[];
}
interface User {
	display: string;
	name: string;
	priority: boolean;
}

export default class Queue {
	
	private queue: QueueList;
	private active: string[];

	constructor(channels: string[]) {
		this.queue = {};
		this.active = [];
		channels.forEach(channel => {
			this.queue[channel] = [];
		});
	}
	public join(channel: string, user: ChatUserstate): boolean {
		if (this.getUserPos(channel, user.username) >= 0) {
			return false;
		}
		this.queue[channel].push({name: user.username, display: user["display-name"], priority: user.subscriber});
		return true;
	}
	public leave(channel: string, user: ChatUserstate): boolean {
		let queuePos = this.getUserPos(channel, user.username);
		if (queuePos >= 0) {
			this.queue[channel].splice(queuePos, 1);
			return true;
		}
		return false;
	}
	public selectRandom(channel: string, num?: number): User[] {
		if (!num) num = 1;
		if (num > this.queue[channel].length) return null;
		let winners = [];
		for (let i = 0; i < num; i++) {
			let list = new WeightedList(this.queue[channel]);
			console.log(list);
			let winner = list.drawOne();
			let index = this.queue[channel].findIndex(u=>(u.name === winner.name));
			this.queue[channel].splice(index, 1);
			winners.push(winner);
		}
		return winners;
	}
	private getUserPos(channel: string, user: string): number {
		for (let i = 0; i < this.queue[channel].length; i++) {
			if (this.queue[channel][i].name === user) {
				return i;
			}
		}
		return -1;
	}
	public removeNotInList(channel: string, list: string[]) {
		for (let i = 0; i < this.queue[channel].length; i++) {
			if (!list.includes(this.queue[channel][i].name)) {
				this.queue[channel][i] = null;
			}
		}
		this.queue[channel] = this.queue[channel].filter(n => n !== null);
	}
	public removeUser(channel: string, user: string): boolean {
		for(let i = 0; i < this.queue[channel].length; i++) {
			if (this.queue[channel][i].name === user) {
				this.queue[channel].splice(i, 1);
				return true;
			}
		}
		return false;
	}
	public setState(channel: string, active: boolean) {
		let exists = this.active.includes(channel);
		if (active) {
			if (!exists) this.active.push(channel);
		} else {
			if (exists) this.active.splice(this.active.indexOf(channel), 1);
		}
	}
	public isActive(channel: string) {
		return this.active.includes(channel);
	}
	public toString(channel: string): string {
		if (this.queue[channel].length === 0) {
			return "Queue is empty!";
		}
		return `Queue: @${this.queue[channel].map(u=>u.display).join(", @")}`;
	}
}

class WeightedList {

	private list: User[];

	constructor(list: User[]) {
		this.list = [];
		list.forEach(user => {
			this.list.push(user);
			// add the user twice to the list if they have priority
			if (user.priority) {
				this.list.push(user);
			}
		});
	}

	public drawOne(): User {
		let rand = Math.floor(Math.random() * this.list.length);
		let user = this.list.splice(rand, 1)[0];
		return user;
	}

}