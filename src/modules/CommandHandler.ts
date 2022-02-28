import * as TMI from "tmi.js";
import UserTracker from "./UserTracker";
import Queue from "./Queue";
import PriorityDB from "./PriorityDB";
import {ChannelList} from "./Constants";

export enum Command {
	JOIN_QUEUE = "join",
	LEAVE_QUEUE = "leave",
	DRAW_USER = "draw",
	CHECK_QUEUE = "pool",
	OPEN_QUEUE = "open",
	CLOSE_QUEUE = "close",
	REMOVE_USER = "remove",
	CHANGE_MODE = "use",
	PRIORITY_CHECK = "pp",
	CHANGE_PREFIX = "prefix",
	INFO = "howtouse",
	POOL_MODE = "poolmode"
}

export default class CommandHandler {

	public static ENABLED = ["join","leave","draw","pool","open","close","remove","use","pp","prefix","howtouse","poolmode"];
	private static EMOJIS = ["🐵","🦝","🐶","🐮","🐺","🐷","🐱","🐗","🦁","🐭","🐯","🐹","🦒","🐰","🦊",
		"🐻","🐲","🐔","🦄","🐴","🦓","🐸","🐼","🐨","🐒","🦍","🦧","🐩","🐕","🐈","🐅","🐆","🐎","🦌",
		"🦏","🦛","🐂","🐃","🐄","🐖","🐏","🐑","🐐","🐪","🐁","🐘","🦡","🦨","🦥","🦘","🦙","🐫","🐀",
		"🦔","🐇","🐿","🦎","🐊","🐢","🐍","🐉","🦕","🦖","🦦","🦈","🐬","🐳","🐋","🐟","🐠","🐡","🦐",
		"🦑","🐙","🦞","🦀","🦆","🐓","🦃","🦅","🕊","🦢","🦜","🦩","🦚","🦉","🐦","🐧","🐥","🐤","🦇",
		"🦋","🐌","🐛","🦟","🦗","🐜","🐝","🐞","🦂","🕷"
	];
	public static EXEMPT = [
		Command.OPEN_QUEUE, Command.PRIORITY_CHECK, 
		Command.CHANGE_MODE, Command.CHANGE_PREFIX,
		Command.INFO, Command.POOL_MODE
	];

	private channels: string[];
	private tracker: UserTracker;
	private queue: Queue;
	private db: PriorityDB;
	private prefixes: {[key:string]:string};

	constructor(channels: string[]) {
		this.channels = channels;
		this.tracker = new UserTracker(channels, this.cullUsers.bind(this));
		this.db = new PriorityDB("mongodb://localhost:27017/priority")
		this.queue = new Queue(channels, this.db);
		for (let channel of channels) {
			this.db.makeChannelExist(channel);
		}
		this.prefixes = {};
		this.populatePrefixes();
	}

	async handle(command: string, user: TMI.ChatUserstate, channel: string, param: string): Promise<string> {
		if (!this.queue.isActive(channel) && !CommandHandler.EXEMPT.includes(command as Command)) {
			if (this.hasPermission(user)) {
				return 'You have to use the "open" command if you want to be able to use pooler commands';
			} else return;
		}
		
		switch(command) {
			case Command.JOIN_QUEUE:
				if(!(await this.db.userExists(user["user-id"], channel))) {
					await this.db.createUser(user["user-id"], channel);
				}
				return this.queue.join(channel, user) ? 
					`${user["display-name"]} joined the pool!` :
					`${user["display-name"]} is already in the pool`;

			// Leaves the queue if you are in it
			case Command.LEAVE_QUEUE:
				return this.queue.leave(channel, user) ? 
					`${user["display-name"]} left the pool` :
					null;

			// Logs the queue to the chat
			case Command.CHECK_QUEUE:
				return this.queue.toString(channel);

			// Draws a random winner from the queue
			case Command.DRAW_USER:
				if (this.hasPermission(user)) {
					let winners = await this.queue.selectUsers(channel, parseInt(param));
					if (winners) {
						return `${this.emoji()} @${winners.map(u=>u.user).join(" and @")} ${winners.length > 1 ? "are" : "is"} next in line!`;
					} else {
						return parseInt(param) ? 
							`${param} chatter${parseInt(param) > 1 ? "s" : ""} is too many to draw from the pool` :
							param === undefined ? 
								`Pool is empty!` :
								`${param} isn't a number!`;
					}
				}
			break;
			case Command.CLOSE_QUEUE:
				// adds the priority points to anyone who queued and didn't get drawn if priority queuing is enabled
				if (this.hasPermission(user)) {
					let settings = await this.db.getChannelSettings(channel);
					if (settings.method === "priority") {
						await this.db.sortOutPriorities(channel, this.queue.getUnchosenViewers(channel), this.queue.getChosenViewers(channel));
					}
				}
			// the following code runs for both both closing and opening
			case Command.OPEN_QUEUE:
				if (this.hasPermission(user)) {
					let starting = command === Command.OPEN_QUEUE;
					this.queue.setState(channel, starting);
					return `${starting ? "Starting" : "Stopping"} pooling`;
				}
			break;
			case Command.REMOVE_USER:
				if (this.hasPermission(user)) {
					let success = this.queue.removeUser(channel, param.replace("@",""));
					return success ?
						`${param} was forcibly removed from the pool!` :
						`Couldn't remove ${param} from the pool!`;
				}
			break;
			case Command.CHANGE_MODE:
				if (this.hasPermission(user)) {
					param = param ? param.toLowerCase() : param;
					switch(param) {
						case "priority":
						case "random":
						case "order":
						case "random-nosub":
							this.db.setDrawMethod(channel, param);
							return `Changed drawing type to ${param}!`;
						default:
							return `Invalid drawing type ${param}! Available methods are "priority", "random", "random-nosub", and "order"`;
					}
				}
			break;
			case Command.POOL_MODE:
				if (this.hasPermission(user)) {
					return `Currently using "${(await this.db.getChannelSettings(channel)).method}" pooling!`;
				}
			case Command.PRIORITY_CHECK:
				let bal = await this.db.getUserPriority(user["user-id"], channel);
				if (bal > 0) {
					return `You have ${bal} priority points`;
				} else {
					return `You have no priority points`;
				}
			break;
			case Command.CHANGE_PREFIX:
				if (this.hasPermission(user)) {
					await this.db.setPrefix(channel, param);
					this.prefixes[channel] = await this.db.getPrefix(channel);
					return `Changed prefix to "${this.prefixes[channel]}"`;
				}
			break;
			case Command.INFO:
				return "Command reference over at: https://github.com/Infernis264/TwitchViewerSelector#twitch-viewer-selector";
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

	private async populatePrefixes() {
		this.channels.forEach(async channel => {
			this.prefixes[channel] = await this.db.getPrefix(channel);
		});
	}
	public getPrefix(channel: string) {
		return this.prefixes[channel];
	}
	private emoji(): string {
		return CommandHandler.EMOJIS[Math.floor(Math.random() * CommandHandler.EMOJIS.length)];
	}
}
