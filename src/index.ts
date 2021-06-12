import * as TMI from "tmi.js";
import CommandHandler from "./modules/CommandHandler";
import Auth from "./auth/Auth";

// put the channels the bot is enabled on
const CHANNELS = Auth.CHANNELS;

// the prefix that differentiates commands
const PREFIX = "!"
const commands = new CommandHandler(CHANNELS);

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
	let arg = message.split(" ")[1];
	let command = message.split(" ")[0].match(new RegExp(`(?<=${PREFIX}).+`));
	if (command) {
		if (CommandHandler.ENABLED.includes(command[0])) {
			let message = await commands.handle(command[0], user, channel.replace(/\W/g, ""), arg);
			if (message) {
				client.say(channel, message.toString());
			}
		}
	}
});

client.connect();