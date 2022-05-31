const fs = require('fs');
const path = require('path');

const {substrait} = require('substrait');

const {substraitToJson} = require('./substrait-to-json');

testdataPath = path.join(__dirname, '../testdata');
tpchPath = path.join(testdataPath, './tpch');

test('tpch queries round trip', () => {
  testFiles = fs.readdirSync(tpchPath);

  queries = new Set();
  for (const testFile of testFiles) {
    if (testFile.endsWith('.json')) {
      queries.add(path.basename(testFile, '.json'));
    }
  }

  expect(queries.size).toBeGreaterThan(0);

  for (const query of queries) {
    jsonPath = path.join(tpchPath, `${query}.json`);
    binPath = path.join(tpchPath, `${query}.bin`);
    binContents = fs.readFileSync(binPath);
    querySubstrait = substrait.Plan.decode(binContents);

    expectedJson = fs.readFileSync(jsonPath, 'utf8');
    actualJson = substraitToJson(querySubstrait);
    expect(JSON.parse(actualJson)).toEqual(JSON.parse(expectedJson));
  }
});

