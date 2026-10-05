import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import metroResolver from 'metro-resolver';
import ts from 'typescript';

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
const files = readdirSync(sourceRoot, { recursive: true }).filter(name => /\.tsx?$/.test(name))
  .map(name => path.join(sourceRoot, name));
const parsed = new Map(files.map(file => [file, ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)]));
function lookup(file) {
  try { return { exists: true, type: statSync(file).isDirectory() ? 'd' : 'f', realPath: realpathSync(file) }; }
  catch { return { exists: false }; }
}
function runtimeExports(source) {
  const names = new Set();
  for (const node of source.statements) {
    if (ts.isExportAssignment(node)) names.add('default');
    if (!node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (node.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)) names.add('default');
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node)) && node.name) names.add(node.name.text);
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
    }
  }
  return names;
}

// TypeScript and the adapter's Node loader do not prefer .native.ts. A bundle
// can compile even when that preference hides the requested named exports.
// Use the installed Metro resolver against real files, without loading JSI.
for (const platform of ['android', 'ios', 'web']) test(`relative runtime imports expose their requested values on ${platform}`, () => {
  const failures = [];
  for (const [file, source] of parsed) for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || !node.moduleSpecifier.text.startsWith('.')) continue;
    const clause = node.importClause;
    if (!clause || clause.isTypeOnly) continue;
    const names = clause.name ? ['default'] : [];
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const binding of clause.namedBindings.elements) if (!binding.isTypeOnly) names.push((binding.propertyName ?? binding.name).text);
    }
    if (!names.length) continue;
    const resolved = metroResolver.resolve({
      originModulePath: file, preferNativePlatform: platform !== 'web',
      sourceExts: ['js', 'jsx', 'json', 'ts', 'tsx'], assetExts: new Set(),
      fileSystemLookup: lookup, doesFileExist: candidate => lookup(candidate).type === 'f',
      getPackageForModule: () => null, mainFields: ['react-native', 'browser', 'main'],
      redirectModulePath: candidate => candidate,
    }, node.moduleSpecifier.text, platform);
    assert.equal(resolved.type, 'sourceFile');
    const destination = path.normalize(resolved.filePath);
    const label = `${path.relative(sourceRoot, file)} -> ${path.relative(sourceRoot, destination)}`;
    if (destination === file) failures.push(`${label}: resolves to itself`);
    const exports = runtimeExports(parsed.get(destination));
    for (const name of names) if (!exports.has(name)) failures.push(`${label}: missing runtime export ${name}`);
  }
  assert.deepEqual(failures, []);
});
