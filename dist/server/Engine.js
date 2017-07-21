"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as path from 'path';
import * as http from 'http';
import Application from './Application';
import * as fsextra from 'fs-extra';
var httpProxy = require('http-proxy');
export default class Engine {
    constructor() {
        this.proxy = httpProxy.createProxy({ ws: true });
        this.info = {};
        this.applications = {};
        this.templateUrl = "mongodb://guest:guest@ds056549.mlab.com:56549/tauren";
        //this.templateUrl = "mongodb://guest:guest@ds117189.mlab.com:17189/ide"
        this.workingUrl = "mongodb://admin:Leonardo19770206Z@ds056549.mlab.com:56549/tauren";
        this.gitLabAccessToken = "k5T9xs82anhKt1JKaM39";
        this.gitHubAccessToken = "5e9270abeeae41c6dbde9ecc384385b05387bf83";
        this.livePath = "/tmp/live";
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            //await this.initMongo()
            //this.gridfs = gridfs(this.db, mongodb);
            try {
                console.log("1. addApplications");
                this.addApplications();
                console.log("2. ensureManager");
                yield this.ensureManager();
                console.log("3. updateApplications");
                yield this.updateApplications();
                console.log("4. runApplications");
                yield this.runApplications();
                //var manager = new Application("manager", 5000, this)
                //this.applications["manager"] = manager
                //await manager.init()
                //var studio = new Application("studio", 5001, this)
                //this.applications["studio"] = studio
                //await studio.init()
                //await this.loadApplications()
                //await this.updateStudio()
                //await this.initRouter()
                yield this.initApp();
            }
            catch (err) {
                console.log(err);
            }
        });
    }
    middleware(req, res) {
        console.log("http: " + req.url); // + ", headers: " + util.inspect(req.headers, false, null))
        var app = req.headers.host.substr(0, req.headers.host.indexOf('.'));
        if (!this.applications[app]) {
            console.log("App doesn't exists: " + app);
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.write("App doesn't exists: " + app);
            res.end();
            return;
        }
        if (!this.applications[app].process) {
            console.log("App is not started: " + app);
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.write("App is not started: " + app);
            res.end();
            return;
        }
        this.proxy.web(req, res, {
            target: 'http://localhost:' + this.applications[app].port
        }, function (err) {
            console.log(err);
        });
    }
    upgrade(req, res) {
        console.log("ws: " + req.url); // + ", headers: " + util.inspect(req.headers, false, null))
        var app = req.headers.host.substr(0, req.headers.host.indexOf('.'));
        if (!this.applications[app]) {
            console.log("App doesn't exists: " + app);
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.write("App doesn't exists: " + app);
            res.end();
            return;
        }
        if (!this.applications[app].process) {
            console.log("App is not started: " + app);
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.write("App is not started: " + app);
            res.end();
            return;
        }
        this.proxy.ws(req, res, {
            target: 'http://localhost:' + this.applications[app].port
        }, function (err) {
            console.log(err);
        });
    }
    initApp() {
        return __awaiter(this, void 0, void 0, function* () {
            //this.app = express()
            this.server = http.createServer(this.middleware.bind(this));
            this.server.on('upgrade', this.upgrade.bind(this));
            //this.io = socketIo(this.server)
            //this.io.on('connection', async function(socket) {
            //    console.log('socket connection')
            //    var app = this.applications[socket.handshake.query.app]
            //    app.process.on('message', (msg) => {
            //        socket.emit(msg.message, msg.data)
            //    })
            //    app.process.send({ message: 'main:connect', data: null })
            //    socket.use((params, next) => {
            //        app.process.send({ message: params[0], data: params[1] })
            //    })
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
            //    socket.on('disconnect', function(){
            //        console.log('socket disconnect');
            //    }.bind(this));
            //socket.emit("info", this.info)  
            //socket.emit("applications", Object.keys(this.applications))  
            //}.bind(this));
            //this.app.use(bodyParser.json({ type: 'application/json', limit: '5mb' }))  // parse various different custom JSON types as JSON    
            //this.app.use(bodyParser.raw({ type: 'application/vnd.custom-type' })) // parse some custom thing into a Buffer      
            //this.app.use(bodyParser.text({ type: 'text/*', limit: '5mb' })) // body as string
            ////this.app.use(bodyParser.urlencoded({limit: '5mb'})); // parse body if mime "application/x-www-form-urlencoded"
            //this.app.use(this.router)
            // catch 404 and forward to error handler
            //this.app.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
            //    var error = new Error("Not Found");
            //    err.status = 404;
            //    next(err);
            //});
            //console.log(process.env)
            var host = process.env.IP || "0.0.0.0";
            var port = parseInt(process.env.PORT) || 8080;
            this.server.listen(port, host, function () {
                console.log('Engine proxy started on %s:%d ...', host, port);
            });
        });
    }
    //private async initMongo() {
    //    try {
    //        this.db = await mongodb.MongoClient.connect(this.workingUrl, { autoReconnect: true })
    //        this.info["workingUrl"] = this.workingUrl.substring(this.workingUrl.indexOf('@')+1)
    //        console.log("WORKING Mongo initialized!")
    //        this.info["workingDBConnected"] = true
    //    }
    //    catch (err) { 
    //        console.log('WORKING Mongo error: ', err.message)
    //        this.info["workingDBConnected"] = false
    //    }
    //} 
    //private async initRouter() {
    //    this.router = express.Router()
    //    this.router.get("/", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
    //        try{
    //            res.redirect('/studio44/Static/getFile/client/index.html');
    //        }
    //        catch(err){
    //            throw Error(err.message)
    //        }
    //    }.bind(this))
    //    this.router.get("/env", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
    //        try{
    //            res.send(process.env)
    //            res.end()
    //        }
    //        catch(err){
    //            throw Error(err.message)
    //        }
    //    }.bind(this))
    //    this.router.get("/info", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
    //        try{
    //            res.send(this.info)
    //            res.end()
    //        }
    //        catch(err){
    //            throw Error(err.message)
    //        }
    //    }.bind(this))
    //  this.router.get('/debugurl', function (req: express.Request, res: express.Response, next: express.NextFunction) {
    //        request('http://localhost:9229/json/list', function (error, response, body) {
    //            try{
    //                //debug route's host name is generated by OpenShift like this:
    //                var debugRouteHost = process.env.ENGINE_SERVICE_NAME + "-debug-" + process.env.OPENSHIFT_BUILD_NAMESPACE + ".44fs.preview.openshiftapps.com"
    //                var url = JSON.parse(body)[0].devtoolsFrontendUrl
    //                //url = url.replace("https://chrome-devtools-frontend.appspot.com", "chrome-devtools://devtools/remote")
    //                url = url.replace("localhost:9229", debugRouteHost)
    //                res.send(url)
    //                res.end()
    //            }
    //           catch(error){
    //               res.send(error)
    //            }
    //        })
    //    });
    //    this.router.get('/:application/:controller/:method/:url(*)?', async function (req: express.Request, res: express.Response, next: express.NextFunction) {
    //        //console.log("get " + req.originalUrl)
    //        var application = req.params["application"]
    ///        var controller = req.params["controller"]
    //        var method = req.params["method"]
    //        var url = req.params["url"]
    //        try {
    //           var app = this.applications[application]
    //            if (!app){
    //                res.status(404)
    //                res.end()
    //                return
    //            }
    //            var result = null
    //            //var fileInfo = await app.dbLoadFile(url)
    //            //result = {status: 200, contentType: fileInfo.contentType, body: fileInfo.buffer}
    //            var buffer = fsextra.readFileSync(app.livePath + '/' + url)
    //            result = {status: 200, contentType: Utils.getMime(url), body: buffer}
    //            res.status(result.status)
    //            res.setHeader("Content-Type", result.contentType)
    //            res.send(result.body)
    //        }
    //        catch (err) {
    //            console.log(err)
    //            res.status(500)
    //            res.send(err.message)
    //        }
    //    }.bind(this))
    //}
    addApplications() {
        fsextra.ensureDirSync(this.livePath);
        this.applications = {};
        var directories = fsextra.readdirSync(this.livePath);
        for (var i in directories) {
            var dir = directories[i];
            if (!fsextra.lstatSync(path.join(this.livePath, dir)).isDirectory())
                continue;
            var app = new Application(dir, this);
            this.applications[app.name] = app;
        }
    }
    install(name, url, accessToken) {
        return __awaiter(this, void 0, void 0, function* () {
            var app = new Application(name, this);
            //if (!accessToken) {
            //      accessToken = this.gitLabAccessToken
            //}
            //url = url.replace("https://", "https://oauth2:" + accessToken + "@")
            yield app.cloneFromGit(url, accessToken);
            yield app.npminstall();
            this.applications[app.name] = app;
            return app;
        });
    }
    uninstall(name) {
        return __awaiter(this, void 0, void 0, function* () {
            var app = this.applications[name];
            app.process.on('close', function (code, signal) {
                console.log(app.name + ": child process terminated due to receipt of signal ${signal}");
                fsextra.emptyDirSync(app.livePath);
                fsextra.rmdirSync(app.livePath);
                delete this.applications[name];
            }.bind(this));
            app.process.kill();
        });
    }
    restart(name) {
        return __awaiter(this, void 0, void 0, function* () {
            var app = this.applications[name];
            //The 'close' event is emitted when the stdio streams of a child process have been closed. 
            //This is distinct from the 'exit' event, since multiple processes might share the same stdio streams.
            app.process.on('exit', function (code, signal) {
                return __awaiter(this, void 0, void 0, function* () {
                    console.log(app.name + ": child process terminated due to receipt of signal ${signal}");
                    yield app.run();
                });
            }.bind(this));
            app.process.kill();
        });
    }
    ensureManager() {
        return __awaiter(this, void 0, void 0, function* () {
            var name = process.env["MANAGER_ALIAS"] || "manager";
            if (this.applications[name])
                return;
            return yield this.install(name, "https://gitlab.com/ultra2/manager.git", "");
        });
    }
    updateApplications() {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all(this.getApplications().map((app) => __awaiter(this, void 0, void 0, function* () {
                yield app.updateFromGit();
                yield app.npminstall();
            })));
        });
    }
    runApplications() {
        return __awaiter(this, void 0, void 0, function* () {
            var name = process.env["MANAGER_ALIAS"] || "manager";
            var app = this.applications[name];
            yield app.run();
            // await Promise.all(this.getApplications().map(async app => {
            //    await app.run()
            //}))
        });
    }
    getApplications() {
        var applications = [];
        Object.keys(this.applications).map(function (key) {
            applications.push(this.applications[key]);
        }.bind(this));
        return applications;
    }
    getFreePort() {
        var ports = [];
        for (var i in this.applications) {
            ports.push(this.applications[i].port);
        }
        var result = 3000;
        while (ports.indexOf(result) != -1)
            result++;
        return result;
    }
}
