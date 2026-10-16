import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import metroResolver from 'metro-resolver';
import { assetExts, sourceExts } from 'metro-config/private/defaults/defaults';
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
  assert.ok(source, 'Every JavaScript/TypeScript import must be parsed, including sources outside src/.');
  const names = new Set();
  for (const node of source.statements) {
    if (ts.isExportAssignment(node)) names.add('default');
    if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) if (!element.isTypeOnly) names.add(element.name.text);
    }
    if (!node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (node.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)) names.add('default');
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node)) && node.name) names.add(node.name.text);
    if (ts.isModuleDeclaration(node) && ts.isIdentifier(node.name) && ts.isModuleBlock(node.body) &&
      node.body.statements.some(member => ts.isVariableStatement(member) || ts.isFunctionDeclaration(member) || ts.isClassDeclaration(member) || ts.isEnumDeclaration(member))) names.add(node.name.text);
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
    }
  }
  return names;
}

function sourceExports(destination) {
  if (path.extname(destination) === '.json') {
    // Metro emits JSON as module.exports = <parsed value>. The default import
    // is the whole value; named imports can access its own top-level keys.
    const value = JSON.parse(readFileSync(destination, 'utf8'));
    return new Set(['default', ...(value && typeof value === 'object' ? Object.keys(value) : [])]);
  }
  assert.match(destination, /\.[cm]?[jt]sx?$/, `Unsupported source module: ${destination}`);
  if (!parsed.has(destination)) parsed.set(destination, ts.createSourceFile(destination, readFileSync(destination, 'utf8'), ts.ScriptTarget.Latest, true));
  return runtimeExports(parsed.get(destination));
}

function resolveAsset(directory, name, extension) {
  const files = readdirSync(directory).filter(file => path.extname(file) === extension &&
    path.basename(file, extension).replace(/@\d+(?:\.\d+)?x$/, '') === name)
    .map(file => path.join(directory, file));
  return files.length ? files : null;
}

function selectedForPlatform(file, platform) {
  const extension = path.extname(file), stem = file.slice(0, -extension.length);
  const qualifier = stem.match(/\.(web|native|android|ios)$/)?.[1];
  if (qualifier === 'web') return platform === 'web';
  if (qualifier === 'android' || qualifier === 'ios') return qualifier === platform;
  if (qualifier === 'native') return platform !== 'web' && !lookup(`${stem.slice(0, -7)}.${platform}${extension}`).exists;
  const preferred = platform === 'web' ? ['web'] : [platform, 'native'];
  return !preferred.some(suffix => lookup(`${stem}.${suffix}${extension}`).exists);
}

// TypeScript and the adapter's Node loader do not prefer .native.ts. A bundle
// can compile even when that preference hides the requested named exports.
// Use the installed Metro resolver against real files, without loading JSI.
for (const platform of ['android', 'ios', 'web']) test(`relative runtime imports expose their requested values on ${platform}`, () => {
  const failures = [];
  for (const [file, source] of parsed) {
    if (!selectedForPlatform(file, platform)) continue;
    for (const node of source.statements) {
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
      sourceExts, assetExts: new Set(assetExts), resolveAsset,
      fileSystemLookup: lookup, doesFileExist: candidate => lookup(candidate).type === 'f',
      getPackageForModule: () => null, mainFields: ['react-native', 'browser', 'main'],
      redirectModulePath: candidate => candidate,
    }, node.moduleSpecifier.text, platform);
    if (resolved.type === 'assetFiles') {
      assert.ok(resolved.filePaths.length, 'An asset import must resolve to a real file.');
      // Metro's asset registry returns one value. Do not pretend that an asset
      // has arbitrary named exports, or skip requested-import checking.
      for (const name of names) if (name !== 'default') failures.push(`${file} -> ${node.moduleSpecifier.text}: asset has no named export ${name}`);
      continue;
    }
    assert.equal(resolved.type, 'sourceFile');
    const destination = path.normalize(resolved.filePath);
    const label = `${path.relative(sourceRoot, file)} -> ${path.relative(sourceRoot, destination)}`;
    if (destination === file) failures.push(`${label}: resolves to itself`);
    const exports = sourceExports(destination);
    for (const name of names) if (!exports.has(name)) failures.push(`${label}: missing runtime export ${name}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('JSON defaults and real source exports remain distinct', () => {
  const exports = sourceExports(fileURLToPath(new URL('../assets/product/motion/laboratory-architecture.json', import.meta.url)));
  assert.equal(exports.has('default'), true);
  assert.equal(exports.has('settings'), true);
  assert.equal(exports.has('notAnExport'), false);
  const actual = runtimeExports(ts.createSourceFile('adapter.ts', 'export type Hidden = string; export const visible = 1;', ts.ScriptTarget.Latest, true));
  assert.equal(actual.has('visible'), true);
  assert.equal(actual.has('Hidden'), false);
  assert.equal(actual.has('default'), false);
});
