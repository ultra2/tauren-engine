/// <reference path="_all.d.ts" />
"use strict";

import * as uuid from "node-uuid"
import DBContext from './DBContext'
import Application from './Application'

export default class Engine {

    public applications: Object

    constructor() {
        this.applications = {}
    }

    public async loadApplications(): Promise<void> {
        var data = await DBContext.db.listCollections({}).toArray()
         
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
        
        await DBContext.db.collection(name).insertOne({
            _id: "client",
            _attachments: {                        
            }
        }, {w: 1, checkKeys: false})

        await DBContext.db.collection(name).insertOne({
            _id: "server",
            _attachments: {                        
            }
        }, {w: 1, checkKeys: false})

        await app.createFile(fileId, "index.html", "hello")

        return app
    }

    public async deleteApplication(name:string) : Promise<void> {
        await DBContext.db.collection(name).drop()
        await DBContext.db.collection(name + ".files").drop()
        await DBContext.db.collection(name + ".chunks").drop()
    }
}
