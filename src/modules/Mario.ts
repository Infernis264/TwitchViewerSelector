import * as TMI from "tmi.js";
import fetch from "node-fetch";

export enum MarioCommands {
	ADD = "add",
	UNDO = "undo",
	NEXT = "next",
	DUMP = "dumplevels",
	MARIO = "beginmario",
	DIE = "endmario",
	LEVELS = "levels",
	ORWELL = "1984"
}

interface LevelSubmission {
	user: string;
	level: string;
	userid: string;
	title?: string;
}

export default class Mario {

	public static ENABLED = Object.values(MarioCommands);
	public static LEVEL_REGEX = /(?:[0-9a-hj-np-y]){3}(?<S>\-|\s)(?:[0-9a-hj-np-y]){3}\k<S>(?:[0-9a-hj-np-y]){3}/i;
	public static API_URL = "https://tgrcode.com/mm2/level_info/";

	private viewerLevels: {[k:string]: LevelSubmission[]};
	private open: boolean;

	constructor(channels: string[]) {
		this.viewerLevels = {};
		for (let channel of channels) {
			this.viewerLevels[channel] = [];
		}
	}

	async handle(command: string, user: TMI.ChatUserstate, channel: string, param: string): Promise<string> {
		// Give a default parameter of the empty string
		if (!param) param = "";

		let queued;
		let toRemove;
		switch (command) {
			case MarioCommands.ADD:
				if (!this.open) return;
				let chatResponse;
				let level = param.match(Mario.LEVEL_REGEX);
				if (!level) return;
				if (!level[0]) return;

				let toInsert = {
					userid: user["user-id"],
					user: user["display-name"],
					level: level[0],
					title: level[0]
				} as LevelSubmission;

				queued = this.viewerLevels[channel].findIndex(e => e.userid === user["user-id"]);
				console.log(queued, this.viewerLevels[channel]);
				if (queued >= 0) {
					toRemove = this.viewerLevels[channel].splice(queued, 1)[0];
				}
				try {
					let response = await fetch(`${Mario.API_URL}${level[0].replace(/[\s\-]/g, "")}`);
					let data = await response.json();
					//  (${data["difficulty_name"]})
					toInsert.title = `${data["name"]}`;
				} catch (e: any) {}
				console.log(toRemove);
				chatResponse = toRemove ? 
					`@${user["display-name"]} replaced "${toRemove.title}" with "${toInsert.title}"!` :
					`@${user["display-name"]} added "${toInsert.title}" to the list!`;
				this.viewerLevels[channel].push(toInsert);
				return chatResponse;
			break;
			case MarioCommands.UNDO:
				if (!this.open) return;

				queued = this.viewerLevels[channel].findIndex(e => e.userid === user.id);

				if (queued >= 0) {
					toRemove = this.viewerLevels[channel].splice(queued, 1)[0];
				} else return;

				return `@${user["display-name"]} removed "${toRemove.title}"!`;
			break;
			case MarioCommands.NEXT:
				if (!this.open) return;
				if (!this.hasPermission(user)) return;

				let next = this.viewerLevels[channel].splice(0, 1)[0];
				if (next) {
					return `${next.level.toUpperCase()} — "${next.title}" suggested by ${next.user}!`;
				} else {
					return "No levels in the list :(";
				}
			break;
			case MarioCommands.LEVELS:
				if (!this.open) return;

				let len = this.viewerLevels[channel].length;

				if (len > 0) {
					return `Levels (${len}) --> ${this.viewerLevels[channel].map(v => v.user).join(", ")}`;
				} else {
					return `No levels in the list :(`
				}
			break;
			case MarioCommands.DUMP:
				if (!this.open) return;
				if (!this.hasPermission(user)) return;

				this.viewerLevels[channel].splice(0, this.viewerLevels[channel].length);
				return "Removed all levels from list!";
			break;
			case MarioCommands.MARIO:
				if (!this.hasPermission(user)) return;

				this.open = true;
				return "Let's a go! (it's mario time)";
			break;
			case MarioCommands.DIE:
				if (!this.hasPermission(user)) return;

				this.open = false;
				this.viewerLevels[channel].splice(0, this.viewerLevels[channel].length);
				return "Oh nooo 💀💀💀! (mario died)";
			break;
			case MarioCommands.ORWELL:
				if (!this.hasPermission(user)) return;
				if (!this.open) return;
				let normalParam = param.replace("@", "");

				queued = this.viewerLevels[channel].findIndex(e => e.user.toLowerCase() === normalParam.toLowerCase());
				if (queued >= 0) {
					toRemove = this.viewerLevels[channel].splice(queued, 1)[0];
				} else return;
				return `Removed @${normalParam}'s level ${toRemove.title}!`;
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
}
