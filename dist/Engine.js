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
//var https = require('https');
const Application_1 = require("./Application");
var httpProxy = require('http-proxy');
class Engine {
    constructor() {
        this.proxy = httpProxy.createProxy({ ws: true });
        this.info = {};
        this.applications = {};
        this.templateUrl = "mongodb://guest:guest@ds056549.mlab.com:56549/tauren";
        //this.templateUrl = "mongodb://guest:guest@ds117189.mlab.com:17189/ide"
        this.workingUrl = "mongodb://admin:Leonardo19770206Z@ds056549.mlab.com:56549/tauren";
        this.gitLabAccessToken = "k5T9xs82anhKt1JKaM39";
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            //await this.initMongo()
            //this.gridfs = gridfs(this.db, mongodb);
            var manager = new Application_1.default("manager", this);
            this.applications["manager"] = manager;
            yield manager.init();
            //await this.loadApplications()
            //await this.updateStudio()
            //await this.initRouter()
            yield this.initApp();
        });
    }
    middleware(req, res) {
        console.log("http: " + req.url); // + ", headers: " + util.inspect(req.headers, false, null))
        var app = req.headers.host.substr(0, req.headers.host.indexOf('.'));
        if (!this.applications[app]) {
            console.log("app is null");
            return;
        }
        this.proxy.web(req, res, {
            target: 'http://localhost:' + this.applications[app].port
        }, function (e) {
            console.log(e, req);
        });
    }
    upgrade(req, res) {
        console.log("ws: " + req.url); // + ", headers: " + util.inspect(req.headers, false, null))
        var app = req.headers.host.substr(0, req.headers.host.indexOf('.'));
        if (!this.applications[app]) {
            console.log("app is null");
            return;
        }
        this.proxy.ws(req, res, {
            target: 'http://localhost:' + this.applications[app].port
        }, function (e) {
            console.log(e, req);
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
            console.log(process.env);
            var host = process.env.IP || "127.0.0.1";
            var port = parseInt(process.env.PORT) || 8080;
            this.server.listen(port, host, function () {
                console.log('Engine proxy started on %s:%d ...', host, port);
            });
        });
    }
}
exports.default = Engine;
