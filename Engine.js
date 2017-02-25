"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const express = require("express");
const bodyParser = require("body-parser");
const request = require("request");
const uuid = require("node-uuid");
const mongodb = require("mongodb");
const Application_1 = require('./Application');
class Engine {
    constructor() {
        this.info = {};
        this.applications = {};
        this.templateUrl = "mongodb://admin:Leonardo19770206Z@ds117189.mlab.com:17189/ide";
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initRouter();
            yield this.initApp();
        });
    }
    initApp() {
        return __awaiter(this, void 0, void 0, function* () {
            this.app = express();
            this.app.use(bodyParser.json({ type: 'application/json', limit: '5mb' }));
            this.app.use(bodyParser.raw({ type: 'application/vnd.custom-type' }));
            this.app.use(bodyParser.text({ type: 'text/*', limit: '5mb' }));
            this.app.use(this.router);
            this.app.use(function (err, req, res, next) {
                var error = new Error("Not Found");
                err.status = 404;
                next(err);
            });
            var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080;
            var ip = process.env.IP || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
            this.app.listen(port, ip, function () {
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
            if (this.dbTpl == null) {
                var templateUrl = "mongodb://admin:Leonardo19770206Z@ds117189.mlab.com:17189/ide";
                try {
                    this.dbTpl = yield mongodb.MongoClient.connect(templateUrl);
                    console.log("TEMPLATE Mongo initialized!");
                    this.info["templateDBConnected"] = true;
                }
                catch (err) {
                    console.log('TEMPLATE Mongo error: ', err.message);
                    this.info["templateDBConnected"] = false;
                }
            }
        });
    }
    updateStudio() {
        return __awaiter(this, void 0, void 0, function* () {
            this.info["studioUpdated"] = false;
            if (process.env.WORKING_DB_URL == this.templateUrl)
                return;
            if (this.db == null)
                return;
            if (this.dbTpl == null)
                return;
            yield this.db.collection("studio").drop();
            yield this.db.collection("studio.files").drop();
            yield this.db.collection("studio.chunks").drop();
            var fs = yield this.dbTpl.collection("studio").find().toArray();
            yield this.db.collection("studio").insertMany(fs);
            var files = yield this.dbTpl.collection("studio.files").find().toArray();
            yield this.db.collection("studio.files").insertMany(files);
            var chunks = yield this.dbTpl.collection("studio.chunks").find().toArray();
            yield this.db.collection("studio.chunks").insertMany(chunks);
            this.info["studioUpdated"] = true;
        });
    }
    initRouter() {
        return __awaiter(this, void 0, void 0, function* () {
            this.router = express.Router();
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
            this.router.get("/start", function (req, res, next) {
                return __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield this.initMongo();
                        yield this.updateStudio();
                        yield this.loadApplications();
                        res.send(this.info);
                        res.end();
                    }
                    catch (err) {
                        throw Error(err.message);
                    }
                });
            }.bind(this));
            this.router.get("/", function (req, res, next) {
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
            this.router.get("/updateStudio", function (req, res, next) {
                return __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield this.updateStudio();
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
                        url = url.replace("https://chrome-devtools-frontend.appspot.com", "chrome-devtools://devtools/remote");
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
                    if (this.applications[name])
                        return;
                    var app = new Application_1.default(name, this);
                    this.applications[name] = app;
                    yield app.load();
                });
            }.bind(this));
        });
    }
    createApplication(name) {
        return __awaiter(this, void 0, void 0, function* () {
            var app = new Application_1.default(name, this);
            var fileId = uuid.v1();
            yield this.db.collection(name).insertOne({
                _id: "client",
                _attachments: {}
            }, { w: 1, checkKeys: false });
            yield app.createFile(fileId, "index.html", "hello");
            return app;
        });
    }
    deleteApplication(name) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.collection(name).drop();
            yield this.db.collection(name + ".files").drop();
            yield this.db.collection(name + ".chunks").drop();
        });
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Engine;
