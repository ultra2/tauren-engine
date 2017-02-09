"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
console.log("Start...");
const mongodb = require("mongodb");
const express = require("express");
const bodyParser = require("body-parser");
const controllers = require("./controllers");
const request = require('request');
class Server {
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initMongo();
            yield this.initApp();
        });
    }
    initMongo() {
        return __awaiter(this, void 0, void 0, function* () {
            var url = (process.env["OPENSHIFT_MONGODB_DB_URL"]) ? process.env["OPENSHIFT_MONGODB_DB_URL"] : "mongodb://admin:Leonardo19770206Z@ds117189.mlab.com:17189/ide";
            try {
                this.db = yield mongodb.MongoClient.connect(url);
                console.log("Mongo initialized!");
            }
            catch (err) {
                console.log('Mongo error: ', err.message);
            }
        });
    }
    initApp() {
        return __awaiter(this, void 0, void 0, function* () {
            this.app = express();
            let router = express.Router();
            router.get("/", function (req, res, next) {
                return __awaiter(this, void 0, void 0, function* () {
                    res.send("hello2");
                    res.end();
                });
            });
            router.get('/debugurl', function (req, res) {
                request('http://localhost:9229/json/list', function (error, response, body) {
                    try{
                        var url = JSON.parse(body)[0].devtoolsFrontendUrl
                        url = url.replace("https://chrome-devtools-frontend.appspot.com", "chrome-devtools://devtools/remote")
                        url = url.replace("localhost:9229", "nodejs-ex-debug-tauren.44fs.preview.openshiftapps.com")
                        res.send(url)
                        res.end()
                    }
                    catch(error){
                        res.send(error)
                    }
                })
            });
            router.get('/:application/:controller/:method/:url(*)?', function (req, res, next) {
                return __awaiter(this, void 0, void 0, function* () {
                    console.log("get " + req.originalUrl);
                    var application = req.params["application"];
                    var controller = req.params["controller"];
                    var method = req.params["method"];
                    var url = req.params["url"];
                    try {
                        if (!controllers[controller]) {
                            res.status(404);
                            res.end();
                            return;
                        }
                        var ctrl = new controllers[controller](this.db, application);
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
            router.post('/:application/:controller/:method/:url(*)?', function (req, res, next) {
                return __awaiter(this, void 0, void 0, function* () {
                    console.log("post " + req.originalUrl);
                    var application = req.params["application"];
                    var controller = req.params["controller"];
                    var method = req.params["method"];
                    var url = req.params["url"];
                    var body = req["body"];
                    try {
                        var ctrl = new controllers[controller](this.db, application);
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
            this.app.use(bodyParser.json({ type: 'application/json', limit: '5mb' }));
            this.app.use(bodyParser.raw({ type: 'application/vnd.custom-type' }));
            this.app.use(bodyParser.text({ type: 'text/*', limit: '5mb' }));
            this.app.use(router);
            this.app.use(function (err, req, res, next) {
                var error = new Error("Not Found");
                err.status = 404;
                next(err);
            });

            var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080
            var ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0'
            this.app.listen(port, ip, function () {
                console.log('Express started on %s:%d ...', ip, port);
            });
        });
    }
}
var server = new Server();
server.run();
