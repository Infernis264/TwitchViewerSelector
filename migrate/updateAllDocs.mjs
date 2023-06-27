// Script to migrate an old version of the priority database to 

import * as mongoose from "mongoose";
import * as fetch from "node-fetch";
require("dotenv").config();

// In the users api, only 100 ids can be provided at a time
const MAX_QUERY_NUM = 100;
const USERS_API = "https://api.twitch.tv/helix/users";
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

const User = mongoose.model("User", new Schema({
	twitchid: String,
	username: String,
	channel: String,
	priorityPoints: Number
}));

function chunkArray(array, chunkSize) {
	const chunks = [];
	const length = array.length;
	let index = 0;
	while (index < length) {
		chunks.push(array.slice(index, index + chunkSize));
		index += chunkSize;
	}
	return chunks;
}

async function getCredentials() {
	(await (await fetch("https://id.twitch.tv/oauth2/token", {
		method: "POST",
		body: `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`,
		headers: {
			"Content-Type": "application/x-www-form-urlencoded"
		}
	})).json()).access_token;
}

async function getUsernames(userIds) {
	let token = await getCredentials();
	let userData = {};
	let apiUrls = chunkArray(userIds, MAX_QUERY_NUM)
		.map(chunk => `${USERS_API}?${chunk.join("&")}`);
	
	for (let url of apiUrls) {
		let res = await fetch(url, {headers:{
			"Client-Id": CLIENT_ID,
			"Authorization": "Bearer " + token
		}});
		let body = (await res.json()).data;
		for (let item of body) {
			userData[item.id] = item.login;
		}
	}
	return userData;
}

// Update all users with their new usernames
async function update() {
	let users = await User.find({});
	let userIds = users.map(user => "id=" + user.twitchid);
	
	let data = await getUsernames(userIds);
	console.log(data);

	for (let user of users) {
		user.username = data[user.twitchid];
	}
}

update();