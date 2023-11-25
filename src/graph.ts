"use strict";

import { PrintNode } from "./parser";

interface Link {
  source: string;
  target: string;
}

// Populating map with nodes information
function createNodeIdToNodeMap(plan: PrintNode, nodes: Map<string, PrintNode>) {
  nodes.set(plan.id, plan);
  for (let i = 0; i < plan.inputs.length; ++i) {
    createNodeIdToNodeMap(plan.inputs[i], nodes);
  }
}

// Building graph from Substrait Plan
function buildGraph(plan: PrintNode) {
  const nodes = new Map<string, PrintNode>();
  createNodeIdToNodeMap(plan.inputs[0], nodes);
  const edges: Link[] = [];
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

export { Link, buildGraph };
