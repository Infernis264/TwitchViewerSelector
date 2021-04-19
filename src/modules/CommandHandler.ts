import UserTracker from "./UserTracker";

let queue: string[] = [];

export default class CommandHandler {

	public static ENABLED = ["join", "leave", "queue", "draw"];

	private tracker: UserTracker;

	constructor(channels: string[]) {
		this.tracker = new UserTracker(channels);
	}

	async handle(command: string, user: string, channel: string): Promise<string> {
		switch(command) {
			// joins the queue if you aren't in it
			case "join":
				if (queue.includes(user.toLowerCase())) {
					return `@${user} is already in the queue`;
				} else {
					queue.push(user.toLowerCase());
					return `@${user} joined the queue!`;
				}
			break;
			// leaves the queue if you are in it
			case "leave":
				if (queue.includes(user.toLowerCase())) {
					queue.splice(queue.indexOf(user.toLowerCase()), 1);
					return `@${user} left the queue`;
				}
			break;
			// logs the queue to the chat
			case "queue":
				if (queue.length === 0) {
					return "There's no one in the queue";
				}
				return "Queue: " + queue.join(", ");
			break;
			// draws a random winner from the queue
			case "draw":
				if (queue.length === 0) {
					return "There's no one in the queue";
				}
				if (this.tracker.isSuperUser(channel, user)) {
					let random = Math.floor(Math.random() * queue.length);
					let winner = queue.splice(random, 1)[0];
					return winner + " is next in line!";
				}
			break;
		}
	}
}
