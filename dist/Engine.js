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
const path = require("path");
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
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initRouter();
            yield this.initApp();
            yield this.initMongo();
            this.mongo = new MongoFS_1.default(this.db);
            this.gridfs = gridfs(this.db, mongodb);
            yield this.loadApplications();
            yield this.updateStudio();
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
                    socket.on('disconnect', function () {
                        console.log('socket disconnect');
                    }.bind(this));
                    socket.emit("info", this.info);
                    socket.emit("applications", Object.keys(this.applications));
                    socket.on('openApplication', function (msg) {
                        return __awaiter(this, void 0, void 0, function* () {
                            var app = this.applications[msg];
                            yield app.cache(socket);
                            yield app.npminstall();
                            var fs = yield app.loadDocument("fs");
                            socket.emit("application", {
                                name: app.name,
                                attachments: fs["_attachments"]
                            });
                        });
                    }.bind(this));
                    socket.on('openApplication2', function (msg) {
                        return __awaiter(this, void 0, void 0, function* () {
                            var app = this.applications[msg];
                            yield app.open(socket);
                            socket.emit("application", {
                                name: app.name,
                                tree: app.filesRoot
                            });
                        });
                    }.bind(this));
                    socket.on('openApplication3', function (msg) {
                        return __awaiter(this, void 0, void 0, function* () {
                            try {
                                var repopath = this.getApplicationRepositoryPath(msg);
                                if (!fsextra.existsSync(repopath)) {
                                    yield this.cloneApplication(msg);
                                }
                                else {
                                    yield this.updateApplication(msg);
                                }
                                var root = createNode('');
                                root["collapse"] = false;
                                function createNode(relpath) {
                                    var node = {};
                                    node["filename"] = (relpath == '') ? msg : path.basename(relpath);
                                    node["collapse"] = true;
                                    node["path"] = relpath;
                                    var stat = fsextra.lstatSync(repopath + '/' + relpath);
                                    if (stat.isFile())
                                        (node["contentType"] = utils_1.default.getMime(relpath));
                                    if (stat.isDirectory()) {
                                        node["contentType"] = "text/directory";
                                        node["children"] = [];
                                        var children = fsextra.readdirSync(repopath + '/' + relpath);
                                        children = children.sort();
                                        for (var i in children) {
                                            var child = children[i];
                                            if (child[0] == '.')
                                                continue;
                                            var childPath = (relpath) ? relpath + '/' + child : child;
                                            var childNode = createNode(childPath);
                                            node["children"].push(childNode);
                                        }
                                    }
                                    return node;
                                }
                                socket.emit("application", {
                                    name: msg,
                                    tree: root
                                });
                            }
                            catch (err) {
                                console.log(err);
                            }
                        });
                    }.bind(this));
                    socket.on('buildApplication', function (msg) {
                        return __awaiter(this, void 0, void 0, function* () {
                            var app = this.applications[msg.app];
                            yield app.compile(socket);
                            yield app.build(socket);
                        });
                    }.bind(this));
                    socket.on('editFile', function (msg) {
                        return __awaiter(this, void 0, void 0, function* () {
                            var app = this.applications[msg.app];
                            var buffer = yield app.loadFile2(msg.path);
                            socket.emit("editFile", {
                                path: msg.path,
                                content: buffer.toString()
                            });
                        });
                    }.bind(this));
                    socket.on('editFile3', function (msg) {
                        return __awaiter(this, void 0, void 0, function* () {
                            var projectpath = "/tmp/repos/" + msg.app;
                            var buffer = fsextra.readFileSync(projectpath + "/" + msg.path);
                            socket.emit("editFile", {
                                path: msg.path,
                                content: buffer.toString()
                            });
                        });
                    }.bind(this));
                    socket.on('saveFile', function (msg) {
                        return __awaiter(this, void 0, void 0, function* () {
                            var content = new Buffer(msg.content, 'base64').toString();
                            var app = this.applications[msg.app];
                            yield app.updateFileContent(msg._id, content, socket);
                            yield app.compile(socket);
                        });
                    }.bind(this));
                    socket.on('saveFile3', function (msg) {
                        return __awaiter(this, void 0, void 0, function* () {
                            var content = new Buffer(msg.content, 'base64').toString();
                            var projectpath = "/tmp/repos/" + msg.app;
                            fsextra.writeFileSync(projectpath + "/" + msg.path, content, { flag: 'w' });
                            socket.emit("log", "saveFile finished: " + msg.app + msg.path);
                            yield this.pushApplication(msg.app);
                        });
                    }.bind(this));
                    socket.on('newFolder', function (msg) {
                        return __awaiter(this, void 0, void 0, function* () {
                            var app = this.applications[msg.app];
                            var file = yield app.newFolder(msg, socket);
                            socket.emit("newFolder", {
                                file: file
                            });
                        });
                    }.bind(this));
                    socket.on('newFile', function (msg) {
                        return __awaiter(this, void 0, void 0, function* () {
                            var app = this.applications[msg.app];
                            var file = yield app.newFile(msg, socket);
                            socket.emit("newFile", {
                                file: file
                            });
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
                });
            }.bind(this));
            this.app.use(bodyParser.json({ type: 'application/json', limit: '5mb' }));
            this.app.use(bodyParser.raw({ type: 'application/vnd.custom-type' }));
            this.app.use(bodyParser.text({ type: 'text/*', limit: '5mb' }));
            this.app.use(this.router);
            var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080;
            var ip = process.env.IP || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
            this.server.listen(port, ip, function () {
                console.log('Express started on %s:%d ...', ip, port);
            });
        });
    }
    initMongo() {
        return __awaiter(this, void 0, void 0, function* () {
            if ((process.env.WORKING_DB_URL == null || process.env.WORKING_DB_URL == "") && process.env.DATABASE_SERVICE_NAME) {
                var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase(), mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'], mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'], mongoDatabase = process.env[mongoServiceName + '_DATABASE'], mongoPassword = process.env[mongoServiceName + '_PASSWORD'], mongoUser = process.env[mongoServiceName + '_USER'];
                if (mongoHost && mongoPort && mongoDatabase) {
                    process.env.WORKING_DB_URL = 'mongodb://' + mongoUser + ':' + mongoPassword + '@' + mongoHost + ':' + mongoPort + '/' + mongoDatabase;
                }
            }
            this.info["workingUrl"] = process.env.WORKING_DB_URL;
            if (this.db == null) {
                try {
                    this.db = yield mongodb.MongoClient.connect(process.env.WORKING_DB_URL);
                    console.log("WORKING Mongo initialized!");
                    this.info["workingDBConnected"] = true;
                }
                catch (err) {
                    console.log('WORKING Mongo error: ', err.message);
                    this.info["workingDBConnected"] = false;
                }
            }
        });
    }
    updateStudio() {
        return __awaiter(this, void 0, void 0, function* () {
            this.info["studioUpdated"] = false;
            if (this.db == null)
                return;
            var workingHost = process.env.WORKING_DB_URL.substring(process.env.WORKING_DB_URL.indexOf('@') + 1);
            var templateHost = this.templateUrl.substring(this.templateUrl.indexOf('@') + 1);
            if (workingHost == templateHost)
                return;
            yield this.copyApplicationFromDatabase(this.templateUrl, "studio", "studio");
            this.info["studioUpdated"] = true;
        });
    }
    initRouter() {
        return __awaiter(this, void 0, void 0, function* () {
            this.router = express.Router();
            this.router.get("/", function (req, res, next) {
                return __awaiter(this, void 0, void 0, function* () {
                    try {
                        res.redirect('/studio/Static/getFile/index.html');
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
                        var ctrl = app.controllers[controller + "Controller"];
                        if (!ctrl) {
                            res.status(404);
                            res.end();
                            return;
                        }
                        var ctrl = new ctrl();
                        var result = yield ctrl[method](url, req.query);
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
    getApplicationRepositoryPath(app) {
        return "/tmp/repos/" + app;
    }
    cloneApplication(app) {
        return __awaiter(this, void 0, void 0, function* () {
            var registry = (yield this.db.collection(app).find().toArray())[0];
            var repopath = this.getApplicationRepositoryPath(app);
            var repo = yield Git.Clone(registry.repository.url, repopath);
            var remote = yield Git.Remote.create(repo, "origin", registry.repository.url);
            console.log("cloned: " + repopath);
            return repo;
        });
    }
    updateApplication(app) {
        return __awaiter(this, void 0, void 0, function* () {
            var repopath = this.getApplicationRepositoryPath(app);
            var repo = yield Git.Repository.open(repopath);
            yield repo.fetchAll();
            yield repo.mergeBranches("master", "origin/master");
            console.log("updated: " + repopath);
            return repo;
        });
    }
    pushApplication(app) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                var repopath = this.getApplicationRepositoryPath(app);
                var repo = yield Git.Repository.open(repopath);
                debugger;
                yield gitkit.config.set(repo, {
                    'user.name': 'John Doe',
                    'user.email': 'johndoe@example.com'
                });
                var diff = yield gitkit.diff(repo);
                console.log(diff);
                yield gitkit.commit(repo, {
                    'message': 'commit message'
                });
                var log = yield gitkit.log(repo);
                console.log(log);
                var signature = Git.Signature.create("Foo bar", "foo@bar.com", 123456789, 60);
                var TOKEN = "xy1WHR7QXt-8WZJehY9B";
                var remote = yield Git.Remote.lookup(repo, "origin");
                yield remote.push(["refs/heads/master:refs/heads/master"], {
                    callbacks: {
                        certificateCheck: function () { return 1; },
                        credentials: function (url, userName) {
                            return Git.Cred.userpassPlaintextNew(TOKEN, "x-oauth-basic");
                        }
                    }
                });
            }
            catch (err) {
                console.log(err);
            }
        });
    }
}
exports.default = Engine;
