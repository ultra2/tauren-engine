/// <reference path="_all.d.ts" />
"use strict";

import http = require('http');
import * as fs from "fs"
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
        this.overrideBinding3()
        
        await this.initRouter()
        await this.initApp()

      

        await this.initMongo()
        this.mongo = new MongoFS(this.db)

        await this.loadApplications()
        await this.updateStudio()
    }

    private async initApp() {
        this.app = express()

        this.server = http.createServer(this.app)
        this.io = socketIo(this.server)

        this.io.on('connection', (socket) => {
            console.log('socket connection')
            socket.on('disconnect', function(){
                console.log('socket disconnect');
            });
            socket.on('chooseApplication', function(msg){
                socket.emit('chooseApplication response', msg + 'from server');
            });
        });

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
            console.log("get " + req.originalUrl)
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

    //private overrideBinding(){
    //    fs["realFunctions"] = {}
    //    fs["memoryFunctions"] = {}
    //    var methods = Object.getOwnPropertyNames(Binding.prototype);
    //    for (var i in methods) {
            //if (typeof this.binding[key] === 'function') {
    //            var method = methods[i]
    //            fs["realFunctions"][method] = fs[method]
    //            fs[method] = this.binding[method].bind(this.binding);
            //} else {
            //    fs[key] = this.binding[key];
            //}
    //    }
    //}

    private overrideBinding2(){
        fs["realFunctions"] = {}
        for (var methodName in fs) {
            if (typeof fs[methodName] === 'function' && methodName[0] != methodName[0].toUpperCase()) {
                fs["realFunctions"][methodName] = fs[methodName]
                fs[methodName] = this.methodFactory2(methodName)
            //} else {
            //    fs[key] = this.binding[key];
            }
        }
    }

    private methodFactory2(methodName): Function{
        return function(){
            console.log(methodName, arguments[0])

            if (["access", "accessSync", "chmod", "chmodSync", "chown", "chownSync", "createReadStream", "createWriteStream", "exists", "existsSync", "lchown", "lchownSync", "lstat", "lstatSync", "mkdir", "mkdirSync", "mkdirp", "open", "openSync", "readdir", "readdirSync", "readFile", "readFileSync", "readlink", "readlinkSync", "rmdir", "rmdirSync", "stat", "statSync"].indexOf(methodName) != -1){
                if (arguments[0].substring(0,8) == "/virtual") {
                    console.log("from cache")
                    return this.cache[methodName].apply(this.cache, arguments)
                }
                if (arguments[0].substring(0,8) == "/mongo") {
                    console.log("from mongo")
                    return this.mongo[methodName].apply(this.mongo, arguments)
                }
            }

            console.log("from fs")
            return fs["realFunctions"][methodName].apply(fs, arguments)

        }.bind(this)
    }

    private overrideBinding3(){
        var methods = ["access", "accessSync", "chmod", "chmodSync", "chown", "chownSync", "createReadStream", "createWriteStream", "exists", "existsSync", "lchown", "lchownSync", "lstat", "lstatSync", "mkdir", "mkdirSync", "mkdirp", "open", "openSync", "readdir", "readdirSync", "readFile", "readFileSync", "readlink", "readlinkSync", "rmdir", "rmdirSync", "stat", "statSync", "truncate", "truncateSync", "unlink", "unlinkSync", "writeFile", "writeFileSync"]
        fs["realFunctions"] = {}
        for (var i in methods) {
            var methodName = methods[i]
            ///if (typeof fs[methodName] === 'function' && methodName[0] != methodName[0].toUpperCase()) {
                fs["realFunctions"][methodName] = fs[methodName]
                fs[methodName] = this.methodFactory3(methodName)
            //} else {
            //    fs[key] = this.binding[key];
            //}
        }
        //make fs a webpack output filesystem 
        fs["join"] = Utils.join
        fs["normalize"] = Utils.normalize
    }

    private methodFactory3(methodName): Function{
        return function(){
            var a = arguments[0].substring(0,6)
            if (a != "/Users") console.log(methodName, arguments[0])

            if (arguments[0].substring(0,8) == "/virtual") {
                console.log("from cache")
                arguments[0] = arguments[0].substring(8)
                return this.cache[methodName].apply(this.cache, arguments)
            }
            if (arguments[0].substring(0,6) == "/mongo") {
                console.log("from mongo")
                arguments[0] = arguments[0].substring(7)
                return this.mongo[methodName].apply(this.mongo, arguments)
            }

            if (a != "/Users") console.log("from fs")
            return fs["realFunctions"][methodName].apply(fs, arguments)

        }.bind(this)
    }

    private methodFactory4(methodName): Function{
        return function(){
            console.log(methodName, arguments[0])
            var result = fs["realFunctions"][methodName].apply(fs, arguments)
            return result
        }.bind(this)
    }
  
    //private currdepth: number = 0 //current position in call stack, change fs only if 0
    //private status: number = 1 //1: fs, 2: cache, 3:mongo
    //private currFS: any

    //private methodFactory5(methodName): Function{
    //    return function(){
    //        console.log(methodName, arguments, this.status, this.currdepth)

    //        if (this.currdepth == 0){
    //            this.status = 1
    //            if (["access", "accessSync", "chmod", "chmodSync", "chown", "chownSync", "createReadStream", "createWriteStream", "exists", "existsSync", "lchown", "lchownSync", "lstat", "lstatSync", "open", "openSync", "readdir", "readdirSync", "readFile", "readFileSync", "leadlink", "leadlinkSync", "rmdir", "rmdirSync", "stat", "statSync"].indexOf(methodName) != -1){
    //                if (arguments[0].substring(0,8) == "/virtual") {
    //                    this.status = 2
    //                }
    //            }
    //        }
    //        this.currdepth += 1
    //        var result = null
    //        try {
    //            if (this.status == 1){
    //                result = fs["realFunctions"][methodName].apply(fs, arguments)
    //            }
    //            else {
    //                result = this.cache[methodName].apply(this.cache, arguments)
    //            }
    //            this.currdepth -= 1
    //            return result
    //        }
    //        catch (err){
    //            debugger
    //        }
    //        finally {
    //            debugger
    //        }      
    //    }.bind(this)
    //}
}
