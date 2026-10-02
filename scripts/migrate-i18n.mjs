// One-time source migration: translate render output, never submitted values.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (['api', 'i18n'].includes(e.name) ? [] : files(path.join(dir, e.name))) : e.name.endsWith('.tsx') ? [path.join(dir, e.name)] : []); }
const excluded = /(?:layout|native-link|pwa-register|auth-context|report-store|contact-feedback-store)\.tsx$/;
for (const file of files('app').filter(f => !excluded.test(f))) {
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes('useI18n')) continue;
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const scopes = new Map();
  function scopeFor(node) {
    for (let p = node.parent; p; p = p.parent) {
      if (ts.isFunctionDeclaration(p) && p.name && /^[A-Z]/.test(p.name.text)) return p;
    }
    return null;
  }
  function trackUsage(node, name) {
    const scope = scopeFor(node);
    if (!scope) return false;
    if (!scopes.has(scope)) scopes.set(scope, new Set());
    scopes.get(scope).add(name); return true;
  }
  const wrap = (node, name) => { if (trackUsage(node, name)) { edits.push([node.getStart(ast), node.getStart(ast), `${name}(`], [node.end, node.end, ')']); } };
  function visit(node) {
    if (ts.isJsxText(node) && node.text.trim()) {
      const value = node.text.includes('\n') ? node.text.replace(/\s+/g, ' ').trim() : node.text;
      if (/[가-힣]/.test(value) && trackUsage(node, 't')) edits.push([node.pos, node.end, `{t(${JSON.stringify(value)})}`]);
    }
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent) && !ts.isJsxSpreadAttribute(node.parent)) {
      // User-authored content and proper names must remain verbatim.
      const expr = node.expression.getText(ast);
      const verbatim = /^(?:user\??\.(?:displayName|uid)|(?:candidate|firm|contact|place)\.(?:name|firmName|branchName|representativeLawyer|address|phone)|(?:report|item)\.(?:reviewNote|note)|draft\.(?:menu|otherSymptom|pathogenType|restaurantDisplayInput))$/.test(expr);
      if (!verbatim) wrap(node.expression, 'text');
    }
    if (ts.isJsxAttribute(node) && ['aria-label', 'title', 'placeholder', 'alt'].includes(node.name.getText(ast)) && node.initializer) {
      if (ts.isStringLiteral(node.initializer) && /[가-힣]/.test(node.initializer.text) && trackUsage(node, 't')) edits.push([node.initializer.getStart(ast), node.initializer.end, `{t(${JSON.stringify(node.initializer.text)})}`]);
      else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) wrap(node.initializer.expression, 't');
    }
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'option' && !node.openingElement.attributes.properties.some(a => ts.isJsxAttribute(a) && a.name.getText(ast) === 'value')) {
      const children = node.children.filter(c => !ts.isJsxText(c) || c.text.trim());
      if (children.length === 1) {
        const child = children[0];
        const value = ts.isJsxExpression(child) ? child.expression?.getText(ast) : ts.isJsxText(child) ? JSON.stringify(child.text.trim()) : null;
        if (value) edits.push([node.openingElement.tagName.end, node.openingElement.tagName.end, ` value={${value}}`]);
      }
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && /^toLocale(?:DateString|TimeString|String)$/.test(node.expression.name.text) && node.arguments[0]?.getText(ast) === '"ko-KR"' && trackUsage(node, 'locale')) edits.push([node.arguments[0].getStart(ast), node.arguments[0].end, 'locale']);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!scopes.size) continue;
  for (const [scope, names] of scopes) edits.push([scope.body.getStart(ast) + 1, scope.body.getStart(ast) + 1, `\n  const { ${[...names].join(', ')} } = useI18n();`]);
  let result = source;
  for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0] || b[1] - a[1])) result = result.slice(0, start) + replacement + result.slice(end);
  const relative = path.relative(path.dirname(file), 'app/i18n/context').replaceAll('\\', '/');
  const imported = `import { useI18n } from ${JSON.stringify(relative.startsWith('.') ? relative : './' + relative)};\n`;
  if (result.startsWith('"use client";')) result = result.replace('"use client";', '"use client";\n' + imported);
  else result = '"use client";\n' + imported + result;
  fs.writeFileSync(file, result);
  console.log(file);
}
