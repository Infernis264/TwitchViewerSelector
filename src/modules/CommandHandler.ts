import * as TMI from "tmi.js";
import UserTracker from "./UserTracker";
import Queue from "./Queue";
import PriorityDB from "./PriorityDB";
import {ChannelList} from "./Constants";

export default class CommandHandler {

	public static ENABLED = ["join", "joinqueue", "leavequeue", "leave", "queue", "draw", "startqueue", "stopqueue", "remove", "use"];
	public static EXEMPT = ["use", "startqueue"]

	private channels: string[];
	private tracker: UserTracker;
	private queue: Queue;
	private db: PriorityDB;

	constructor(channels: string[]) {
		this.channels = channels;
		this.tracker = new UserTracker(channels, this.cullUsers.bind(this));
		this.db = new PriorityDB("mongodb://localhost:27017/priority")
		this.queue = new Queue(channels, this.db);
		for (let channel of channels) {
			this.db.makeChannelExist(channel);
		}
	}

	async handle(command: string, user: TMI.ChatUserstate, channel: string, param: string): Promise<string> {
		if (!this.queue.isActive(channel) && !CommandHandler.EXEMPT.includes(command)) {
			if (this.hasPermission(user)) {
				return 'You have to use the "startqueue" command if you want to be able to use queue commands';
			} else return;
		}
		
		switch(command) {
			case "join":
			case "joinqueue":
				if(!(await this.db.userExists(user["user-id"], channel))) {
					await this.db.createUser(user["user-id"], channel);
				}
				return this.queue.join(channel, user) ? 
					`@${user["display-name"]} joined the queue!` :
					`@${user["display-name"]} is already in the queue`;
			break;
			// leaves the queue if you are in it
			case "leave":
			case "leavequeue":
				return this.queue.leave(channel, user) ? 
					`@${user["display-name"]} left the queue` :
					null;
			break;
			// logs the queue to the chat
			case "queue":
				return this.queue.toString(channel);
			break;
			// draws a random winner from the queue
			case "draw":
				if (this.hasPermission(user)) {
					let winners = await this.queue.selectUsers(channel, parseInt(param));
					if (winners) {
						return `@${winners.map(u=>u.user).join(" and @")} ${winners.length > 1 ? "are" : "is"} next in line!`;
					} else {
						return parseInt(param) ? 
							`${param} chatter${parseInt(param) > 1 ? "s" : ""} is too many to draw from the queue` :
							param === undefined ? 
								`Queue is empty!` :
								`${param} isn't a number!`;
					}
				}
			break;
			case "stopqueue":
				// adds the priority points to anyone who queued and didn't get drawn if priority queuing is enabled
				if (this.hasPermission(user)) {
					let settings = await this.db.getChannelSettings(channel);
					if (settings.method === "priority") {
						await this.db.sortOutPriorities(channel, this.queue.getUnchosenViewers(channel), this.queue.getChosenViewers(channel));
					}
				}
			// the following code runs for both stopqueue and startqueue
			case "startqueue":
				if (this.hasPermission(user)) {
					let starting = command.includes("start");
					this.queue.setState(channel, starting);
					return `${starting ? "Starting" : "Stopping"} queue`;
				}
			break;
			case "remove":
				if (this.hasPermission(user)) {
					let success = this.queue.removeUser(channel, param);
					return success ?
						`@${param} was removed from the queue!` :
						`Couldn't remove ${param} from the queue!`;
				}
			break;
			case "use":
				if (this.isBroadcaster(user)) {
					param = param ? param.toLowerCase() : param;
					switch(param) {
						case "priority":
						case "random":
						case "order":
							this.db.setChannelSettings(channel, param);
							return `Changed queue type to ${param} queuing!`;
						default:
							return `Invalid queuing type ${param}! Available queuing methods are "priority", "random", and "order"`;
					}
				} else if (this.hasPermission(user)) {
					return "Sorry, but only the broadcaster can change the queue type";
				}
			break;
			case "pp":
				let bal = await this.db.getUserPriority(user["user-id"], channel);
				if (bal > 0) {
					return `You have ${bal} priority points`;
				} else {
					return `You have no priority points`;
				}
			break;
		}
	}

	/**
	 * Checks if a chat user has elevated permissions over a viewer
	 * @param user the chat user whose permissions are being checked
	 * @returns true if the user is a mod or broadcaster, false if they are anything else
	 */
	public hasPermission(user: TMI.ChatUserstate): boolean {
		if (!user["badges-raw"]) user["badges-raw"] = "";
		return user.mod || user["badges-raw"].includes("broadcaster");
	}
	public isBroadcaster(user: TMI.ChatUserstate): boolean {
		return user["badges-raw"].includes("broadcaster");
	}

	/**
	 * Removes any users that are in queue for a channel that aren't in the specified list for the channel
	 * @param channelList a channel name to list of users online mapping that determines which users get to stay in queue
	 */
	private cullUsers(channelList: ChannelList) {
		for (let channel of this.channels) {
			this.queue.removeNotInList(channel, channelList[channel]);
		}
	}
}
