var directory = "C:\\Users\\ktsiouni\\AppData\\Roaming\\npm\\node_modules\\node-red\\node_modules\\";
var http = require('http');
var https = require('https');
var util = require("util");
var express = require(directory + "express\\lib\\express.js");
var crypto = require("crypto");
try { bcrypt = require(directory + 'bcrypt\\bcrypt.js'); }
catch(e) { bcrypt = require(directory + 'bcryptjs\\dist\\bcrypt.js'); }
var nopt = require(directory + "nopt\\lib\\nopt.js");
var path = require("path");
var fs = require(directory + "fs-extra\\lib\\index.js");
//var RED = require("C:\\Users\\ktsiouni\\AppData\\Roaming\\npm\\node_modules\\node-red\\red\\red.js");

const request = require('request');



module.exports = {
		add: function() {
			// Creates the flow from file
			var extraFlowFile = "C:\\Users\\ktsiouni\\Desktop\\flow.json";
			var jsonText = fs.readFileSync(extraFlowFile);
			var jsonObject = JSON.parse(jsonText);
			
			var flowObject = jsonObject[0];
			var nodes = [];
			for (var i=1; i<jsonObject.length; i++) {
				nodes.push(jsonObject[i]);
			}
			flowObject.nodes = nodes;

			//console.log(flowObject);

			// Adds the flow to the server
			request.post({uri: "http://localhost:1880/flow", json: flowObject }, (err, res, body) => {
				if (err) { return console.log(err); }
				console.log(body);
			});

			// Gives us the flow already in the server
			request.get({uri: "http://localhost:1880/flows", json: true}, (err, res, body) => {
				if (err) { return console.log(err); }
				console.log(body);
			});
		}
}
