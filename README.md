
# susbtrait-js
Typescript typings for Substrait specifications. Also provides a parser for translating substrait plans.

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
    
## License
[Apache-2.0 license](https://www.apache.org/licenses/LICENSE-2.0)
