const mermaid = require('mermaid');

const {substrait} = require('substrait');
const {substraitToJson} = require('./substrait-to-json');
const { substraitToMermaid } = require('./substrait-to-mermaid');

mermaid.initialize({startOnLoad: true});

window.onload = function() {
  document.getElementById('file-input').addEventListener('input', (e) => {
    const reader = new FileReader();
    reader.onerror = function() {
      console.log('Error');
      console.log(reader.error);
      return;
    };
    reader.onload = function() {
      try {
        const plan = substrait.Plan.decode(new Uint8Array(reader.result));
        const planJson = substraitToJson(plan);
        document.getElementById('plan-json').data = JSON.parse(planJson);

        const mermaidEl = document.getElementById('plan-mermaid');
        const mermaidCb = (svg) => {
          mermaidEl.innerHTML = svg;
        };
        const planMermaid = substraitToMermaid(plan);
        mermaid.render('plan-mermaid-graph', planMermaid, mermaidCb);
      } catch (e) {
        dst = document.getElementById('plan-json');
        dst.data = {error: `Error parsing the plan: ${e}`};
      }
    };
    reader.readAsArrayBuffer(
        document.getElementById('file-input').files[0],
    );
  });
};
