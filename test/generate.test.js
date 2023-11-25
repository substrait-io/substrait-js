const { execSync } = require('child_process');
const fs = require('fs');

test('CLI generates correct SVG file', () => {

  try {
    const output = execSync(`node --experimental-specifier-resolution=node dist/index.js -p ../plan.json -o .`);

    expect(output.toString()).toContain('SVG file saved successfully');

    const outputSvgContent = fs.readFileSync('plan.svg', 'utf-8');
    const expectedSvgContent = fs.readFileSync('test/expected.svg', 'utf-8');
    expect(outputSvgContent).toEqual(expectedSvgContent);
  
} finally {
    fs.unlinkSync('plan.svg');
  }
});
