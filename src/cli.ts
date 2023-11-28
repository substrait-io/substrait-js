import figlet from "figlet";
import { Command } from "commander";
import { readFileSync } from "fs";
import { writeFile } from "fs/promises";

import { substrait } from "./generated/definitions";
import { SubstraitParser } from "./parser";
import { buildGraph } from "./graph";
import { renderGraph } from "./render";

const program = new Command();

console.log(figlet.textSync("substraitJS"));

program
  .description("Tool for parsing substrait plan and generating visualization")
  .option("-p, --path  [value]", "Path to the substrait plan file")
  .option("-o, --output [value]", "Path to the output directory")
  .parse(process.argv);

const options = program.opts();

if (options.path) {
  const fileExtension = options.path.split(".").pop()?.toLowerCase();
  if (fileExtension === "json") {
    generateJSON(options.path);
  } else {
    generateBinary(options.path);
  }
} else {
  throw console.error(
    "Error: Path to the plan file is required to generate plot",
  );
}

function generateJSON(path: string) {
  console.log("JSON file detected, parsing...");
  let json: { [k: string]: any };
  try {
    const data = readFileSync(path, "utf-8");
    json = JSON.parse(data);
  } catch (error) {
    throw console.error("Error while parsing JSON file: ", error);
  }
  const plan = substrait.Plan.fromObject(json);
  plot(plan);
}

function generateBinary(path: string) {
  console.log("Binary file detected, parsing...");
  let data: Buffer;
  try {
    data = readFileSync(path);
  } catch (error) {
    throw console.error("Error while reading Binary file:", error);
  }
  const plan = substrait.Plan.decode(new Uint8Array(data));
  plot(plan);
}

async function plot(plan: substrait.Plan) {
  try {
    const subplan = new SubstraitParser(plan).planToNode(plan);
    const graph = buildGraph(subplan);
    const svgString = await renderGraph(graph["edges"]);

    try {
      if (!options.output) {
        options.output = process.cwd();
      }

      await writeFile(options.output + "/plan.svg", svgString);
      console.log("SVG file saved successfully!");
    } catch (err) {
      console.error("Error saving SVG file:", err);
    }
  } catch (error) {
    throw console.error("Error generating plot: " + error);
  }
}
