import * as TMI from "tmi.js";
import UserTracker from "./UserTracker";
import Queue from "./Queue";
import PriorityDB from "./PriorityDB";
import {ChannelList, DrawType, DrawTypeArr} from "./Types";

export enum BaseCommands {
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
	POOL_MODE = "poolmode",
	RIG = "addpp",
	UNRIG = "removepp"
}

export default class CommandHandler {

	public static ENABLED = Object.values(BaseCommands);
	private static EMOJIS = [
		"🐵","🦝","🐶","🐮","🐺","🐷","🐱","🐗","🦁","🐭","🐯","🐹","🦒","🐰","🦊","🐻","🐲","🐔","🦄",
		"🐴","🦓","🐸","🐼","🐨","🐒","🦍","🦧","🐩","🐕","🐈","🐅","🐆","🐎","🦌","🦏","🦛","🐂","🐃",
		"🐄","🐖","🐏","🐑","🐐","🐪","🐁","🐘","🦡","🦨","🦥","🦘","🦙","🐫","🐀","🦔","🐇","🐿","🦎",
		"🐊","🐢","🐍","🐉","🦕","🦖","🦦","🦈","🐬","🐳","🐋","🐟","🐠","🐡","🦐","🦑","🐙","🦞","🦀",
		"🦆","🐓","🦃","🦅","🕊","🦢","🦜","🦩","🦚","🦉","🐦","🐧","🐥","🐤","🦇","🦋","🐌","🐛","🦟",
		"🦗","🐜","🐝","🐞","🦂"
	];
	public static EXEMPT = [
		BaseCommands.OPEN_QUEUE, BaseCommands.PRIORITY_CHECK, 
		BaseCommands.CHANGE_MODE, BaseCommands.CHANGE_PREFIX,
		BaseCommands.INFO, BaseCommands.POOL_MODE, BaseCommands.RIG,
		BaseCommands.UNRIG
	];

	private channels: string[];
	private tracker: UserTracker;
	private queue: Queue;
	private db: PriorityDB;
	private prefixes: {[key:string]:string};

	constructor(channels: string[], dbname: string) {
		this.channels = channels;
		this.tracker = new UserTracker(channels, this.cullUsers.bind(this));
		this.db = new PriorityDB(dbname)
		this.queue = new Queue(channels, this.db);
		for (let channel of channels) {
			this.db.makeChannelExist(channel);
		}
		this.prefixes = {};
		this.populatePrefixes();
	}

	async handle(command: string, user: TMI.ChatUserstate, channel: string, param: string): Promise<string> {
		if (!this.queue.isActive(channel) && !CommandHandler.EXEMPT.includes(command as BaseCommands)) {
			if (this.hasPermission(user)) {
				return 'You have to use the "open" command if you want to be able to use pooler commands';
			} else return;
		}
		// Give a default parameter of the empty string
		if (!param) param = "";
		const normalParams = param.toLowerCase().replace("@", "").split(" ");

		switch(command) {
			case BaseCommands.JOIN_QUEUE:
				if(!(await this.db.userExists(user["user-id"], channel))) {
					await this.db.createUser(user["user-id"], user["username"], channel);
				}
				return this.queue.join(channel, user) ? 
					`@${user["display-name"]} joined the pool!` :
					`@${user["display-name"]} is already in the pool`;

			// Leaves the queue if you are in it
			case BaseCommands.LEAVE_QUEUE:
				return this.queue.leave(channel, user) ? 
					`@${user["display-name"]} left the pool` :
					null;

			// Logs the queue to the chat
			case BaseCommands.CHECK_QUEUE:
				return this.queue.toString(channel);

			// Draws a random winner from the queue
			case BaseCommands.DRAW_USER:				
				if (this.hasPermission(user)) {
					// By default, draw one person if no parameter specified
					let numDraw = param !== "" ? parseInt(param) : 1;
					if (numDraw < 1 || isNaN(numDraw)) {
						return `"${param}" isn't a number!`;
					}
					let winners = await this.queue.selectUsers(channel, numDraw);
					if (winners) {
						return `${this.emoji()} @${winners.map(u=>`${u.user}${u.pp ? ` (${u.pp} pp)` : ""}`)
							.join(" and @")} ${winners.length > 1 ? "are" : "is"} next in line!`;
					} else {
						return numDraw === 1 ? 
							`Pool is empty!` : 
							`${numDraw} chatters is too many to draw from the pool!`;
					}
				}
			break;
			case BaseCommands.CLOSE_QUEUE:
				// adds the priority points to anyone who queued and didn't get drawn if priority queuing is enabled
				if (this.hasPermission(user)) {
					let settings = await this.db.getChannelSettings(channel);
					if (settings.method === "priority") {
						await this.db.giveOutPriorityPoints(channel, this.queue.getUnchosenViewers(channel));
					}
				}
			// the following code runs for both both closing and opening
			case BaseCommands.OPEN_QUEUE:
				if (this.hasPermission(user)) {
					let starting = command === BaseCommands.OPEN_QUEUE;
					this.queue.setState(channel, starting);
					return `${starting ? "Starting" : "Stopping"} pooling`;
				}
			break;
			case BaseCommands.REMOVE_USER:
				if (this.hasPermission(user)) {
					let success = this.queue.removeUser(channel, normalParams[0]);
					return success ?
						`${param} was forcibly removed from the pool!` :
						`Couldn't remove ${param} from the pool!`;
				}
			break;
			case BaseCommands.CHANGE_MODE:
				if (this.hasPermission(user)) {
					let success = await this.db.setDrawMethod(channel, param.toLowerCase() as DrawType);
					if (success) {
						return `Changed drawing method to ${param}!`;
					} 
					return `Invalid drawing method ${
							param
						}! Available methods are "${
							DrawTypeArr.join(`", "`)
						}"`;
				}
			break;
			case BaseCommands.POOL_MODE:
				if (this.hasPermission(user)) {
					return `Currently using "${(await this.db.getChannelSettings(channel)).method}" pooling!`;
				}
			case BaseCommands.PRIORITY_CHECK:
				let bal;
				let toUser = `${user["display-name"]} has`;
				if (this.hasPermission(user) && param) {
					// Get priority points for a specific user
					bal = await this.db.getPriorityByUsername(channel, normalParams[0]);
					if (bal === null) return `I don't know who ${param} is!`;
					toUser = `${param} has`;
				} else {
					// Get chatter's own priority points
					bal = await this.db.getPriorityById(channel, user["user-id"]);
				}
				// Replace 0 priority points with "no priority points"
				if (bal === 0) bal = "no";

				// user has x priority points
				return `${toUser} ${bal} priority points`;
			break;
			case BaseCommands.CHANGE_PREFIX:
				if (this.hasPermission(user)) {
					await this.db.setPrefix(channel, param);
					this.prefixes[channel] = await this.db.getPrefix(channel);
					return `Changed prefix to "${this.prefixes[channel]}"`;
				}
			break;
			case BaseCommands.UNRIG:
				if (!this.hasPermission(user)) {
					return;
				}
				if (!normalParams[0] || !normalParams[1]) {
					return `USAGE: ${this.getPrefix(channel)}${BaseCommands.UNRIG} [username] [points]`;
				}
				// How many points they are trying to remove
				let pointRemove = Number(normalParams[1]);
				if (isNaN(pointRemove)) {
					return `Can't remove ${normalParams[1]} points from ${normalParams[0]}!`;
				}
				// It's good, so do the database query
				let unrigged = await this.db.removePriorityByUsername(channel, normalParams[0], pointRemove);
				if (unrigged === null) {
					return `Error removing priority points from ${normalParams[0]}, have they joined the pool before?`;
				}
				return `Successfully unrigged the pool for ${normalParams[0]}, they now have ${unrigged} points!`;
			break;
			case BaseCommands.RIG: 
				if (!this.hasPermission(user)) {
					return;
				}
				if (user.username === normalParams[0]) {
					return `You can't rig the pool for yourself >:(`;
				}
				if (!normalParams[0] || !normalParams[1]) {
					return `USAGE: ${this.getPrefix(channel)}${BaseCommands.RIG} [username] [points]`;
				}
				// How many points they are trying to add
				let pointAdd = Number(normalParams[1]);
				if (isNaN(pointAdd)) {
					return `Can't add ${normalParams[1]} points to ${normalParams[0]}!`;
				}
				if (pointAdd <= 0 || pointAdd > PriorityDB.MAX_PP_ADD) {
					return `You can only add 1 to ${PriorityDB.MAX_PP_ADD} priority points at a time!`;
				}
				// It's good, so do the database query
				let rigged = await this.db.addPriorityByUsername(channel, normalParams[0], pointAdd);
				if (rigged === null) {
					return `Error adding priority points to ${normalParams[0]}, have they joined the pool before?`;
				}
				return `Successfully rigged the pool for ${normalParams[0]}, they now have ${rigged} points!`;
			break;
			case BaseCommands.INFO:
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
