const constants = require("./constants.json");
const ClearBlade = require("../ClearBlade");

console.log('const', constants);
var messaging;
var TOPIC_NAME = "mytopic";
ClearBlade.init({
	email: "a@a.com",
	password: "a",
	systemKey: constants.systemKey,
	systemSecret: constants.systemSecret,
	URI: constants.URL,
	messagingURI: constants.messageURL,
	callback: initCb
})

function initCb (err, body) {
	if (err) {
		console.error("init error", body);
	} else {
		messaging = ClearBlade.Messaging({}, messageInit);
	}
}

function messageInit () {
	console.log(`message init was successful; subscribing to '${TOPIC_NAME}'`);
	messaging.subscribe(TOPIC_NAME, {}, messageReceivedCb)
}

function messageReceivedCb (message) {
	console.log('messageReceivedCb', message);
	messaging.unsubscribe(TOPIC_NAME, unsubCb)
}

function unsubCb () {
	console.log(`unsubscribed from '${TOPIC_NAME}'`, arguments);
}