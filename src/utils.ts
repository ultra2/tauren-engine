/// <reference path="_all.d.ts" />
"use strict";

import * as stream from "stream";
import * as request from "request";

export default class Utils {

  static fromStream(stream: stream): Promise<any> {
    return new Promise((resolve, reject) => {
      var buffer;

      stream.on('data', function (data) {
        if (buffer == null) {
          buffer = data
          return
        }
        buffer += data
      })

      stream.on('end', () => resolve(buffer))
      stream.on('error', (err) => reject(err))
    })
  }

  static toStream(data: any, writestream: NodeJS.WritableStream): Promise<any> {
    writestream.write(data);
    writestream.end()

    return new Promise<Object>(function (resolve, reject) {
      writestream.on('close', function (result) {
        resolve(result)
      });
      writestream.on('error', function (err) {
        reject(err.message)
      });
    })
  }

  static callService(uri: string, options?: request.CoreOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      options = options || {}
      options.headers = options.headers || {}
      options.headers['user-agent'] = 'node.js'
      request(uri, options, function (err, resp, body) {
        if (err) {
          reject(err)
          return
        }
        resolve(body)
      })
    })
  }

  static createInstanceFromJson<T>(objType: { new (): T; }, json: any) {
    const newObj = new objType();
    const relationships = objType["relationships"] || {};

    for (const prop in json) {
      if (json.hasOwnProperty(prop)) {
        if (newObj[prop] == null) {
          if (relationships[prop] == null) {
            newObj[prop] = json[prop];
          }
          else {
            newObj[prop] = this.createInstanceFromJson(relationships[prop], json[prop]);
          }
        }
        else {
          console.warn(`Property ${prop} not set because it already existed on the object.`);
        }
      }
    }

    return newObj;
  }
}
