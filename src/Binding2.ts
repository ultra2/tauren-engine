/// <reference path="_all.d.ts" />

import * as fs from "fs"

export default class Binding {

  private virtualfs: any

  constructor(_virtualfs: any) {
      this.virtualfs = _virtualfs
  }

  public readFileSync(path: string, options:any){
    if (path.substring(0,9) == "/virtual/"){
      return this.virtualfs.readFileSync(path)
    }
    else{
      return fs["realFunctions"].readFileSync(path, options)
    }
  }
}


