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
const express = require("express");
const bodyParser = require("body-parser");
const mongodb = require("mongodb");
const gridfs = require("gridfs-stream");
const request = require("request");
const http = require("http");
const socketIo = require("socket.io");
const Application_1 = require("./Application");
const utils_1 = require("./utils");
const fsextra = require("fs-extra");
class Engine {
    constructor() {
        this.info = {};
        this.applications = {};
        this.templateUrl = "mongodb://guest:guest@ds056549.mlab.com:56549/tauren";
        //this.templateUrl = "mongodb://guest:guest@ds117189.mlab.com:17189/ide"
        this.workingUrl = "mongodb://admin:Leonardo19770206Z@ds056549.mlab.com:56549/tauren";
        this.gitLabAccessToken = "k5T9xs82anhKt1JKaM39";
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initMongo();
            this.gridfs = gridfs(this.db, mongodb);
            yield this.loadApplications();
            //await this.updateStudio()
            yield this.initRouter();
            yield this.initApp();
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
                    var app = this.applications[socket.handshake.query.app];
                    app.process.on('message', (msg) => {
                        socket.emit(msg.message, msg.data);
                    });
                    app.process.send({ message: 'main:connect', data: null });
                    socket.use((params, next) => {
                        app.process.send({ message: params[0], data: params[1] });
                    });
                    // socket.use((socket, next) => {
                    //     let clientId = socket.handshake.headers['x-clientid'];
                    //     debugger
                    //     return next();
                    // });
                    //socket["session"] = socket["session"] || {}
                    //socket.use((params, next) => {
                    //    var message = params[0]
                    //    var splittedMessage = message.split(':')
                    //    var component = splittedMessage[0]
                    //    var method = splittedMessage[1]
                    //    var data = params[1]
                    //    var app = this.applications[socket.handshake.query.app]
                    //    var componentModule = app.requireModule(component)
                    //    var componentInstance = new componentModule.default()
                    //    componentInstance["db"] = this.db
                    //    componentInstance["gridfs"] = this.gridfs
                    //    componentInstance["emitfn"] = function(message, data){
                    //        socket.emit(message, data)
                    //    }
                    //experimental
                    //    componentInstance["session"] = socket["session"]
                    //    componentInstance[method](data)
                    //    return next();
                    //})
                    socket.on('disconnect', function () {
                        console.log('socket disconnect');
                    }.bind(this));
                    //socket.emit("info", this.info)  
                    //socket.emit("applications", Object.keys(this.applications))  
                });
            }.bind(this));
            this.app.use(bodyParser.json({ type: 'application/json', limit: '5mb' })); // parse various different custom JSON types as JSON    
            this.app.use(bodyParser.raw({ type: 'application/vnd.custom-type' })); // parse some custom thing into a Buffer      
            this.app.use(bodyParser.text({ type: 'text/*', limit: '5mb' })); // body as string
            //this.app.use(bodyParser.urlencoded({limit: '5mb'})); // parse body if mime "application/x-www-form-urlencoded"
            this.app.use(this.router);
            // catch 404 and forward to error handler
            //this.app.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
            //    var error = new Error("Not Found");
            //    err.status = 404;
            //    next(err);
            //});
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
                        res.redirect('/studio44/Static/getFile/client/index.html');
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
                        //debug route's host name is generated by OpenShift like this:
                        var debugRouteHost = process.env.ENGINE_SERVICE_NAME + "-debug-" + process.env.OPENSHIFT_BUILD_NAMESPACE + ".44fs.preview.openshiftapps.com";
                        var url = JSON.parse(body)[0].devtoolsFrontendUrl;
                        //url = url.replace("https://chrome-devtools-frontend.appspot.com", "chrome-devtools://devtools/remote")
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
                    //console.log("get " + req.originalUrl)
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
                        //var fileInfo = await app.dbLoadFile(url)
                        //result = {status: 200, contentType: fileInfo.contentType, body: fileInfo.buffer}
                        var buffer = fsextra.readFileSync(app.livePath + '/' + url);
                        result = { status: 200, contentType: utils_1.default.getMime(url), body: buffer };
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
            if (name != "studio44")
                return;
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
}
exports.default = Engine;
