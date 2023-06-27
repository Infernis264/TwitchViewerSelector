import * as TMI from "tmi.js";
import CommandHandler, {BaseCommands} from "./modules/CommandHandler";
import Auth from "./auth/Auth";
import Mario, {MarioCommands} from "./modules/Mario";

// put the channels the bot is enabled on
const CHANNELS = Auth.CHANNELS;

const DB_NAME = "mongodb://localhost:27017/priority";

// the prefix that differentiates commands
const commands = new CommandHandler(CHANNELS, DB_NAME);

const mario = new Mario(CHANNELS)

const client = new TMI.client({
	connection: {reconnect: true},
	identity: {
		username: Auth.USERNAME,
		password: Auth.TOKEN
	},
	// slice is necessary otherwise tmi.js adds pound signs to the beginning of elements in the array
	channels: CHANNELS.slice() 
});

client.on("message", async (channel: string, user: TMI.ChatUserstate, message: string) => {
	if (message.toLowerCase() === "@" + Auth.USERNAME) {
		client.say(channel, `@${user["display-name"]}`);
		return;
	}
	let arg = message.split(" ").slice(1).join(" ");
	let chan = channel.replace(/\W/g, "");
	let command = message.split(" ")[0].match(new RegExp(`(?<=${commands.getPrefix(chan)}).+`));
	if (command) {
		if (CommandHandler.ENABLED.includes(command[0] as BaseCommands)) {
			let message = await commands.handle(command[0], user, chan, arg);
			if (message) {
				client.say(channel, message.toString());
			}
		}
		if (Mario.ENABLED.includes(command[0] as MarioCommands)) {
			let message = await mario.handle(command[0], user, chan, arg);
			if (message) {
				client.say(channel, message.toString());
			}
		}
	}
});

client.connect();