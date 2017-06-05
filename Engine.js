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
const http = require("http");
const fs = require("fs");
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
class Engine {
    constructor() {
        this.info = {};
        this.applications = {};
        this.cache = new MemoryFileSystem();
        this.templateUrl = "mongodb://guest:guest@ds056549.mlab.com:56549/tauren";
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            this.overrideBinding3();
            yield this.initRouter();
            yield this.initApp();
            yield this.initMongo();
            this.mongo = new MongoFS_1.default(this.db);
            yield this.loadApplications();
            yield this.updateStudio();
        });
    }
    initApp() {
        return __awaiter(this, void 0, void 0, function* () {
            this.app = express();
            this.server = http.createServer(this.app);
            this.io = socketIo(this.server);
            this.io.on('connection', (socket) => {
                console.log('socket connection');
                socket.on('disconnect', function () {
                    console.log('socket disconnect');
                });
                socket.on('chooseApplication', function (msg) {
                    socket.emit('chooseApplication response', msg + 'from server');
                });
            });
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
                    console.log("get " + req.originalUrl);
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
    overrideBinding2() {
        fs["realFunctions"] = {};
        for (var methodName in fs) {
            if (typeof fs[methodName] === 'function' && methodName[0] != methodName[0].toUpperCase()) {
                fs["realFunctions"][methodName] = fs[methodName];
                fs[methodName] = this.methodFactory2(methodName);
            }
        }
    }
    methodFactory2(methodName) {
        return function () {
            console.log(methodName, arguments[0]);
            if (["access", "accessSync", "chmod", "chmodSync", "chown", "chownSync", "createReadStream", "createWriteStream", "exists", "existsSync", "lchown", "lchownSync", "lstat", "lstatSync", "mkdir", "mkdirSync", "mkdirp", "open", "openSync", "readdir", "readdirSync", "readFile", "readFileSync", "readlink", "readlinkSync", "rmdir", "rmdirSync", "stat", "statSync"].indexOf(methodName) != -1) {
                if (arguments[0].substring(0, 8) == "/virtual") {
                    console.log("from cache");
                    return this.cache[methodName].apply(this.cache, arguments);
                }
                if (arguments[0].substring(0, 8) == "/mongo") {
                    console.log("from mongo");
                    return this.mongo[methodName].apply(this.mongo, arguments);
                }
            }
            console.log("from fs");
            return fs["realFunctions"][methodName].apply(fs, arguments);
        }.bind(this);
    }
    overrideBinding3() {
        var methods = ["access", "accessSync", "chmod", "chmodSync", "chown", "chownSync", "createReadStream", "createWriteStream", "exists", "existsSync", "lchown", "lchownSync", "lstat", "lstatSync", "mkdir", "mkdirSync", "mkdirp", "open", "openSync", "readdir", "readdirSync", "readFile", "readFileSync", "readlink", "readlinkSync", "rmdir", "rmdirSync", "stat", "statSync", "truncate", "truncateSync", "unlink", "unlinkSync", "writeFile", "writeFileSync"];
        fs["realFunctions"] = {};
        for (var i in methods) {
            var methodName = methods[i];
            fs["realFunctions"][methodName] = fs[methodName];
            fs[methodName] = this.methodFactory3(methodName);
        }
        fs["join"] = utils_1.default.join;
        fs["normalize"] = utils_1.default.normalize;
    }
    methodFactory3(methodName) {
        return function () {
            var a = arguments[0].substring(0, 6);
            if (a != "/Users")
                console.log(methodName, arguments[0]);
            if (arguments[0].substring(0, 8) == "/virtual") {
                console.log("from cache");
                arguments[0] = arguments[0].substring(8);
                return this.cache[methodName].apply(this.cache, arguments);
            }
            if (arguments[0].substring(0, 6) == "/mongo") {
                console.log("from mongo");
                arguments[0] = arguments[0].substring(7);
                return this.mongo[methodName].apply(this.mongo, arguments);
            }
            if (a != "/Users")
                console.log("from fs");
            return fs["realFunctions"][methodName].apply(fs, arguments);
        }.bind(this);
    }
    methodFactory4(methodName) {
        return function () {
            console.log(methodName, arguments[0]);
            var result = fs["realFunctions"][methodName].apply(fs, arguments);
            return result;
        }.bind(this);
    }
}
exports.default = Engine;
