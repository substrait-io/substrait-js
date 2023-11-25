"use strict";

import { PrintNode } from "./parser"
import { JSDOM } from "jsdom";
import { instance } from "@viz-js/viz";


interface Node {
  name: string;
  type: string;
}

interface Link {
  source: string;
  target: string;
}

// Populating map with nodes information
function createNodeIdToNodeMap(plan:PrintNode, nodes:Map<string, PrintNode>) {
  nodes.set(plan.id, plan);
  for (let i = 0; i < plan.inputs.length; ++i) {
    createNodeIdToNodeMap(plan.inputs[i], nodes);
  }
}

// Building graph from Substrait Plan
function buildGraph(plan:PrintNode) {
  const nodes = new Map<string, PrintNode>();
  createNodeIdToNodeMap(plan.inputs[0], nodes);
  const edges:Link[] = [];
  nodes.forEach((value) => {
    for (let i = 0; i < value.inputs.length; ++i) {
      edges.push({ source: value.inputs[i].id, target: value.id });
    }
  });
  return {
    nodes: nodes,
    edges: edges,
  };
}

// Processing nodes for d3JS forcedSimulation's format
function processNodes(nodes: Map<string, PrintNode>) {
  const processedNodes:Node[] = [];
  nodes.forEach((value) => {
    processedNodes.push({ name: value.id, type: value.type });
  });
  return processedNodes;
}

// Processing edges for d3JS forcedSimulation's format
function processEdges(nodes: Node[], links: Link[]) {
  const processedLinks = [];
  for (let i = 0; i < links.length; ++i) {
    const source = nodes.findIndex((j) => j.name === links[i].source);
    const target = nodes.findIndex((j) => j.name === links[i].target);
    processedLinks.push({ source, target });
  }
  return processedLinks;
}

function drawGraph(edges: Link[]): Promise<string>{
  const dom = new JSDOM();
  global.document = dom.window.document;
  global.DOMParser = new JSDOM().window.DOMParser;

  return instance().then((viz) => {
    const dotString = `digraph { ${edges.map((edge) => `${edge.source} -> ${edge.target}`).join("; ")} }`;

    const svg = viz.renderSVGElement(dotString);
    return svg.outerHTML;
  }) as Promise<string>;
}

export { buildGraph, drawGraph};
