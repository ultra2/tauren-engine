/// <reference path="_all.d.ts" />
"use strict";

console.log("Start...")

import * as mongodb from "mongodb";
import * as express from "express";
import * as bodyParser from "body-parser";
import * as controllers from "./controllers";

class Server {

    private app: express.Application;
    private db: mongodb.Db;

    public async run() {
        await this.initMongo()
        await this.initApp()
    }

    private async initMongo() {
        var url = (process.env["OPENSHIFT_MONGODB_DB_URL"]) ? process.env["OPENSHIFT_MONGODB_DB_URL"] : "mongodb://admin:WfWzK2X4Uefw@127.0.0.1:27017/"
        try {
            this.db = await mongodb.MongoClient.connect(url);
            console.log("Mongo initialized!")
        }
        catch (err) {
            console.log('Mongo error: ', err.message);
        }
    }

    private async initApp() {
        this.app = express()

        let router: express.Router = express.Router();

        router.get("/", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
            res.send("hello2")
            res.end()
        });

        // router.get("/:application", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
        //      var application = req.params["application"]
        //      res.send(application)
        //      res.end()

             //Ez gond lehet az OpenShift-en, mert a root-bol vissza kell adjon valamit az app 
             //res.status(301)
             //res.setHeader("Location", "/" + application + "/client/loadFile/index.html")
             //res.end()
        // });

        router.get('/:application/:controller/:method/:url(*)?', async function (req: express.Request, res: express.Response, next: express.NextFunction) {
            console.log("get " + req.originalUrl)
            var application = req.params["application"]
            var controller = req.params["controller"]
            var method = req.params["method"]
            var url = req.params["url"]
            try {
                if (!controllers[controller]){
                    res.status(404)
                    res.end()
                    return
                }
                var ctrl = new controllers[controller](this.db, application)
                var result = await <controllers.response>ctrl[method](url, req.query)
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

        router.post('/:application/:controller/:method/:url(*)?', async function (req: express.Request, res: express.Response, next: express.NextFunction) {
            console.log("post " + req.originalUrl)
            var application = req.params["application"]
            var controller = req.params["controller"]
            var method = req.params["method"]
            var url = req.params["url"]
            var body = req["body"]
            try {
                var ctrl = new controllers[controller](this.db, application)
                var result = await <controllers.response>ctrl[method](url, req.query, body)
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

        this.app.use(bodyParser.json({ type: 'application/json', limit: '5mb' }))  // parse various different custom JSON types as JSON    
        this.app.use(bodyParser.raw({ type: 'application/vnd.custom-type' })) // parse some custom thing into a Buffer      
        this.app.use(bodyParser.text({ type: 'text/*', limit: '5mb' })) // body as string
        //this.app.use(bodyParser.urlencoded({limit: '5mb'})); // parse body if mime "application/x-www-form-urlencoded"

        this.app.use(router)

        // catch 404 and forward to error handler
        this.app.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
            var error = new Error("Not Found");
            err.status = 404;
            next(err);
        });

        var port = process.env.OPENSHIFT_NODEJS_PORT || 3000
        var ipaddress = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1'

        this.app.listen(port, ipaddress, function() {
            console.log('Express started on %s:%d ...', ipaddress, port);
        });
    }
}

var server = new Server();
server.run()
