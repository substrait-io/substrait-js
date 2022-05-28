const fs = require('fs');
const path = require('path');
const { hasUncaughtExceptionCaptureCallback } = require('process');

const { substrait } = require('substrait');

const { substraitToMermaid } = require('./substrait-to-mermaid');

testdataPath = path.join(__dirname, '../testdata');
tpchPath = path.join(testdataPath, './tpch');

test('tpch queries do not throw error', () => {

    testFiles = fs.readdirSync(tpchPath);

    for (let testFile of testFiles) {
        if (testFile.endsWith('.bin')) {
            binContents = fs.readFileSync(path.join(tpchPath, testFile));
            querySubstrait = substrait.Plan.decode(binContents);
            queryMermaid = substraitToMermaid(querySubstrait);
            console.log(`Converted the query ${testFile} to mermaid`);
            expect(queryMermaid.length).toBeGreaterThan(0);
            console.log(queryMermaid);
        }
    }
})

