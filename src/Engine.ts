"use strict";

import * as util from 'util'
import * as path from 'path'
//import * as express from "express"
import * as bodyParser from "body-parser"
import * as mongodb from "mongodb"
import * as gridfs from "gridfs-stream"
import * as request from "request"
import http = require('http')
import https = require('https')
import Application from './Application'
import Utils from './utils'
import * as fsextra from 'fs-extra'
var httpProxy = require('http-proxy')

export default class Engine {

    public proxy: any
    public server: http.Server
    public info: Object
    public db: mongodb.Db
    public applications: Object
    //public router: express.Router
    //public app: express.Application
    public gridfs: gridfs.Grid
    public workingUrl: string
    public templateUrl: string
    public gitLabAccessToken: string
    public livePath: string

    constructor() {
        this.proxy = httpProxy.createProxy({ ws : true });
        this.info = {}
        this.applications = {}
        this.templateUrl = "mongodb://guest:guest@ds056549.mlab.com:56549/tauren"
        //this.templateUrl = "mongodb://guest:guest@ds117189.mlab.com:17189/ide"
        this.workingUrl = "mongodb://admin:Leonardo19770206Z@ds056549.mlab.com:56549/tauren"
        this.gitLabAccessToken = "k5T9xs82anhKt1JKaM39"
        this.livePath = "/tmp/live"
    }

    public async run() {
        //await this.initMongo()
        //this.gridfs = gridfs(this.db, mongodb);

        try{
            console.log("1. addApplications")
            this.addApplications()

            console.log("2. ensureManager")
            await this.ensureManager()

            console.log("3. updateApplications")
            await this.updateApplications()

            console.log("4. runApplications")
            await this.runApplications()
        
    
            //var manager = new Application("manager", 5000, this)
            //this.applications["manager"] = manager
            //await manager.init()

            //var studio = new Application("studio", 5001, this)
            //this.applications["studio"] = studio
            //await studio.init()

            //await this.loadApplications()
            //await this.updateStudio()

            //await this.initRouter()
            await this.initApp()
        }
        catch(err){
            console.log(err)
        }
    }

    private middleware(req, res) {
        console.log("http: " + req.url)// + ", headers: " + util.inspect(req.headers, false, null))

        var app = req.headers.host.substr(0, req.headers.host.indexOf('.'))

        if (!this.applications[app]){
            console.log("App doesn't exists: " + app)
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.write("App doesn't exists: " + app)
            res.end()
            return
        }

        if (!this.applications[app].process){
            console.log("App is not started: " + app)
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.write("App is not started: " + app)
            res.end()
            return
        }

        this.proxy.web(req, res, {
            target: 'http://localhost:' + this.applications[app].port
        },function(err){
            console.log(err);
        });
    }

    private upgrade(req,res){
        console.log("ws: " + req.url)// + ", headers: " + util.inspect(req.headers, false, null))
	
        var app = req.headers.host.substr(0, req.headers.host.indexOf('.'))
        
       if (!this.applications[app]){
            console.log("App doesn't exists: " + app)
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.write("App doesn't exists: " + app)
            res.end()
            return
        }

        if (!this.applications[app].process){
            console.log("App is not started: " + app)
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.write("App is not started: " + app)
            res.end()
            return
        }
        
        this.proxy.ws(req, res, {
            target: 'http://localhost:' + this.applications[app].port
        },function(err){
            console.log(err);
        });
    }

    private async initApp() {
        //this.app = express()

        this.server = http.createServer(this.middleware.bind(this))
        this.server.on('upgrade', this.upgrade.bind(this))

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

        var host:string = process.env.IP || "0.0.0.0"
        var port:number = parseInt(process.env.PORT) || 8080

        this.server.listen(port, host, function() {
            console.log('Engine proxy started on %s:%d ...', host, port);
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

    public addApplications() {
        fsextra.ensureDir(this.livePath)
        this.applications = {}
        var directories = fsextra.readdirSync(this.livePath)
        for (var i in directories) {
            var dir = directories[i]
            if (!fsextra.lstatSync(path.join(this.livePath, dir)).isDirectory()) continue
            var app = new Application(dir, this)
            this.applications[app.name] = app
        }
    }

    public async install(name: string, url: string){
        var app = new Application(name, this)
        url = url.replace("https://", "https://oauth2:" + this.gitLabAccessToken + "@")
        await app.cloneFromGit(url)
        await app.npminstall()
        this.applications[app.name] = app
        return app
    }

    public async uninstall(name: string){
        var app = this.applications[name]
        
        app.process.on('close', function(code, signal) {
            console.log(app.name + ": child process terminated due to receipt of signal ${signal}");
            fsextra.emptyDirSync(app.livePath)
            fsextra.rmdirSync(app.livePath)
            delete this.applications[name]
        }.bind(this));

        app.process.kill();
    }

    public async restart(name: string){
        var app = this.applications[name]
        
        //The 'close' event is emitted when the stdio streams of a child process have been closed. 
        //This is distinct from the 'exit' event, since multiple processes might share the same stdio streams.
        app.process.on('exit', async function(code, signal) {
            console.log(app.name + ": child process terminated due to receipt of signal ${signal}");
            await app.run()
        }.bind(this));

        app.process.kill();
    }

    public async ensureManager() {
        if (this.applications["manager"]) return
        return await this.install("manager", "https://gitlab.com/ultra2/manager.git")
    }

    public async updateApplications(){
        await Promise.all(this.getApplications().map(async app => {
            await app.updateFromGit()
            await app.npminstall()
        }))
    }

    public async runApplications(){
        await Promise.all(this.getApplications().map(async app => {
            await app.run()
        }))
    }

    public getApplications(): Array<Application>{
        var applications: Array<Application> = []
        Object.keys(this.applications).map(function(key) {
            applications.push(this.applications[key])
        }.bind(this))
        return applications
    }

    public getFreePort():number{
        var ports = []
        for (var i in this.applications) {
            ports.push(this.applications[i].port)
        }
        var result = 3000
        while (ports.indexOf(result) != -1) result++
        return result
    }

    //public async loadApplications() {
    //    this.applications = {}
    //    var apps = await this.db.listCollections({}).toArray() 
    //    await Promise.all(apps.map(async app => { 
    //        if (app.name != "manager") return
    //        var app2 = new Application(app.name, this)
    //        this.applications[app.name] = app2
    //        await app2.init()
    //    }))
    //}

    //public async createApplication(name:string) : Promise<Application> {
        //var app = new Application(name, this)
        //await app.create()
        //return app
    //}

    //public async deleteApplication(name:string) : Promise<void> {
    //    if (!this.applications[name]) return

    //    delete this.applications[name]

    //    await this.db.collection(name).drop()
    //    await this.db.collection(name + ".files").drop()
    //    await this.db.collection(name + ".chunks").drop()
    //}

    //public async copyApplicationFromDatabase(sourceDBUrl: string, sourceAppName: string, destAppName: string) : Promise<void> {
    //    var sourcedb = await mongodb.MongoClient.connect(sourceDBUrl);
        
    //    await this.deleteApplication(destAppName)
    
    //    var fs = await sourcedb.collection(sourceAppName).find().toArray()
    //    await this.db.collection(destAppName).insertMany(fs)

    //   var files = await sourcedb.collection(sourceAppName + ".files").find().toArray()
    //    await this.db.collection(destAppName + ".files").insertMany(files)

    //    var chunks = await sourcedb.collection(sourceAppName + ".chunks").find().toArray()
    //    await this.db.collection(destAppName + ".chunks").insertMany(chunks)

    //    await this.loadApplication(destAppName)
    //}
}