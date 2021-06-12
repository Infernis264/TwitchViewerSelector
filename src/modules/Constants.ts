export interface DBUser {
	twitchid: string;
	channel: string;
	priorityPoints: number;
}
export interface ChannelSettingsType {
	channel: string;
	usePriority: boolean;
}
export interface QueueList {
	[key: string]: QueueUser[];
}
export interface QueueUser {
	display: string;
	twitchid: string;
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