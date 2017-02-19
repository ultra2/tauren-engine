/// <reference path="_all.d.ts" />
"use strict";

console.log("Start...")

import * as mongodb from "mongodb"
import * as express from "express"
import * as bodyParser from "body-parser"
import * as request from "request"
import DBContext from './DBContext'
import Engine from './Engine'

class Server {

    private app: express.Application
    private engine: Engine

    public async run() {
        await DBContext.initMongo()
        await this.initApp()
    }

    private async initApp() {
        this.app = express()

        this.engine = new Engine()
        await this.engine.loadApplications()

        let router: express.Router = express.Router();

        router.get("/", async function (req: express.Request, res: express.Response, next: express.NextFunction) {

           
            try{
                var controller = new this.engine.applications.studio.controllers.MainController()
                var result = controller.Test()

                res.send(result)
                res.end()
                
                //return {status: 200, contentType: fileInfo.contentType, body: fileInfo.buffer}
            }
            catch(err){
                throw Error(err.message)
            }

           

            //res.send("tauren-engine running!")
            //res.end()
        }.bind(this))

        router.get('/debugurl', function (req: express.Request, res: express.Response, next: express.NextFunction) {
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
                var app = this.engine.applications[application]
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

        router.post('/:application/:controller/:method/:url(*)?', async function (req: express.Request, res: express.Response, next: express.NextFunction) {
            console.log("post " + req.originalUrl)
            var application = req.params["application"]
            var controller = req.params["controller"]
            var method = req.params["method"]
            var url = req.params["url"]
            var body = req["body"]
            try {
                var app = this.engine.applications[application]
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

        var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080
        var ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0'

        this.app.listen(port, ip, function() {
            console.log('Express started on %s:%d ...', ip, port);
        });
    }
}

var server = new Server();
server.run()
