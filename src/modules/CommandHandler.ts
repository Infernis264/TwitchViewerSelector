import * as TMI from "tmi.js";
import {UserTracker, ChannelList} from "./UserTracker";
import Queue from "./Queue";

export default class CommandHandler {

	public static ENABLED = ["join", "leave", "queue", "draw", "startqueue", "stopqueue", "remove"];

	private channels: string[];
	private tracker: UserTracker;
	private queue: Queue;

	constructor(channels: string[]) {
		this.channels = channels;
		this.tracker = new UserTracker(channels, this.cullUsers.bind(this));
		this.queue = new Queue(channels);
	}

	async handle(command: string, user: TMI.ChatUserstate, channel: string, param: string): Promise<string> {
		if (!this.queue.isActive(channel) && command !== "startqueue") {
			if (this.hasPermission(user)) {
				return 'You have to use the "startqueue" command if you want to be able to use queue commands';
			} else return;
		}
		switch(command) {
			// joins the queue if you aren't in it
			case "join":
				return this.queue.join(channel, user) ? 
					`@${user["display-name"]} joined the queue!` :
					`@${user["display-name"]} is already in the queue`;
			break;
			// leaves the queue if you are in it
			case "leave":
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
					let winners = this.queue.selectRandom(channel, Number(param));
					if (winners) {
						return `@${winners.map(u=>u.display).join(" and @")} ${winners.length > 1 ? "are" : "is"} next in line!`;
					} else {
						return Number(param) ? 
							`${param} chatter${Number(param) > 1 ? "s" : ""} is too many to draw from the queue` :
							param === undefined ? 
								`Queue is empty!` :
								`${param} isn't a number!`;
					}
				}
			break;
			case "startqueue":
			case "stopqueue":
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
						`@${user["display-name"]} was removed from the queue!` :
						`Couldn't remove ${user["display-name"]} from the queue!`;
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
