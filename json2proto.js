const fs = require("fs");
const process = require("process");

const { substrait } = require("substrait");

const stdin_contents = fs.readFileSync(0, "utf-8");
const parsed_stdin = JSON.parse(stdin_contents);

plan_obj = substrait.Plan.fromObject(parsed_stdin);
process.stdout.write(substrait.Plan.encode(plan_obj).finish());
