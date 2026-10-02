import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const hasKorean = (s) => /[가-힣]/.test(s);
const normalize = (s) => s.replace(/\s+/g, ' ').trim();
const messages = new Set();
function collect(text) {
  const value = normalize(text);
  if (hasKorean(value)) messages.add(value);
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'i18n') walk(file);
    } else if (/\.tsx?$/.test(file)) {
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      function visit(node) {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) collect(node.text);
        if (ts.isIdentifier(node) && ts.isPropertyAssignment(node.parent) && node.parent.name === node) collect(node.text);
        if (ts.isTemplateExpression(node)) {
          collect(node.head.text + node.templateSpans.map((span, i) => `{${i}}${span.literal.text}`).join(''));
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
}
walk('app');
// Shared form descriptors and server validation are displayed by the client.
walk('functions/src');
walk('server');
fs.mkdirSync('app/i18n', { recursive: true });
const result = [...messages].sort();
fs.writeFileSync('app/i18n/source-messages.json', JSON.stringify(result, null, 2) + '\n');
console.log(`${result.length} source messages extracted`);
