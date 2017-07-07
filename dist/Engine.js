"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fsextra = require("fs-extra");
const http = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const request = require("request");
const mongodb = require("mongodb");
const Application_1 = require("./Application");
const gridfs = require("gridfs-stream");
const MongoFS_1 = require("./MongoFS");
const utils_1 = require("./utils");
const MemoryFileSystem = require("memory-fs");
const socketIo = require("socket.io");
var Git = require("nodegit");
var gitkit = require('nodegit-kit');
class Engine {
    constructor() {
        this.info = {};
        this.applications = {};
        this.cache = new MemoryFileSystem();
        this.templateUrl = "mongodb://guest:guest@ds056549.mlab.com:56549/tauren";
        this.workingUrl = "mongodb://admin:Leonardo19770206Z@ds056549.mlab.com:56549/tauren";
        this.gitLabAccessToken = "k5T9xs82anhKt1JKaM39";
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initRouter();
            yield this.initApp();
            yield this.initMongo();
            this.mongo = new MongoFS_1.default(this.db);
            this.gridfs = gridfs(this.db, mongodb);
            yield this.loadApplications();
        });
    }
    initApp() {
        return __awaiter(this, void 0, void 0, function* () {
            this.app = express();
            this.server = http.createServer(this.app);
            this.io = socketIo(this.server);
            this.io.on('connection', function (socket) {
                return __awaiter(this, void 0, void 0, function* () {
                    console.log('socket connection');
                    if (socket.handshake.query.app == 'studio44') {
                        socket.use((params, next) => {
                            var app = this.applications[socket.handshake.query.app];
                            var message = params[0];
                            var data = params[1];
                            app.on(message, data, socket);
                            return next();
                        });
                    }
                    socket.on('disconnect', function () {
                        console.log('socket disconnect');
                    }.bind(this));
                    socket.emit("info", this.info);
                    socket.emit("applications", Object.keys(this.applications));
                    if (socket.handshake.query.app != 'studio44') {
                        socket.on('openApplication', function (msg) {
                            return __awaiter(this, void 0, void 0, function* () {
                                var app = this.applications[msg];
                                var repo = yield app.open(socket);
                                var root = app.createNode('');
                                socket.emit("application", {
                                    name: app.name,
                                    tree: root
                                });
                            });
                        }.bind(this));
                        socket.on('publishApplication', function (msg) {
                            return __awaiter(this, void 0, void 0, function* () {
                                var app = this.applications[msg.app];
                                var success = yield app.compile(socket);
                                if (!success)
                                    return;
                                yield app.push(socket);
                                yield app.publish(socket);
                            });
                        }.bind(this));
                        socket.on('npminstallApplication', function (msg) {
                            return __awaiter(this, void 0, void 0, function* () {
                                var app = this.applications[msg.app];
                                app.npminstall(socket);
                            });
                        }.bind(this));
                        socket.on('newFolder', function (msg) {
                            return __awaiter(this, void 0, void 0, function* () {
                                var app = this.applications[msg.app];
                                var file = app.newFolder(msg, socket);
                                socket.emit("newFolder", {
                                    file: file
                                });
                            });
                        }.bind(this));
                        socket.on('newFile', function (msg) {
                            return __awaiter(this, void 0, void 0, function* () {
                                var app = this.applications[msg.app];
                                var file = app.newFile(msg, socket);
                                socket.emit("newFile", {
                                    file: file
                                });
                            });
                        }.bind(this));
                        socket.on('editFile', function (msg) {
                            return __awaiter(this, void 0, void 0, function* () {
                                var app = this.applications[msg.app];
                                var buffer = fsextra.readFileSync(app.path + "/" + msg.path);
                                socket.emit("editFile", {
                                    path: msg.path,
                                    content: buffer.toString()
                                });
                            });
                        }.bind(this));
                        socket.on('saveFile', function (msg) {
                            return __awaiter(this, void 0, void 0, function* () {
                                var app = this.applications[msg.app];
                                var content = new Buffer(msg.content, 'base64').toString();
                                fsextra.writeFileSync(app.path + "/" + msg.path, content, { flag: 'w' });
                                socket.emit("log", "saved: " + msg.path);
                                var app = this.applications[msg.app];
                                app.compile(socket);
                            });
                        }.bind(this));
                        socket.on('getCompletionsAtPosition', function (msg) {
                            var app = this.applications[msg.app];
                            try {
                                msg = app.getCompletionsAtPosition(msg);
                                socket.emit('getCompletionsAtPosition', msg);
                            }
                            catch (e) {
                                socket.emit('log', e.message);
                            }
                        }.bind(this));
                    }
                });
            }.bind(this));
            this.app.use(bodyParser.json({ type: 'application/json', limit: '5mb' }));
            this.app.use(bodyParser.raw({ type: 'application/vnd.custom-type' }));
            this.app.use(bodyParser.text({ type: 'text/*', limit: '5mb' }));
            this.app.use(this.router);
            var host = "0.0.0.0";
            var port = 8080;
            this.server.listen(port, host, function () {
                console.log('Express started on %s:%d ...', host, port);
            });
        });
    }
    initMongo() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.db != null)
                return;
            try {
                this.db = yield mongodb.MongoClient.connect(this.workingUrl);
                this.info["workingUrl"] = this.workingUrl.substring(this.workingUrl.indexOf('@') + 1);
                console.log("WORKING Mongo initialized!");
                this.info["workingDBConnected"] = true;
            }
            catch (err) {
                console.log('WORKING Mongo error: ', err.message);
                this.info["workingDBConnected"] = false;
            }
        });
    }
    initRouter() {
        return __awaiter(this, void 0, void 0, function* () {
            this.router = express.Router();
            this.router.get("/", function (req, res, next) {
                return __awaiter(this, void 0, void 0, function* () {
                    try {
                        res.redirect('/studio43/Static/getFile/client/index.html');
                    }
                    catch (err) {
                        throw Error(err.message);
                    }
                });
            }.bind(this));
            this.router.get("/env", function (req, res, next) {
                return __awaiter(this, void 0, void 0, function* () {
                    try {
                        res.send(process.env);
                        res.end();
                    }
                    catch (err) {
                        throw Error(err.message);
                    }
                });
            }.bind(this));
            this.router.get("/info", function (req, res, next) {
                return __awaiter(this, void 0, void 0, function* () {
                    try {
                        res.send(this.info);
                        res.end();
                    }
                    catch (err) {
                        throw Error(err.message);
                    }
                });
            }.bind(this));
            this.router.get('/debugurl', function (req, res, next) {
                request('http://localhost:9229/json/list', function (error, response, body) {
                    try {
                        var debugRouteHost = process.env.ENGINE_SERVICE_NAME + "-debug-" + process.env.OPENSHIFT_BUILD_NAMESPACE + ".44fs.preview.openshiftapps.com";
                        var url = JSON.parse(body)[0].devtoolsFrontendUrl;
                        url = url.replace("localhost:9229", debugRouteHost);
                        res.send(url);
                        res.end();
                    }
                    catch (error) {
                        res.send(error);
                    }
                });
            });
            this.router.get('/:application/:controller/:method/:url(*)?', function (req, res, next) {
                return __awaiter(this, void 0, void 0, function* () {
                    var application = req.params["application"];
                    var controller = req.params["controller"];
                    var method = req.params["method"];
                    var url = req.params["url"];
                    try {
                        var app = this.applications[application];
                        if (!app) {
                            res.status(404);
                            res.end();
                            return;
                        }
                        var result = null;
                        if (application == 'studio43') {
                            var ctrl = app.controllers[controller + "Controller"];
                            if (!ctrl) {
                                res.status(404);
                                res.end();
                                return;
                            }
                            var ctrl = new ctrl();
                            result = yield ctrl[method](url, req.query);
                        }
                        else {
                            var fileInfo = yield app.dbLoadFile(url);
                            result = { status: 200, contentType: fileInfo.contentType, body: fileInfo.buffer };
                        }
                        res.status(result.status);
                        res.setHeader("Content-Type", result.contentType);
                        res.send(result.body);
                    }
                    catch (err) {
                        console.log(err);
                        res.status(500);
                        res.send(err.message);
                    }
                });
            }.bind(this));
            this.router.post('/:application/:controller/:method/:url(*)?', function (req, res, next) {
                return __awaiter(this, void 0, void 0, function* () {
                    console.log("post " + req.originalUrl);
                    var application = req.params["application"];
                    var controller = req.params["controller"];
                    var method = req.params["method"];
                    var url = req.params["url"];
                    var body = req["body"];
                    try {
                        var app = this.applications[application];
                        if (!app) {
                            res.status(404);
                            res.end();
                            return;
                        }
                        var ctrl = app.controllers[controller + "Controller"];
                        if (!ctrl) {
                            res.status(404);
                            res.end();
                            return;
                        }
                        var ctrl = new ctrl();
                        var result = yield ctrl[method](url, req.query, body);
                        res.status(result.status);
                        res.setHeader("Content-Type", result.contentType);
                        res.send(result.body);
                    }
                    catch (err) {
                        console.log(err);
                        res.status(500);
                        res.send(err.message);
                    }
                });
            }.bind(this));
        });
    }
    loadApplication(name) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.applications[name])
                return;
            var app = new Application_1.default(name, this);
            this.applications[name] = app;
            yield app.init();
        });
    }
    loadApplications() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.db)
                return;
            this.applications = {};
            var data = yield this.db.listCollections({}).toArray();
            data.forEach(function (element, index) {
                return __awaiter(this, void 0, void 0, function* () {
                    var name = element.name.split('.')[0];
                    if (name == "system")
                        return;
                    yield this.loadApplication(name);
                });
            }.bind(this));
        });
    }
    createApplication(name) {
        return __awaiter(this, void 0, void 0, function* () {
            var app = new Application_1.default(name, this);
            yield app.create();
            return app;
        });
    }
    deleteApplication(name) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.applications[name])
                return;
            delete this.applications[name];
            yield this.db.collection(name).drop();
            yield this.db.collection(name + ".files").drop();
            yield this.db.collection(name + ".chunks").drop();
        });
    }
    listApplicationsOfDatabase(dburl) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = [];
            var sourcedb = yield mongodb.MongoClient.connect(dburl);
            var collections = yield sourcedb.listCollections({}).toArray();
            for (var i = 0; i < collections.length; i++) {
                var application = collections[i].name;
                if (application.indexOf('.') != -1)
                    continue;
                if (application == "objectlabs-system")
                    continue;
                var readme = "";
                var fs = new MongoFS_1.default(this.db);
                var data = yield this.mongo.findOrCreateStub(application, "README.html", false);
                if (data.stub) {
                    var filedoc = yield sourcedb.collection(application + ".files").findOne({ '_id': data.stub._fileId });
                    var gfs = gridfs(sourcedb, mongodb);
                    var readstream = gfs.createReadStream({
                        _id: filedoc._id,
                        root: application
                    });
                    try {
                        readme = yield utils_1.default.fromStream(readstream);
                    }
                    catch (err) {
                    }
                }
                result.push({ name: application, description: readme.toString() });
            }
            return result;
        });
    }
    copyApplicationFromDatabase(sourceDBUrl, sourceAppName, destAppName) {
        return __awaiter(this, void 0, void 0, function* () {
            var sourcedb = yield mongodb.MongoClient.connect(sourceDBUrl);
            yield this.deleteApplication(destAppName);
            var fs = yield sourcedb.collection(sourceAppName).find().toArray();
            yield this.db.collection(destAppName).insertMany(fs);
            var files = yield sourcedb.collection(sourceAppName + ".files").find().toArray();
            yield this.db.collection(destAppName + ".files").insertMany(files);
            var chunks = yield sourcedb.collection(sourceAppName + ".chunks").find().toArray();
            yield this.db.collection(destAppName + ".chunks").insertMany(chunks);
            yield this.loadApplication(destAppName);
        });
    }
}
exports.default = Engine;
