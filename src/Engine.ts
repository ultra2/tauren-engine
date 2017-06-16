/// <reference path="_all.d.ts" />
"use strict";

import http = require('http');
import * as express from "express"
import * as bodyParser from "body-parser"
import * as request from "request"
import * as mongodb from "mongodb"
import * as model from './model'
import Application from './Application'
import * as gridfs from "gridfs-stream"
import MongoFS from './MongoFS'
import Utils from './utils'
import MemoryFileSystem = require('memory-fs') //You need to import export = style libraries with import require. This is because of the ES6 spec.
import socketIo = require('socket.io');


export default class Engine {

    public server: http.Server
    public io: SocketIO.Server
    public info: Object
    public db: mongodb.Db
    public applications: Object
    public router: express.Router
    public app: express.Application
    public cache: MemoryFileSystem
    public mongo: MongoFS
    public templateUrl: string

    constructor() {
       
        this.info = {}
        this.applications = {}
        this.cache = new MemoryFileSystem()

        this.templateUrl = "mongodb://guest:guest@ds056549.mlab.com:56549/tauren"
        //this.templateUrl = "mongodb://guest:guest@ds117189.mlab.com:17189/ide"
    }

    public async run() {
        await this.initRouter()
        await this.initApp()

        await this.initMongo()
        this.mongo = new MongoFS(this.db)

        await this.loadApplications()
        await this.updateStudio()
    }

    private async initApp() {
        this.app = express()

//TEST-------------------------------------------------------------
        this.server = http.createServer(this.app)
        this.io = socketIo(this.server)

        this.io.on('connection', function(socket) {
            console.log('socket connection')
            
            socket.on('disconnect', function(){
                console.log('socket disconnect');
            }.bind(this));

            socket.emit("info", this.info)  
            socket.emit("applications", Object.keys(this.applications))  

            socket.on('openApplication', async function(msg){
                var app = this.applications[msg]
                await app.cache(socket)
                await app.compile(socket)
                var fs = await app.loadDocument("fs")
                socket.emit("application", {
                    name: app.name,
                    attachments: fs["_attachments"]
                }) 
            }.bind(this));

            socket.on('editFile', async function(msg){
                //var app = this.applications[msg.app]
                var fileInfo = await this.mongo.loadFile(msg.app + "/" + msg.path)
                socket.emit("editFile", {
                    path: msg.path,
                    contentType: fileInfo.contentType, 
                    content: fileInfo.buffer.toString()
                })
            }.bind(this));

            socket.on('saveFile', async function(msg){
                var content = new Buffer(msg.content, 'base64').toString()
                await this.mongo.uploadFileOrFolder(msg.app + msg.path, content)
                socket.emit("log", "saveFile finished: " + msg.app + msg.path)

                var targetApp = this.applications[msg.app]
                await targetApp.cacheFile(msg.app + msg.path)
                await targetApp.compile(socket)
            }.bind(this));

            socket.on('getCompletionsAtPosition', function(msg){
                var app = this.applications[msg.app]
                msg = app.getCompletionsAtPosition(msg)
                socket.emit('getCompletionsAtPosition', msg);
            }.bind(this));

        }.bind(this));

        this.app.use(bodyParser.json({ type: 'application/json', limit: '5mb' }))  // parse various different custom JSON types as JSON    
        this.app.use(bodyParser.raw({ type: 'application/vnd.custom-type' })) // parse some custom thing into a Buffer      
        this.app.use(bodyParser.text({ type: 'text/*', limit: '5mb' })) // body as string
        //this.app.use(bodyParser.urlencoded({limit: '5mb'})); // parse body if mime "application/x-www-form-urlencoded"
        this.app.use(this.router)
        // catch 404 and forward to error handler
        //this.app.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
        //    var error = new Error("Not Found");
        //    err.status = 404;
        //    next(err);
        //});

        var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080
        var ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0'

        this.server.listen(port, ip, function() {
            console.log('Express started on %s:%d ...', ip, port);
        });
    }

    private async initMongo() {
        if ((process.env.WORKING_DB_URL == null || process.env.WORKING_DB_URL == "") && process.env.DATABASE_SERVICE_NAME) {
            var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase(),
                mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'],
                mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'],
                mongoDatabase = process.env[mongoServiceName + '_DATABASE'],
                mongoPassword = process.env[mongoServiceName + '_PASSWORD'],
                mongoUser = process.env[mongoServiceName + '_USER'];

            if (mongoHost && mongoPort && mongoDatabase) {
                process.env.WORKING_DB_URL = 'mongodb://' + mongoUser + ':' + mongoPassword + '@' + mongoHost + ':' +  mongoPort + '/' + mongoDatabase
            }
        }

        this.info["workingUrl"] = process.env.WORKING_DB_URL

        if (this.db == null){
            try {
                this.db = await mongodb.MongoClient.connect(process.env.WORKING_DB_URL)

                //var workingHost = process.env.WORKING_DB_URL.substring(process.env.WORKING_DB_URL.indexOf('@')+1)
                //var syncfs = new MongoSyncFS("tauren", this.db)
                //syncfs.loadFS()

                console.log("WORKING Mongo initialized!")
                this.info["workingDBConnected"] = true
            }
            catch (err) { 
                console.log('WORKING Mongo error: ', err.message)
                this.info["workingDBConnected"] = false
            }
        }
    } 

    private async updateStudio(){
        this.info["studioUpdated"] = false

        if (this.db == null) return

        //we working on prototype studio, so we can't update
        var workingHost = process.env.WORKING_DB_URL.substring(process.env.WORKING_DB_URL.indexOf('@')+1)
        var templateHost = this.templateUrl.substring(this.templateUrl.indexOf('@')+1)
        if (workingHost == templateHost) return
        
        await this.copyApplicationFromDatabase(this.templateUrl, "studio", "studio")

        this.info["studioUpdated"] = true
    }

    private async initRouter() {
        this.router = express.Router()

        this.router.get("/", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
            try{
                res.redirect('/studio/Static/getFile/index.html');
            }
            catch(err){
                throw Error(err.message)
            }
        }.bind(this))

        this.router.get("/env", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
            try{
                res.send(process.env)
                res.end()
            }
            catch(err){
                throw Error(err.message)
            }
        }.bind(this))

        this.router.get("/info", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
            try{
                res.send(this.info)
                res.end()
            }
            catch(err){
                throw Error(err.message)
            }
        }.bind(this))

        this.router.get('/debugurl', function (req: express.Request, res: express.Response, next: express.NextFunction) {
            request('http://localhost:9229/json/list', function (error, response, body) {
                try{
                    //debug route's host name is generated by OpenShift like this:
                    var debugRouteHost = process.env.ENGINE_SERVICE_NAME + "-debug-" + process.env.OPENSHIFT_BUILD_NAMESPACE + ".44fs.preview.openshiftapps.com"
                    var url = JSON.parse(body)[0].devtoolsFrontendUrl
                    //url = url.replace("https://chrome-devtools-frontend.appspot.com", "chrome-devtools://devtools/remote")
                    url = url.replace("localhost:9229", debugRouteHost)
                    res.send(url)
                    res.end()
                }
                catch(error){
                    res.send(error)
                }
            })
        });

        this.router.get('/:application/:controller/:method/:url(*)?', async function (req: express.Request, res: express.Response, next: express.NextFunction) {
            //console.log("get " + req.originalUrl)
            var application = req.params["application"]
            var controller = req.params["controller"]
            var method = req.params["method"]
            var url = req.params["url"]
            try {
                var app = this.applications[application]
                 if (!app){
                    res.status(404)
                    res.end()
                    return
                }
                var ctrl = app.controllers[controller+"Controller"]
                if (!ctrl){
                    res.status(404)
                    res.end()
                    return
                }
                var ctrl = new ctrl()
                var result = await ctrl[method](url, req.query)
                res.status(result.status)
                res.setHeader("Content-Type", result.contentType)
                res.send(result.body)
            }
            catch (err) {
                console.log(err)
                res.status(500)
                res.send(err.message)
            }
        }.bind(this))

        this.router.post('/:application/:controller/:method/:url(*)?', async function (req: express.Request, res: express.Response, next: express.NextFunction) {
            console.log("post " + req.originalUrl)
            var application = req.params["application"]
            var controller = req.params["controller"]
            var method = req.params["method"]
            var url = req.params["url"]
            var body = req["body"]
            try {
                var app = this.applications[application]
                 if (!app){
                    res.status(404)
                    res.end()
                    return
                }
                var ctrl = app.controllers[controller+"Controller"]
                if (!ctrl){
                    res.status(404)
                    res.end()
                    return
                }
                var ctrl = new ctrl()
                var result = await ctrl[method](url, req.query, body)
                res.status(result.status)
                res.setHeader("Content-Type", result.contentType)
                res.send(result.body)
            }
            catch (err) {
                console.log(err)
                res.status(500)
                res.send(err.message)
            }
        }.bind(this))
    }
    
    public async loadApplication(name:string) {
        if (this.applications[name]) return
        var app = new Application(name, this)
        this.applications[name] = app
        await app.init()
    }

    public async loadApplications() {
        if (!this.db) return
        this.applications = {}
        var data = await this.db.listCollections({}).toArray() 
        data.forEach(async function(element, index){
            var name = element.name.split('.')[0]
            if (name == "system") return
            await this.loadApplication(name)
        }.bind(this))
    }

    public async createApplication(name:string) : Promise<Application> {
        var app = new Application(name, this)
        await app.create()
        return app
    }

    public async deleteApplication(name:string) : Promise<void> {
        if (!this.applications[name]) return

        delete this.applications[name]

        await this.db.collection(name).drop()
        await this.db.collection(name + ".files").drop()
        await this.db.collection(name + ".chunks").drop()
    }

    public async listApplicationsOfDatabase(dburl: string) : Promise<string[]> {
        var result = []
        var sourcedb = await mongodb.MongoClient.connect(dburl);
        var collections = await sourcedb.listCollections({}).toArray();
        for (var i=0; i < collections.length; i++) {  
            var application = collections[i].name       
            if (application.indexOf('.') != -1) continue
            if (application == "objectlabs-system") continue 

            var readme = ""
            var fs = new MongoFS(this.db)
             
            var data = await this.mongo.findOrCreateStub(application, "README.html", false)
            if (data.stub) {
                var filedoc = await sourcedb.collection(application + ".files").findOne({'_id': data.stub._fileId})
                var gfs = gridfs(sourcedb, mongodb);
                var readstream = gfs.createReadStream({
                    _id : filedoc._id,
                    root: application
                });
                try{
                    readme = await Utils.fromStream(readstream)
                }
                catch(err){
                }
            }
            
            result.push({name: application, description: readme.toString()})   
        }
        return result
    }

    public async copyApplicationFromDatabase(sourceDBUrl: string, sourceAppName: string, destAppName: string) : Promise<void> {
        var sourcedb = await mongodb.MongoClient.connect(sourceDBUrl);
        
        await this.deleteApplication(destAppName)
    
        var fs = await sourcedb.collection(sourceAppName).find().toArray()
        await this.db.collection(destAppName).insertMany(fs)

        var files = await sourcedb.collection(sourceAppName + ".files").find().toArray()
        await this.db.collection(destAppName + ".files").insertMany(files)

        var chunks = await sourcedb.collection(sourceAppName + ".chunks").find().toArray()
        await this.db.collection(destAppName + ".chunks").insertMany(chunks)

        await this.loadApplication(destAppName)
    }
}
