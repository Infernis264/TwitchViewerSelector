import fetch from "node-fetch";
import * as similarity from "similarity";


interface ChannelList {
	[key: string]: Channel
}
interface Channel {
	superusers: string[],
	chatters: string[]
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

export default class UserTracker {

	private static FETCH_INTERVAL = 60 * 1000;
	private static MIN_SIMILARITY = 0.7;
	private channels: string[];
	private channelList: ChannelList;

	constructor(channels: string[]) {
		this.channelList = {};
		// filter out any non-alphanumeric characters from the channel name
		this.channels = channels.map(c=>c.replace(/\W/g, ""));
		// prepare the user list for population
		channels.forEach(channel => {
			this.channelList[channel] = {
				superusers: [],
				chatters: []
			}
		});
		this.populateLists();
		setInterval(this.populateLists.bind(this), UserTracker.FETCH_INTERVAL);
	}
	private async populateLists() {
		for(let i = 0; i < this.channels.length; i++) {
			try {
				let request = await fetch(`https://tmi.twitch.tv/group/user/${this.channels[i]}/chatters`);
				let data = (await request.json() as UserAPIResponse).chatters;
				this.channelList[this.channels[i]] = {
					superusers: [...data.broadcaster, ...data.moderators, ...data.staff, ...data.admins],
					chatters: [...data.viewers, ...data.vips]
				}
			} catch(e) {
				console.log(e);
			}
		}
	}
	/**
	 * Returns the Channel object with the given name
	 * @param channel the twitch channel whose users you are checking
	 * @returns a Channel object
	 */
	public getUsers(channel: string): Channel {
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
		let allUsers = [...this.channelList[channel].chatters, ...this.channelList[channel].superusers];
		if (useFuzzy) {
			let match = this.findBestMatch(allUsers, user);
			return match ? match : false;
		}
		return allUsers.includes(user);
	}
	
	/**
	 * Checks if the user has more permissions on a channel than a viewer
	 * @param channel the channel the user is on
	 * @param user the user whose permissions you are checking
	 * @returns whether the user has elevated permissions or not (are they mod)
	 */
	public isSuperUser(channel: string, user: string): boolean {
		return this.channelList[channel].superusers.includes(user);
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
