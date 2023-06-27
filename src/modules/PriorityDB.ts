import { Document, Schema, LeanDocument } from "mongoose";
import * as mongoose from "mongoose";
import { ChannelSettingsType, DBUser, DrawType, DrawTypeArr, QueueUser } from "./Types";

const User = mongoose.model("User", new Schema({
	twitchid: String,
	username: String,
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
	public static MAX_PP_ADD = 2000;
	public db: typeof mongoose;

	/**
	 * Creates a new PriorityDB with a provided mongodb url
	 * @param url the database url
	 */
	constructor(url: string) {
		mongoose.connect(url);
		mongoose.set("returnOriginal", false);
	}

	// Channel commands

	/**
	 * Sets the drawing mode for a channel
	 * @param channel the channel whose draw method is being set
	 * @param method the drawing method that should be used for the channel
	 * @returns true if operation was successful, false otherwise
	 */
	public async setDrawMethod(channel: string, method: DrawType): Promise<boolean> {
		if (DrawTypeArr.includes(method)) {
			return false;
		}
		await this.makeChannelExist(channel, method);
		await ChannelSettings.updateOne({channel: channel}, {method: method}).exec();
		return true;
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
	 * Gets a channel's command prefix
	 * @param channel the channel whose prefix is being fetched
	 * @returns the channel's prefix
	 */
	public async getPrefix(channel: string): Promise<string> {
		return (await ChannelSettings.findOne({channel: channel}).exec() as ChannelSettingsType).prefix;
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

	// User commands

	/**
	 * Creates a new user in the database
	 * @param twitchid the id of the user that will be added to the database
	 * @param username the username of the user
	 * @param channel the channel the user is linked to
	 * @returns the created User document
	 */
	public async createUser(twitchid: string, username: string, channel: string): Promise<Document<DBUser>> {
		let chatUser = new User({
			twitchid: twitchid.toLowerCase(),
			channel: channel.toLowerCase(),
			username: username.toLowerCase(),
			priorityPoints: 1 // starting off with one point is nice to new people
		});
		await chatUser.save();
		return chatUser as any as Document<DBUser>;
	}

	/**
	 * Checks a user's priority point count
	 * @param channel the channel to get priority points for
	 * @param twitchid the id of the user whose points are being checked
	 * @returns the point count for the specified user
	 */
	public async getPriorityById(channel: string, twitchid: string): Promise<number> {
		let chatUser = (await User.findOne({
			twitchid: twitchid,
			channel: channel
		}).lean().exec()) as DBUser;
		if (chatUser) return (chatUser).priorityPoints as number;
		return null;
	}

	/**
	 * Checks a user's priority point count
	 * @param username the username of the user whose points are being checked
	 * @param channel the channel to get priority points for
	 * @returns the point count for the specified user
	 */
	public async getPriorityByUsername(channel: string, username: string): Promise<number> {
		if (!username) return null;
		let chatUser = (await User.findOne({
			username: username,
			channel: channel
		}).lean().exec()) as DBUser;

		if (chatUser) return (chatUser).priorityPoints as number;
		return null;
	}

	/**
	 * Adds priority points to a user
	 * @param channel the channel the user is in
	 * @param username the username to give priority points to
	 * @param amount the amount of points to add to a user
	 * @returns the user's updated point count
	 */
	public async addPriorityByUsername(channel: string, username: string, amount: number): Promise<number> {
		let chatUser = await this.getUserByName(channel, username) as any;
		if (!chatUser) return null;
		// Don't add too many priority points at once
		if (amount <= 0 || amount > PriorityDB.MAX_PP_ADD) return null;

		chatUser.priorityPoints += amount;
		await chatUser.save();
		return chatUser.priorityPoints;
	}

	/**
	 * Adds priority points to a user
	 * @param channel the channel the user is in
	 * @param username the username to give priority points to
	 * @param amount the amount of points to add to a user
	 * @returns the user's updated point count
	 */
	public async removePriorityByUsername(channel: string, username: string, amount: number): Promise<number> {
		let chatUser = await this.getUserByName(channel, username) as any;
		if (!chatUser) return null;
		chatUser.priorityPoints -= amount;
		if (chatUser.priorityPoints < 0) {
			chatUser.priorityPoints = 0;
		}
		await chatUser.save();
		return chatUser.priorityPoints;
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
	 * Function that adds priority points to 
	 * @param channel the twitch channel name
	 * @param joinedList the list of chatters that joined the pool
	 * @param excludeList the list of chatters that got drawn and shouldn't receive points
	 * @returns true if successful
	 */
	public async giveOutPriorityPoints(channel: string, list: QueueUser[]): Promise<boolean> {
		for (let user of list) {
			await this.addPriorityById(channel, user.twitchid, user.user, PriorityDB.PRIORITY_WEIGHT);
		}
		return true;
	}

	/**
	 * Gets all database entries for a list of users 
	 * @param channel the twitch channel to get documents
	 * @param list the list of twitch ids
	 * @returns an array of user documents
	 */
	public async getUsersInList(channel: string, list: string[]): Promise<LeanDocument<Document<DBUser>>[]> {
		return await User.find({channel: channel, twitchid: {
			$in: list
		}}).lean().exec() as any as LeanDocument<Document<DBUser>>[];
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

	// Private utility methods

	/**
	 * Adds priority points to a user
	 * @param twitchid the id of the user to add priority points to
	 * @param username the username of the user
	 * @param channel the channel the user is in
	 * @param amount the amount of points to add to a user (default is one)
	 * @returns the user's updated point count
	 */
	private async addPriorityById(channel: string, twitchid: string, username: string, amount?: number): Promise<number> {
		let chatUser = await this.getUserById(twitchid, username, channel, true) as any;
		chatUser.priorityPoints += amount ? amount : 1;
		await chatUser.save();
		return chatUser.priority;
	}

	/**
	 * Gets the user with a specified id from the database. If no user with
	 * that id exists, then a user is created with that id
	 * @param twitchid the id of the user 
	 * @param channel the channel the user is in
	 * @param createNew whether to create a new user if one doesn't already exist
	 * @returns the User document for the specified id and channel
	 */
	private async getUserById(twitchid: string, username: string, channel: string, createNew?: boolean): Promise<Document<DBUser>> {
		let chatUser = await User.findOne({
			twitchid: twitchid.toLowerCase(),
			channel: channel.toLowerCase()
		}).exec() as any as Document<DBUser>;

		if (!chatUser && createNew) {
			chatUser = await this.createUser(twitchid, username, channel);
		}
		return chatUser;
	}

	/**
	 * Gets the user with a specified username from the database.
	 * @param channel the channel the user is in
	 * @param username the username of the person to get
	 * @returns the User document for the specified username and channel
	 */
	private async getUserByName(channel: string, username: string): Promise<Document<DBUser>> {
		let chatUser = await User.findOne({
			username: username.toLowerCase(),
			channel: channel.toLowerCase()
		}).exec();
		return chatUser as any as Document<DBUser>;
	}

	/**
	 * Filters a string to attempt to stop mongodb injections
	 * @param string the string to filter
	 * @returns the sanitized string
	 */
	private sanitizeRegex(string: string) {
		return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
	}
}