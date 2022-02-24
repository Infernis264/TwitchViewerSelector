import { Document, Schema, LeanDocument } from "mongoose";
import * as mongoose from "mongoose";
import {ChannelSettingsType, DBUser, DrawType} from "./Constants";

const User = mongoose.model("User", new Schema({
	twitchid: String,
	channel: String,
	priorityPoints: Number
}));

const ChannelSettings = mongoose.model("ChannelSettings", new Schema({
	channel: String,
	method: String,
	prefix: String
}));

const EnabledList = mongoose.model("EnabledChannels", new Schema({
	channel: String
}));

export default class PriorityDB {

	public static PRIORITY_WEIGHT = 3;
	public db: typeof mongoose;

	/**
	 * Creates a new PriorityDB with a provided mongodb url
	 * @param url the database url
	 */
	constructor(url: string) {
		mongoose.connect(url);
		mongoose.set("returnOriginal", false);
	}

	/**
	 * 
	 * @param channel the channel whose draw method is being set
	 * @param method 
	 */
	public async setDrawMethod(channel: string, method: DrawType): Promise<void> {
		this.makeChannelExist(channel, method);
		await ChannelSettings.updateOne({channel: channel}, {method: method}).exec();
	}
	
	/**
	 * Makes a channel exist if one doesn't exist by the provided name already
	 * @param channel the channel whose settings don't exist but should
	 * @param method the method of queueing the channel should use
	 * @param prefix the command prefix the channel should use
	 */
	public async makeChannelExist(channel: string, method?: DrawType, prefix?: string) {
		let exists = await this.channelExists(channel);
		if (!exists) {
			(new ChannelSettings({
				channel: channel,
				method: method ? method : "random",
				prefix: prefix ? prefix : "!"
			})).save();
		}
	}

	/**
	 * Gets the settings of a channel
	 * @param channel the channel to get the settings of
	 * @returns a channel settings object
	 */
	public async getChannelSettings(channel: string): Promise<ChannelSettingsType> {
		await this.makeChannelExist(channel);
		return (await ChannelSettings.findOne({channel: channel}).lean().exec()) as any as ChannelSettingsType;
	}

	/**
	 * Checks if a channel exists
	 * @param channel the channel whose existence is being checked
	 * @returns true if the channel exists
	 */
	private async channelExists(channel: string): Promise<boolean> {
		return (await ChannelSettings.countDocuments({channel: channel}).exec()) === 1;
	}

	/**
	 * Creates a new user in the database
	 * @param twitchid the id of the user that will be added to the database
	 * @param channel the channel the user is linked to
	 * @returns the created User document
	 */
	public async createUser(twitchid: string, channel: string): Promise<Document<DBUser>> {
		let chatUser = new User({
			twitchid: twitchid.toLowerCase(),
			channel: channel.toLowerCase(),
			priorityPoints: 1 // starting off with one point is nice to new people
		});
		await chatUser.save();
		return chatUser;
	}

	/**
	 * Gets the user with a specified id from the database. If no user with
	 * that id exists, then a user is created with that id
	 * @param twitchid the id of the user 
	 * @param channel the channel the user is in
	 * @param createNew whether to create a new user if one doesn't already exist
	 * @returns the User document for the specified id and channel
	 */
	private async getUser(twitchid: string, channel: string, createNew?: boolean): Promise<Document<DBUser>> {
		let chatUser = await User.findOne({ twitchid: twitchid.toLowerCase(), channel: channel.toLowerCase() }).exec();
		if (!chatUser && createNew) {
			chatUser = await this.createUser(twitchid, channel);
		}
		return chatUser;
	}

	/**
	 * Adds a priority point to a user
	 * @param twitchid the id of the user to add priority points to
	 * @param channel the channel the user is in
	 * @param amount the amount of points to add to a user (default is one)
	 * @returns the user's updated point count
	 */
	public async addPriority(twitchid: string, channel: string, amount?: number): Promise<number> {
		let chatUser = await this.getUser(twitchid, channel, true);
		let priority = (chatUser.toObject() as any).priorityPoints;
		
		priority += amount ? amount : 1;

		await User.findByIdAndUpdate(chatUser.id, { priorityPoints: priority });
		return priority;
	}

	/**
	 * Checks a user's priority point count
	 * @param twitchid the id of the user whose points are being checked
	 * @returns the point count for the specified user
	 */
	public async getUserPriority(twitchid: string, channel: string): Promise<number> {
		let chatUser = (await User.findOne({twitchid: twitchid, channel: channel}).lean().exec()) as DBUser;
		if (chatUser) return (chatUser).priorityPoints as number;
		return null;
	}

	public async getUsersInList(channel: string, list: string[]): Promise<LeanDocument<Document<DBUser>>[]> {
		return await User.find({channel: channel, twitchid: {
			$in: list
		}}).lean().exec();
	}

	/**
	 * Resets the user's priority point count to zero
	 * @param twitchid the twitch id of the person whose points are being reset
	 * @param channel the channel in which this person's points are being reset
	 * @returns whether the database was able to complete the query
	 */
	public async resetUserPriority(twitchid: string, channel: string): Promise<boolean> {
		return (await User.updateOne({
				twitchid: twitchid,
				channel: channel.toLowerCase()
			}, {
				priorityPoints: 0
			}).exec()).modifiedCount > 0;
	}

	/**
	 * Sets the string that precedes and indicates commands for a channel
	 * @param channel the channel on which whose prefix is being changed
	 * @param prefix the new prefix
	 */
	public async setPrefix(channel: string, prefix: string): Promise<boolean> {
		return (await ChannelSettings.updateOne({
			channel: channel
		}, {
			prefix: this.sanitizeRegex(prefix)
		}).exec()).modifiedCount > 0;
	}
	private sanitizeRegex(string: string) {
		return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
	}

	/**
	 * Gets a channel's command prefix
	 * @param channel the channel whose prefix is being fetched
	 * @returns the channel's prefix
	 */
	public async getPrefix(channel: string): Promise<string> {
		return (await ChannelSettings.findOne({channel: channel}).exec() as ChannelSettingsType).prefix;
	}


	public async sortOutPriorities(channel: string, giveList: string[], resetList: string[]): Promise<boolean> {
		for (let receiver of giveList) {
			await this.addPriority(receiver, channel, PriorityDB.PRIORITY_WEIGHT);
		}
		for (let picked of resetList) {
			await this.resetUserPriority(picked, channel);
		}
		return true;
	}

	/**
	 * Checks if a user in a channel exists in the database
	 * @param twitchid the id of the person whose existence is being checked
	 * @param channel the channel the user is in
	 * @returns true if the document exists, false if the document doesn't exist
	 */
	public async userExists(twitchid: string, channel: string): Promise<boolean> {
		return (await User.countDocuments({ channel: channel, twitchid: twitchid }).exec()) >= 1;
	}
}