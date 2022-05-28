const { substrait } = require('substrait');

const { substraitToJson } = require('./substrait-to-json');

function parseSubstrait() {

}

class SubstraitPlanElement extends HTMLElement {

    constructor() {
        super();
        this.substraitPlan = null;
        if (this.hasAttribute('href')) {
            const hrefAnchor = this.getAttribute('href');
            fetch(hrefAnchor).then((contents) => {
                return contents.arrayBuffer();
            }).then((contentsBuffer) => {
                console.log('Fetched Substrait plan: ');
                console.log(contentsBuffer);
                this.plan = substrait.Plan.decode(new Uint8Array(contentsBuffer));
            }).catch((err) => {
                console.log('Could not fetch Substrait plan');
                console.log(err);
            });
        }
    }

    update() {
        if (this.substraitPlan) {
            const planJson = substraitToJson(this.substraitPlan);
            this.textContent = planJson;
        }
    }

    set plan(value) {
        console.log('Plan updated to: ' + value);
        this.substraitPlan = value;
        this.update();
    }
}

// Define the new element
customElements.define('substrait-plan', SubstraitPlanElement);
