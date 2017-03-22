/// <reference path="_all.d.ts" />
"use strict";

export class Model {

    constructor(jsonObj?: any) {
        if (jsonObj) {
            for (var propName in jsonObj) {
                this[propName] = jsonObj[propName]
            }
        }
    }
}

export class stubInfo {
    stub: any
    stubType: string
    stubNew: boolean
}

export class fileInfo {
    buffer: any
    contentType: string
}

