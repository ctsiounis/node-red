#!/usr/bin/env node
/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
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
var RED = require("C:\\Users\\ktsiouni\\AppData\\Roaming\\npm\\node_modules\\node-red\\red\\red.js");

var server;
var app = express();

var settingsFile;
var flowFile;



//var parsedArgs = nopt(knownOpts,shortHands,process.argv,2)




if (fs.existsSync(path.join(process.env.NODE_RED_HOME,".config.json"))) {
    // NODE_RED_HOME contains user data - use its settings.js
    settingsFile = path.join(process.env.NODE_RED_HOME,"settings.js");
} else if (process.env.HOMEPATH && fs.existsSync(path.join(process.env.HOMEPATH,".node-red",".config.json"))) {
    // Consider compatibility for older versions
    settingsFile = path.join(process.env.HOMEPATH,".node-red","settings.js");
} else {
    var userDir = path.join(process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH,".node-red");
    var userSettingsFile = path.join(userDir,"settings.js");
    if (fs.existsSync(userSettingsFile)) {
        // $HOME/.node-red/settings.js exists
        settingsFile = userSettingsFile;
    } else {
        var defaultSettings = path.join(__dirname,"settings.js");
        var settingsStat = fs.statSync(defaultSettings);
        if (settingsStat.mtime.getTime() <= settingsStat.ctime.getTime()) {
            // Default settings file has not been modified - safe to copy
            fs.copySync(defaultSettings,userSettingsFile);
            settingsFile = userSettingsFile;
        } else {
            // Use default settings.js as it has been modified
            settingsFile = defaultSettings;
        }
    }
}


try {
    var settings = require(settingsFile);
    settings.settingsFile = settingsFile;
} catch(err) {
    console.log("Error loading settings file: "+settingsFile)
    if (err.code == 'MODULE_NOT_FOUND') {
        if (err.toString().indexOf(settingsFile) === -1) {
            console.log(err.toString());
        }
    } else {
        console.log(err);
    }
    process.exit();
}

if (settings.https) {
    server = https.createServer(settings.https,function(req,res) {app(req,res);});
} else {
    server = http.createServer(function(req,res) {app(req,res);});
}
server.setMaxListeners(0);

function formatRoot(root) {
    if (root[0] != "/") {
        root = "/" + root;
    }
    if (root.slice(-1) != "/") {
        root = root + "/";
    }
    return root;
}

if (settings.httpRoot === false) {
    settings.httpAdminRoot = false;
    settings.httpNodeRoot = false;
} else {
    settings.httpRoot = settings.httpRoot||"/";
    settings.disableEditor = settings.disableEditor||false;
}

if (settings.httpAdminRoot !== false) {
    settings.httpAdminRoot = formatRoot(settings.httpAdminRoot || settings.httpRoot || "/");
    settings.httpAdminAuth = settings.httpAdminAuth || settings.httpAuth;
} else {
    settings.disableEditor = true;
}

if (settings.httpNodeRoot !== false) {
    settings.httpNodeRoot = formatRoot(settings.httpNodeRoot || settings.httpRoot || "/");
    settings.httpNodeAuth = settings.httpNodeAuth || settings.httpAuth;
}

settings.uiPort = 1880;

settings.uiHost = settings.uiHost||"0.0.0.0";

//Set our own flow file

try {
    RED.init(server,settings);
} catch(err) {
    if (err.code == "unsupported_version") {
        console.log("Unsupported version of node.js:",process.version);
        console.log("Node-RED requires node.js v4 or later");
    } else if (err.code == "not_built") {
        console.log("Node-RED has not been built. See README.md for details");
    } else {
        console.log("Failed to start server:");
        if (err.stack) {
            console.log(err.stack);
        } else {
            console.log(err);
        }
    }
    process.exit(1);
}

function basicAuthMiddleware(user,pass) {
    var basicAuth = require('basic-auth');
    var checkPassword;
    var localCachedPassword;
    if (pass.length == "32") {
        // Assume its a legacy md5 password
        checkPassword = function(p) {
            return crypto.createHash('md5').update(p,'utf8').digest('hex') === pass;
        }
    } else {
        checkPassword = function(p) {
            return bcrypt.compareSync(p,pass);
        }
    }

    var checkPasswordAndCache = function(p) {
        // For BasicAuth routes we know the password cannot change without
        // a restart of Node-RED. This means we can cache the provided crypted
        // version to save recalculating each time.
        if (localCachedPassword === p) {
            return true;
        }
        var result = checkPassword(p);
        if (result) {
            localCachedPassword = p;
        }
        return result;
    }

    return function(req,res,next) {
        if (req.method === 'OPTIONS') {
            return next();
        }
        var requestUser = basicAuth(req);
        if (!requestUser || requestUser.name !== user || !checkPasswordAndCache(requestUser.pass)) {
            res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
            return res.sendStatus(401);
        }
        next();
    }
}

if (settings.httpAdminRoot !== false && settings.httpAdminAuth) {
    RED.log.warn(RED.log._("server.httpadminauth-deprecated"));
    app.use(settings.httpAdminRoot, basicAuthMiddleware(settings.httpAdminAuth.user,settings.httpAdminAuth.pass));
}

if (settings.httpAdminRoot !== false) {
    app.use(settings.httpAdminRoot,RED.httpAdmin);
}
if (settings.httpNodeRoot !== false && settings.httpNodeAuth) {
    app.use(settings.httpNodeRoot,basicAuthMiddleware(settings.httpNodeAuth.user,settings.httpNodeAuth.pass));
}
if (settings.httpNodeRoot !== false) {
    app.use(settings.httpNodeRoot,RED.httpNode);
}
if (settings.httpStatic) {
    settings.httpStaticAuth = settings.httpStaticAuth || settings.httpAuth;
    if (settings.httpStaticAuth) {
        app.use("/",basicAuthMiddleware(settings.httpStaticAuth.user,settings.httpStaticAuth.pass));
    }
    app.use("/",express.static(settings.httpStatic));
}

function getListenPath() {
    var port = settings.serverPort;
    if (port === undefined){
        port = settings.uiPort;
    }

    var listenPath = 'http'+(settings.https?'s':'')+'://'+
                    (settings.uiHost == '::'?'localhost':(settings.uiHost == '0.0.0.0'?'127.0.0.1':settings.uiHost))+
                    ':'+port;
    if (settings.httpAdminRoot !== false) {
        listenPath += settings.httpAdminRoot;
    } else if (settings.httpStatic) {
        listenPath += "/";
    }
    return listenPath;
}

RED.start().then(function() {
    if (settings.httpAdminRoot !== false || settings.httpNodeRoot !== false || settings.httpStatic) {
        server.on('error', function(err) {
            if (err.errno === "EADDRINUSE") {
                RED.log.error(RED.log._("server.unable-to-listen", {listenpath:getListenPath()}));
                RED.log.error(RED.log._("server.port-in-use"));
            } else {
                RED.log.error(RED.log._("server.uncaught-exception"));
                if (err.stack) {
                    RED.log.error(err.stack);
                } else {
                    RED.log.error(err);
                }
            }
            process.exit(1);
        });
        server.listen(settings.uiPort,settings.uiHost,function() {
            if (settings.httpAdminRoot === false) {
                RED.log.info(RED.log._("server.admin-ui-disabled"));
            }
            settings.serverPort = server.address().port;
            process.title = 'node-red';
            RED.log.info(RED.log._("server.now-running", {listenpath:getListenPath()}));
            //console.log(RED.server);
        });
    } else {
        RED.log.info(RED.log._("server.headless-mode"));
    }
}).otherwise(function(err) {
    RED.log.error(RED.log._("server.failed-to-start"));
    if (err.stack) {
        RED.log.error(err.stack);
    } else {
        RED.log.error(err);
    }
});



process.on('uncaughtException',function(err) {
    util.log('[red] Uncaught Exception:');
    if (err.stack) {
        util.log(err.stack);
    } else {
        util.log(err);
    }
    process.exit(1);
});

process.on('SIGINT', function () {
    RED.stop().then(function() {
        process.exit();
    });
});