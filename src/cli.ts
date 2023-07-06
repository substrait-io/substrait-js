#!/usr/bin/env node

import figlet from "figlet";
import { Command } from 'commander';

import { substrait } from "./generated/definitions";
import { SubstraitParser } from "./parser";
import { buildGraph, drawGraph } from "./graph";

const program = new Command();

console.log(figlet.textSync("substraitJS"));

program
  .description("Tool for parsing substrait plan and generating visualization")
  .option("-p, --path  [value]", "Path to the substrait plan file")
  .option("-o, --output [value]", "Path to the output directory")
  .option("-f, --format <value>", "Format of generated visualization")
  .parse(process.argv);

const options = program.opts();

if (options.path) {
    const fileExtension = options.path.split('.').pop()?.toLowerCase();
    if (fileExtension === 'json') {
        generateJSON(options.path, options.format);
    } else {
        generateBinary(options.path, options.format);
    }
}

function generateJSON(path:string, format:string){
    console.log("JSON file detected, parsing...");
    const fs = require('fs');
    let json:{[k: string]: any};
    let plan:substrait.Plan;
    try {
      const data = fs.readFileSync(path);
      json = JSON.parse(data);
    } catch (error) {
      throw console.error("Error while parsing JSON file: ", error);
    }
    plan = substrait.Plan.fromObject(json);
    plot(plan);
}

function generateBinary(path:string, format:string){
    console.log("Binary file detected, parsing...");
    const fs = require('fs');
    let data:Buffer;
    let plan:substrait.Plan;
    try {
      data = fs.readFileSync(path);
    } catch (error) {
      throw console.error('Error while reading Binary file:', error);
    }
    plan = substrait.Plan.decode(new Uint8Array(data));
    plot(plan);
}

function plot(plan:substrait.Plan) {

    const jsdom = require("jsdom");
    const d3 = require("d3");

    const { JSDOM } = jsdom;
    const document = new JSDOM().window.document;
    
    d3.select(document.body).append("div").append("svg");

    try {
      const subplan = new SubstraitParser(plan).planToNode(plan);
      const graph = buildGraph(subplan);
      drawGraph(graph["nodes"], graph["edges"]);
      console.log("Plan generation successful!");
    } catch (error) {
      throw console.error("Error generating plot: " + error);
    }
  }
