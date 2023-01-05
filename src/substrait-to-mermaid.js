"use strict";

const { SubstraitParser } = require("./substrait-parser");

/**
 * Helper function to add two spaces to every line
 * @param {string} val a newline delimited line
 * @return {string} An indented version
 */
function indentify(val) {
  return val
    .split(/\n/)
    .map((x) => "  " + x)
    .join("\n");
}

/**
 * Converts a print node property to a mermaid styled string
 * @param {SimpleProperty} prop
 * @return {string} a markdown representatin of the property
 */
function propToMermaid(prop) {
  if (Array.isArray(prop.value)) {
    return prop.value
      .map((item) => {
        const scopedItem = {
          name: `${prop.name}.${item.name}`,
          value: item.value,
        };
        return propToMermaid(scopedItem);
      })
      .join("");
  } else {
    return `<li>${prop.name}=${prop.value}</li>`;
  }
}

/**
 * Converts a print node to a mermaid styled block of markdown
 * @param {PrintNode} node
 * @return {string} a markdown representation of the node
 */
function nodeToMermaid(node) {
  const fields = node.schema.children
    .map((field) => `<li>${field.type} ${field.name}</li>`)
    .join("");
  const props = node.props.map(propToMermaid).join("");
  let selfValue = `${node.id}["${node.type.toUpperCase()}<br/>`;
  selfValue += `Output Schema<br/><ul>${fields}</ul><br/>`;
  selfValue += `Properties<br/><ul>${props}</ul>"]`;
  let combinedValue = "";
  for (const input of node.inputs) {
    const inputValue = nodeToMermaid(input);
    combinedValue += inputValue + "\n\n";
  }
  combinedValue += selfValue + "\n";
  for (const input of node.inputs) {
    combinedValue += `${input.id} --> ${node.id}\n`;
  }
  return combinedValue;
}

module.exports = {
  substraitToMermaid: function (plan) {
    let mermaid = "graph TB\n";
    const printNode = new SubstraitParser(plan).planToNode(plan);
    for (const node of printNode.inputs) {
      const markdown = indentify(nodeToMermaid(node));
      mermaid += markdown;
    }
    return mermaid;
  },
};
