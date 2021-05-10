import * as TMI from "tmi.js";
import CommandHandler from "./modules/CommandHandler";

// put the channels your bot is enabled on in this array
const CHANNELS = [""];

// the prefix that differentiates commands
const PREFIX = "!"
const commands = new CommandHandler(CHANNELS);

const client = new TMI.client({
	connection: {reconnect: true},
	identity: {
		username: "", // username of the bot,
		password: "" // oauth token of the bot
	},
	channels: CHANNELS.slice() // slice is necessary otherwise tmi.js adds pound signs to the beginning of elements in the array
});

// maybe consider removing the ratelimit because people get confused and
// start spamming the chat more because they think the bot didn't register
// their message.
let ratelimit = false;

client.on("message", async (channel: string, user: TMI.ChatUserstate, message: string) => {
	let arg = message.split(" ")[1];
	let command = message.split(" ")[0].match(new RegExp(`(?<=${PREFIX}).+`));
	if (command) {
		if (CommandHandler.ENABLED.includes(command[0])) {
			let message = await commands.handle(command[0], user, channel.replace(/\W/g, ""), arg);
			if (message && (!ratelimit || commands.hasPermission(user))) {
				client.say(channel, message.toString());
				ratelimit = true;
				setTimeout(()=>{ratelimit = false}, 1000);
			}
		}
	}
});

client.connect();
