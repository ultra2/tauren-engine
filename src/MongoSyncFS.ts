import * as mongodb from "mongodb"
import * as fibers from "fibers"

export default class MongoSyncFS {

  private application: string
  private db: mongodb.Db
  private fsobj: object

  constructor(application: string, db: mongodb.Db) {
    this.application = application
    this.db = db
  }

  public loadFS() {
    if (this.fsobj) return

    fibers(function() {

      var fiber = fibers.current;

      setTimeout(function() {
        fiber.run();
      }, 15000);

      console.log("before yield")

      fibers.yield(0);

      console.log("after yield")

    }).run();


    //this.fsobj = await this.db.collection(this.application).findOne({ _id: "fs" })
    console.log(this.fsobj)
  }

 
}