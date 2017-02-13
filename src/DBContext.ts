/// <reference path="_all.d.ts" />
"use strict";

import * as mongodb from "mongodb"

export default class DBContext {

  public static db: mongodb.Db;

  public static async initMongo() {
        var url = (process.env["OPENSHIFT_MONGODB_DB_URL"]) ? process.env["OPENSHIFT_MONGODB_DB_URL"] : "mongodb://admin:Leonardo19770206Z@ds117189.mlab.com:17189/ide";
        try {
            this.db = await mongodb.MongoClient.connect(url);
            console.log("Mongo initialized!")
        }
        catch (err) {
            console.log('Mongo error: ', err.message);
        }
    }
}