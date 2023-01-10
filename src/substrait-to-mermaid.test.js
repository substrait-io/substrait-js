"use strict";

const fs = require("fs");
const path = require("path");

const { substrait } = require("substrait");

const s2m = require("./substrait-to-mermaid");

const testdataPath = path.join(__dirname, "../testdata");
const tpchPath = path.join(testdataPath, "./tpch");

test("tpch queries do not throw error", () => {
  const testFiles = fs.readdirSync(tpchPath);

  for (const testFile of testFiles) {
    if (testFile.endsWith(".bin")) {
      const queryBytes = fs.readFileSync(path.join(tpchPath, testFile));
      const querySubstrait = substrait.Plan.decode(queryBytes);
      const queryMermaid = s2m.substraitToMermaid(querySubstrait);
      console.log(`Converted the query ${testFile} to mermaid`);
      expect(queryMermaid.length).toBeGreaterThan(0);
      console.log(queryMermaid);
    }
  }
});
