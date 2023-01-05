const mermaid = require("mermaid");

const { substrait } = require("substrait");
const { substraitToJson } = require("./substrait-to-json");
const { substraitToMermaid } = require("./substrait-to-mermaid");
const { SubstraitParser } = require("./substrait-parser");
const { substraitD3, buildGraph, drawGraph } = require("./substrait-to-d3");

mermaid.initialize({ startOnLoad: true });

window.onload = function () {
  document.getElementById("file-input").addEventListener("input", (e) => {
    const reader = new FileReader();
    reader.onerror = function () {
      console.log("Error");
      console.log(reader.error);
      return;
    };
    reader.onload = function () {
      try {
        const plan = substrait.Plan.decode(new Uint8Array(reader.result));
        const planJson = substraitToJson(plan);
        document.getElementById("plan-json").data = JSON.parse(planJson);
        const subplan = new SubstraitParser(plan).planToNode(plan);
        const graph = buildGraph(subplan);
        drawGraph(graph["nodes"], graph["edges"]);
      } catch (e) {
        dst = document.getElementById("plan-json");
        dst.data = { error: `Error parsing the plan: ${e}` };
      }
    };
    reader.readAsArrayBuffer(document.getElementById("file-input").files[0]);
  });
};
