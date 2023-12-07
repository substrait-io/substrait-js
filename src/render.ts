"use strict";

import { JSDOM } from "jsdom";
import { instance } from "@viz-js/viz";

import { Link } from "./graph";

function renderGraph(edges: Link[]): Promise<string> {
  const dom = new JSDOM();
  global.document = dom.window.document;
  global.DOMParser = new JSDOM().window.DOMParser;

  return instance().then((viz) => {
    const dotString = `digraph { ${edges
      .map((edge) => `${edge.source} -> ${edge.target}`)
      .join("; ")} }`;

    const svg = viz.renderSVGElement(dotString);
    return svg.outerHTML;
  }) as Promise<string>;
}

export { renderGraph };
