/// <reference path="_all.d.ts" />
"use strict";

import * as express from "express"
import * as bodyParser from "body-parser"
import * as request from "request"
import * as uuid from "node-uuid"
import * as mongodb from "mongodb"
import Application from './Application'

export default class Engine {

    public info: Object
    public db: mongodb.Db;
    public dbTpl: mongodb.Db;
    public applications: Object
    public router: express.Router
    public app: express.Application
    public templateUrl: string

    constructor() {
        this.info = {}
        this.applications = {}
        this.templateUrl = "mongodb://admin:Leonardo19770206Z@ds117189.mlab.com:17189/ide"
    }

    public async run() {
        await this.initMongo()
        //await this.updateStudio()
        await this.loadApplications()
        await this.initRouter()
        await this.initApp()
    }

    private async initApp() {
        this.app = express()

        this.app.use(bodyParser.json({ type: 'application/json', limit: '5mb' }))  // parse various different custom JSON types as JSON    
        this.app.use(bodyParser.raw({ type: 'application/vnd.custom-type' })) // parse some custom thing into a Buffer      
        this.app.use(bodyParser.text({ type: 'text/*', limit: '5mb' })) // body as string
        //this.app.use(bodyParser.urlencoded({limit: '5mb'})); // parse body if mime "application/x-www-form-urlencoded"
        this.app.use(this.router)
        // catch 404 and forward to error handler
        this.app.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
            var error = new Error("Not Found");
            err.status = 404;
            next(err);
        });

        var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080
        var ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0'

        this.app.listen(port, ip, function() {
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

        try {
            this.db = await mongodb.MongoClient.connect(process.env.WORKING_DB_URL)
            console.log("WORKING Mongo initialized!")
        }
        catch (err) { 
            console.log('WORKING Mongo error: ', err.message)
        }

        var templateUrl = "mongodb://admin:Leonardo19770206Z@ds117189.mlab.com:17189/ide"
        try {
            this.dbTpl = await mongodb.MongoClient.connect(templateUrl)
            console.log("TEMPLATE Mongo initialized!")
        }
        catch (err) {
            console.log('TEMPLATE Mongo error: ', err.message)
        }

        this.info["workingUrl"] = process.env.WORKING_DB_URL
    } 

    private async updateStudio(){
        this.info["studioUpdated"] = false

        if (process.env.WORKING_DB_URL == this.templateUrl) return
        if (this.db == null) return
        if (this.dbTpl == null) return
        
        await this.db.collection("studio").drop()
        await this.db.collection("studio.files").drop()
        await this.db.collection("studio.chunks").drop()

        var fs = await this.dbTpl.collection("studio").find().toArray()
        await this.db.collection("studio").insertMany(fs)

        var files = await this.dbTpl.collection("studio.files").find().toArray()
        await this.db.collection("studio.files").insertMany(files)

        var chunks = await this.dbTpl.collection("studio.chunks").find().toArray()
        await this.db.collection("studio.chunks").insertMany(chunks)

        this.info["studioUpdated"] = true
    }

    private async initRouter() {
        this.router = express.Router()

        this.router.get("/env", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
            try{
                res.send(process.env)
                res.end()
            }
            catch(err){
                throw Error(err.message)
            }
        }.bind(this))

        this.router.get("/", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
            try{
                res.send(this.info)
                res.end()
            }
            catch(err){
                throw Error(err.message)
            }
        }.bind(this))

        this.router.get("/updateStudio", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
            try{
                await this.updateStudio()
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
                    url = url.replace("https://chrome-devtools-frontend.appspot.com", "chrome-devtools://devtools/remote")
                    url = url.replace("localhost:9229", debugRouteHost)
                    res.send(url)
                    res.end()
                }
                catch(error){
                    res.send(error)
                }
            })
        });

        // this.router.get("/:application", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
        //      var application = req.params["application"]
        //      res.send(application)
        //      res.end()

             //Ez gond lehet az OpenShift-en, mert a root-bol vissza kell adjon valamit az app 
             //res.status(301)
             //res.setHeader("Location", "/" + application + "/client/loadFile/index.html")
             //res.end()
        // });

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
    
    public async loadApplications(): Promise<void> {
        if (!this.db) return
        var data = await this.db.listCollections({}).toArray()
         
        data.forEach(async function(element, index){
            var name = element.name.split('.')[0]
            if (name == "system") return
            if (this.applications[name]) return
            var app = new Application(name, this)
            this.applications[name] = app
            await app.load()
        }.bind(this))
    }

    public async createApplication(name:string) : Promise<Application> {
        var app = new Application(name, this)

        var fileId = uuid.v1()
        
        await this.db.collection(name).insertOne({
            _id: "client",
            _attachments: {                        
            }
        }, {w: 1, checkKeys: false})

        await app.createFile(fileId, "index.html", "hello")

        return app
    }

    public async deleteApplication(name:string) : Promise<void> {
        await this.db.collection(name).drop()
        await this.db.collection(name + ".files").drop()
        await this.db.collection(name + ".chunks").drop()
    }
}
