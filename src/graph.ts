"use strict";

import * as d3 from "d3";
import icons from "./assets/icons.json";
import { PrintNode } from "./parser"

interface Node extends d3.SimulationNodeDatum {
  name: string;
  type: string;
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
  const edges:{source: string, target: string}[] = [];
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
function processEdges(nodes: { name: string, type: string}[], links: {source: string, target: string}[]) {
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

function typeToLabel(nodeType:string) {
  return nodeType[0].toUpperCase() + nodeType.substring(1);
}

// Drawing Graph using d3JS
function drawGraph(pre_nodes:Map<string, PrintNode>, pre_links:{source: string, target: string}[], use_drag = true, print_info = false) {
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
    .style("fill", (d) => {
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
    .html(function (d) {
      const str =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">' +
        nodeIcon(d.type) +
        "</svg>";
      return str;
    });

  if(print_info){
    // displaying node data on click
    node.on("click", function (d) {
      const node = document.getElementById("nodeData");
      if(!node){
          throw new Error("Object nodeData was not created in DOM")
      }

      const nodeData = pre_nodes.get(d["currentTarget"]["__data__"]["name"]);
      if(!nodeData){
        throw new Error("Current target not found in nodes map")
      }
      
      node.innerHTML = "<h3>" + typeToLabel(nodeData.type) + " Node</h3>";
      node.innerHTML += "<h5>Node Name:" + nodeData.id + "</h5>";

      if (nodeData.inputs.length) {
        node.innerHTML += "<b>Inputs:</b> ";
        for (let i = 0; i < nodeData.inputs.length; ++i) {
          node.innerHTML += nodeData.inputs[i].id + ", ";
        }
        node.innerHTML = node.innerHTML.substring(0, node.innerHTML.length - 2);
      }

      if (nodeData.props.length) {
        node.innerHTML += "<br><br>";
        const propsTable = document.createElement("table");
        const propsTableHead = document.createElement("thead");
        const propsTableBody = document.createElement("tbody");
        const propsTableCaption = document.createElement("caption");
        propsTableCaption.innerHTML = "Properties";
        propsTable.appendChild(propsTableCaption);
        propsTable.appendChild(propsTableHead);
        propsTable.appendChild(propsTableBody);

        let row = document.createElement("tr");
        const heading_1 = document.createElement("th");
        const heading_2 = document.createElement("th");
        heading_1.innerHTML = "Name";
        heading_2.innerHTML = "Value";
        row.appendChild(heading_1);
        row.appendChild(heading_2);
        propsTableHead.append(row);

        for (let i = 0; i < nodeData.props.length; ++i) {
          row = document.createElement("tr");
          const data_1 = document.createElement("td");
          const data_2 = document.createElement("td");
          data_1.innerHTML = nodeData.props[i].name;
          data_2.innerHTML = nodeData.props[i].value;
          row.appendChild(data_1);
          row.appendChild(data_2);
          propsTableBody.appendChild(row);
        }
        node.appendChild(propsTable);
      }

      if (nodeData.schema.children.length) {
        node.innerHTML += "<br>";
        const childrenTable = document.createElement("table");
        const childrenTableHead = document.createElement("thead");
        const childrenTableBody = document.createElement("tbody");
        const childrenTableCaption = document.createElement("caption");
        childrenTableCaption.innerHTML = "Output Schema";
        childrenTable.appendChild(childrenTableCaption);
        childrenTable.appendChild(childrenTableHead);
        childrenTable.appendChild(childrenTableBody);

        let row = document.createElement("tr");
        const heading_1 = document.createElement("th");
        const heading_2 = document.createElement("th");
        const heading_3 = document.createElement("th");
        heading_1.innerHTML = "Name";
        heading_2.innerHTML = "Type";
        heading_3.innerHTML = "Nullability";
        row.appendChild(heading_1);
        row.appendChild(heading_2);
        row.appendChild(heading_3);
        childrenTableHead.append(row);

        for (let i = 0; i < nodeData.schema.children.length; ++i) {
          row = document.createElement("tr");
          const data_1 = document.createElement("td");
          const data_2 = document.createElement("td");
          const data_3 = document.createElement("td");
          data_1.innerHTML = nodeData.schema.children[i].name;
          data_2.innerHTML = nodeData.schema.children[i].type;
          data_3.innerHTML = nodeData.schema.children[i].nullability;
          row.appendChild(data_1);
          row.appendChild(data_2);
          row.appendChild(data_3);
          childrenTableBody.appendChild(row);
        }
        node.appendChild(childrenTable);
      }
    });
  }

  // specifying on tick function for the graph
  force.on("tick", () => {
    link.attr("d", (d) => {
      const source = nodes[d.source];
      const target = nodes[d.target];
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
    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
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
    .attr("transform", function (d, i) {
      return "translate(0," + i * 30 + ")";
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
