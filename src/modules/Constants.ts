export interface DBUser {
	twitchid: string;
	channel: string;
	priorityPoints: number;
}
export interface ChannelSettingsType {
	channel: string;
	method: string;
	prefix: string;
}
export interface QueueList {
	[key: string]: QueueUser[];
}
export interface QueueUser {
	user: string;
	twitchid: string;
	// whether they are a sub or not
	priority: boolean;
}
export interface AvailableChannel {
	channel: string;
	active: boolean;
}
export interface UserAPIResponse {
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
export interface ChannelList {
	[key: string]: string[];
}
export interface UserList extends ChannelList {}
export type DrawType = "random" | "order" | "priority" | "random-nosub";