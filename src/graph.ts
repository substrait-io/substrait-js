"use strict";

import * as d3 from "d3";
import icons from "./assets/icons.json";
import { PrintNode } from "./parser"

interface Node extends d3.SimulationNodeDatum {
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

// Specifying color of graph nodes
const COLORS = {
  "node-green": "#0E4D05",
  "node-blue": "#052748",
  "node-brown": "#4D2205",
  "node-purple": "#46054D",
  "node-grey": "#808080"
};
function nodeColor(nodeType:string) {
  switch (nodeType) {
    case "sink":
      return COLORS["node-brown"];
    case "project":
      return COLORS["node-green"];
    case "read":
      return COLORS["node-blue"];
    case "join":
      return COLORS["node-purple"];
    default:
      return COLORS["node-grey"];
  }
}

// Specifying Font-Awesome icons for graph nodes
function nodeIcon(nodeType:string) {
  switch (nodeType) {
    case "sink":
      return icons["download"];
    case "project":
      return icons["kanban"];
    case "read":
      return icons["eye"];
    case "join":
      return icons["sign-intersection-y"];
  }
}

// Drawing Graph using d3JS
function drawGraph(pre_nodes:Map<string, PrintNode>, pre_links:Link[], use_drag = true, print_info?: (node: any, pre_nodes: Map<string, PrintNode>) => void) {
  const width = 960,
    height = 375;
  const nodes = processNodes(pre_nodes);
  const links = processEdges(nodes, pre_links);

  // Instantiating a Force Simulation
  const force = d3
    .forceSimulation(nodes)
    .force("charge", d3.forceManyBody().strength(-100))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("link", d3.forceLink().links(links))
    .force(
      "collide",
      d3.forceCollide(() => 55)
    );

  const svg = d3
    .select("svg")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("viewBox", "0 0 960 375");

  // For arrowheads in edges
  svg
    .append("defs")
    .append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "-0 -5 10 10")
    .attr("refX", 27)
    .attr("refY", 0)
    .attr("orient", "auto")
    .attr("markerWidth", 13)
    .attr("markerHeight", 13)
    .attr("xoverflow", "visible")
    .append("svg:path")
    .attr("d", "M 0,-5 L 10 ,0 L 0,5")
    .attr("fill", "black")
    .style("stroke", "none");

  // specifying links in the graph
  const link = svg
    .append("g")
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("marker-end", "url(#arrowhead)")
    .style("stroke", "black");

  // specifying nodes in graph
  const node = svg.append("g").selectAll("g").data(nodes).join("g");

  // specifying node shape and color
  node
    .append("circle")
    .attr("r", 25)
    .style("fill", (d: Node) => {
      return nodeColor(d.type);
    })
    .style("stroke-opacity", 0.3);

  // adding icon in node
  node
    .append("svg:foreignObject")
    .attr("width", 50)
    .attr("height", 50)
    .attr("x", -7)
    .attr("y", -15)
    .style("color", "white")
    .html(function (d:Node) {
      const str =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">' +
        nodeIcon(d.type) +
        "</svg>";
      return str;
    });

  if(print_info){
    print_info(node, pre_nodes);
  }

  // specifying on tick function for the graph
  force.on("tick", () => {
    link.attr("d", (d: any) => {
      const source: any = nodes[d.source];
      const target: any = nodes[d.target];
      return (
        "M" +
        source.x +
        "," +
        source.y +
        "A0,0 0 0,1" +
        target.x +
        "," +
        target.y
      );
    });
    node.attr("transform", (d: Node) => `translate(${d.x},${d.y})`);
  });

  // network drag simulation
  function drag(network: d3.Simulation<any, undefined>) {
    function dragstarted(event: d3.D3DragEvent<any, any, any>, d: any) {
      if (!event.active) network.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<any, any, any>, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<any, any, any>, d: any) {
      if (!event.active) network.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3
      .drag<any, any, any>()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  if (use_drag) {
    node.call(drag(force as d3.Simulation<any, undefined>));
  }

  // for legend mentioning node icons
  const nodeSet = new Set();
  for (let i = 0; i < nodes.length; ++i) {
    nodeSet.add(nodes[i].type);
  }

  const legend = svg
    .selectAll(".legend")
    .data(nodeSet)
    .enter()
    .append("g")
    .attr("class", "legend")
    .attr("transform", function (_: unknown, i: number) {
      return `translate(0,${i * 30})`;
    });

  legend
    .append("rect")
    .attr("x", -2)
    .attr("width", 50)
    .attr("height", 50)
    .style("fill", "transparent");

  legend
    .append("svg:foreignObject")
    .attr("width", 100)
    .attr("height", 100)
    .attr("y", -4)
    .style("color", "black")
    .html(function (d:unknown) {
      const str =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">' +
        nodeIcon(d as string) +
        "</svg> " +
        d;
      return str;
    });
}

function clearGraph() {
  const svg = d3.select("svg");
  svg.html("");
}

export { buildGraph, clearGraph, drawGraph };
