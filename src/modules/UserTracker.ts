import fetch from "node-fetch";
import * as similarity from "similarity";

export interface ChannelList {
	[key: string]: string[];
}

interface UserAPIResponse {
	_links: any;
	chatter_count: number;
	chatters: {
		broadcaster: string[];
		vips: string[];
		moderators: string[];
		staff: string[];
		admins: string[];
		global_mods: string[];
		viewers: string[];
	}
}

export class UserTracker {

	private static FETCH_INTERVAL = 10 * 60 * 1000;
	private static MIN_SIMILARITY = 0.7;
	private channels: string[];
	private channelList: ChannelList;
	private expiry: (list: ChannelList) => void;

	constructor(channels: string[], expiry: (list: ChannelList)=>void) {
		this.expiry = expiry;
		this.channelList = {};
		// filter out any non-alphanumeric characters from the channel name
		this.channels = channels.map(c=>c.replace(/\W/g, ""));
		// prepare the user list for population
		channels.forEach(channel => {
			this.channelList[channel] = [];
		});
		this.populateLists();
		setInterval(this.populateLists.bind(this), UserTracker.FETCH_INTERVAL);
	}
	private async populateLists() {
		for(let i = 0; i < this.channels.length; i++) {
			try {
				let request = await fetch(`https://tmi.twitch.tv/group/user/${this.channels[i]}/chatters`);
				let data = (await request.json() as UserAPIResponse).chatters;
				this.channelList[this.channels[i]] = [
					...data.broadcaster, ...data.moderators, ...data.staff, ...data.admins, ...data.viewers, ...data.vips
				]
			} catch(e) {
				console.log(e);
			}
		}
		this.expiry(this.channelList);
	}
	/**
	 * Returns the Channel object with the given name
	 * @param channel the twitch channel whose users you are checking
	 * @returns a Channel object
	 */
	public getUsers(channel: string): string[] {
		return this.channelList[channel];
	}

	/**
	 * Checks whether a user is currently joined in a twitch irc chat channel
	 * @param channel the channel to check the chat of
	 * @param user the user you are searching for
	 * @param useFuzzy whether or not to use fuzzy string similarity for matching usernames
	 * @returns true if the said user can be found in chat, false if the user can't be found
	 */
	public isUserInChat(channel: string, user: string, useFuzzy: boolean): (boolean | string) {
		if (useFuzzy) {
			let match = this.findBestMatch(this.channelList[channel], user);
			return match ? match : false;
		}
		return this.channelList[channel].includes(user);
	}

	/**
	 * Checks if a target is in a list of words using loose string similarity and returns the closest
	 * matching string in the list.
	 * @param list The list of words to compare to the target
	 * @param target the string that a similar or exact copy should be found in list
	 * @returns the string in the list that best matches the target, or null if there isn't one
	 */
	private findBestMatch(list: string[], target: string): string {
		let weights: number[] = []; 
		for (let i = 0; i < list.length; i++) {
			weights.push(similarity(list[i], target));
		}
		let max = Math.max(...weights);
		return (max >= UserTracker.MIN_SIMILARITY) ? list[weights.indexOf(max)] : null;
	}
}
