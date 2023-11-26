
# susbtrait-js
Typescript typings for Substrait specifications. Also provides a parser for translating substrait plans and a CLI tool to visualize substrait plans.

Substrait is cross-language specification for data compute operations, composed primarily of:
1. a formal specification
2. a human readable text representation
3. a compact cross-language binary representation  

For more details, please visit [substrait.io](https://substrait.io/)  
Link to the substrait specifications repository: [github.com/substrait-io/substrait](https://github.com/substrait-io/substrait)

## Development setup

Clone the github repository

```
git clone https://github.com/substrait-io/substrait-js.git
cd substrait-js/
git submodule update --init --recursive
```

Installation includes the following steps:
 1. Transpiling the `.ts` files
 2. Downloading the substrait specification
 3. Packaging the specifications to static `.js` module.

```
npm ci
npm run build
```

## Visualization
substrait-JS provides a CLI tool for exporting graph visualization of substrait JSON and binary plans. The tool currently uses the `--experimental-specifier-resolution` flag for module resolution. The  visualization functions are the required helper methods for the [substrait-fiddle](https://github.com/voltrondata/substrait-fiddle) tool.

The tool uses [viz-js](https://github.com/mdaines/viz-js) for rendering plots on JSDOM using [Graphviz](https://graphviz.org/)'s DOT language.

Plot generation includes the following steps:
```
// The tool currently requires NodeJS version 18.0.0 for operation
source ~/.nvm/nvm.sh
nvm use 18.0.0

substrait  -p ../plan.json -o <output path>
```
    
## License
[Apache-2.0 license](https://www.apache.org/licenses/LICENSE-2.0)
