// Build the Android app (APK to install, AAB for Google Play) from this checkout.
//
//   npm run build:android            export + build; signs with Art's release key if it exists
//                                    (asks for its password; nothing is stored)
//   npm run build:android -- --test  device checks: signed with the SDK debug key, page inspectable
//   npm run sign:android             sign the last build again (e.g. after creating the key)
//
// Tools live outside the repo, in %USERPROFILE%\Android (override: WATCHER_ANDROID_HOME):
//   jdk-17*\  sdk\  gradle-home\  build\  keys\code-of-stalker-release.jks
// Environment variables are set for the child processes only; Windows settings are untouched.
// Results go to output/android/ (git-ignored).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareAppExport } from './prepare-app-export.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = new Set(process.argv.slice(2));
const test = args.has('--test'), signOnly = args.has('--sign-only'), unsigned = args.has('--unsigned');
const windows = process.platform === 'win32';
const tools = path.resolve(process.env.WATCHER_ANDROID_HOME || path.join(os.homedir(), 'Android'));
const sdk = path.join(tools, 'sdk');
const work = path.join(tools, 'build', 'code-of-stalker');
const keystore = process.env.WATCHER_ANDROID_KEYSTORE || path.join(tools, 'keys', 'code-of-stalker-release.jks');
const keyAlias = process.env.WATCHER_ANDROID_KEY_ALIAS || 'code-of-stalker';
const exportDir = path.join(repo, '.expo-android-export');
const outDir = path.join(repo, 'output', 'android');
const siteUrl = 'https://code-of-stalker.github.io';

function fail(message) { console.error(`\n${message}`); process.exit(1); }
function newest(directory, pattern) {
  if (!fs.existsSync(directory)) return null;
  const found = fs.readdirSync(directory).filter(name => pattern.test(name)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return found.length ? path.join(directory, found.at(-1)) : null;
}
const jdk = newest(tools, /^jdk-?17/i);
if (!jdk || !fs.existsSync(path.join(jdk, 'bin', windows ? 'java.exe' : 'java'))) fail(`JDK 17 not found in ${tools} (expected a jdk-17* folder).`);
if (!fs.existsSync(path.join(sdk, 'platforms'))) fail(`Android SDK not found in ${sdk}.`);
const buildTools = newest(path.join(sdk, 'build-tools'), /^\d/);
if (!buildTools) fail(`No build-tools in ${sdk}.`);

const env = {
  ...process.env,
  JAVA_HOME: jdk,
  ANDROID_HOME: sdk,
  ANDROID_SDK_ROOT: sdk,
  GRADLE_USER_HOME: path.join(tools, 'gradle-home'),
  PATH: [path.join(jdk, 'bin'), path.join(sdk, 'platform-tools'), process.env.PATH].join(path.delimiter),
};
function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', env, shell: windows && /\.(bat|cmd)$/i.test(command), ...options });
  if (result.status !== 0) fail(`Failed: ${path.basename(command)} ${commandArgs.filter(a => !/pass/i.test(a)).join(' ')}`);
  return result;
}
const git = (...gitArgs) => spawnSync('git', gitArgs, { cwd: repo, encoding: 'utf8' }).stdout.trim();
const size = file => `${(fs.statSync(file).size / 1048576).toFixed(1)} MB`;

// Version: versionCode grows with every commit on main; versionName names the site release.
const commit = git('rev-parse', '--short=7', 'HEAD');
const versionCode = Number(git('rev-list', '--count', 'HEAD'));
const dirty = git('status', '--porcelain', '--untracked-files=no') !== '';
// Test builds (debug key, inspectable page) keep their own Gradle outputs and stamp, so
// `npm run sign:android` always signs the last release build, never a test one.
const buildRoot = path.join(work, test ? 'out-test' : 'out');
const stamp = path.join(work, test ? 'last-test-build.json' : 'last-build.json');
// Signing alone names the files after the build it signs, not after the current checkout.
const versionName = signOnly && fs.existsSync(stamp) ? JSON.parse(fs.readFileSync(stamp, 'utf8')).versionName
  : `${git('show', '-s', '--format=%cs', 'HEAD').replace(/-/g, '.')}-${commit}${dirty ? '-local' : ''}`;
const base = `code-of-stalker-${versionName}`;
const gradleOut = path.join(buildRoot, 'app', 'outputs');
const builtApk = () => [path.join(gradleOut, 'apk', 'release', 'app-release.apk'), path.join(gradleOut, 'apk', 'release', 'app-release-unsigned.apk')].find(f => fs.existsSync(f));
const builtAab = path.join(gradleOut, 'bundle', 'release', 'app-release.aab');

// Test builds use the SDK's standard debug key (public password "android"); Gradle only
// creates it during a debug build, so make it here the same way.
const debugKeystore = path.join(os.homedir(), '.android', 'debug.keystore');
if (test && !signOnly && !fs.existsSync(debugKeystore)) {
  fs.mkdirSync(path.dirname(debugKeystore), { recursive: true });
  run(path.join(jdk, 'bin', windows ? 'keytool.exe' : 'keytool'), ['-genkeypair', '-keystore', debugKeystore, '-storepass', 'android',
    '-alias', 'androiddebugkey', '-keypass', 'android', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10950',
    '-dname', 'CN=Android Debug,O=Android,C=US']);
}

if (!signOnly) {
  if (!Number.isInteger(versionCode) || versionCode < 1) fail('Cannot read the git commit count for versionCode.');
  console.log(`\nCode Of Stalker for Android ${versionName} (versionCode ${versionCode})${test ? ', test build' : ''}`);
  run(windows ? 'npx.cmd' : 'npx', ['expo', 'export', '--platform', 'web', '--output-dir', '.expo-android-export'], { cwd: repo, env: { ...env, WATCHER_SITE_URL: siteUrl }, shell: windows });
  const prepared = await prepareAppExport(exportDir);
  console.log(`App web export: ${prepared.files} files, ${(prepared.bytes / 1048576).toFixed(1)} MB`);
  const assets = path.join(work, 'assets');
  fs.rmSync(assets, { recursive: true, force: true });
  fs.cpSync(exportDir, path.join(assets, 'www'), { recursive: true });
  fs.rmSync(buildRoot, { recursive: true, force: true });
  const gradle = path.join(repo, 'android-app', windows ? 'gradlew.bat' : 'gradlew');
  run(gradle, [
    '--no-daemon', '--project-cache-dir', path.join(work, 'gradle-project'),
    `-PwatcherBuildRoot=${buildRoot}`, `-PwatcherAssets=${assets}`,
    `-PversionCode=${versionCode}`, `-PversionName=${versionName}`,
    ...(test ? ['-PwatcherTestSigning=true', '-PwatcherWebDebug=true'] : []),
    ':app:assembleRelease', ...(test ? [] : [':app:bundleRelease']),
  ], { cwd: path.join(repo, 'android-app') });
  // The page must be inside the APK: the shell, Expo's `_expo` bundle and the scenes.
  const listing = spawnSync(path.join(jdk, 'bin', windows ? 'jar.exe' : 'jar'), ['tf', builtApk()], { encoding: 'utf8', maxBuffer: 64 << 20 }).stdout;
  for (const needed of ['assets/www/index.html', 'assets/www/_expo/static/js/web/', 'assets/www/graphics/']) {
    if (!listing.includes(needed)) fail(`The APK is missing ${needed}`);
  }
  fs.writeFileSync(stamp, JSON.stringify({ versionName, versionCode, test }) + '\n');
}

fs.mkdirSync(outDir, { recursive: true });
const apk = builtApk();
if (!apk) fail('No release APK found; run npm run build:android first.');
// A release output left by an older script version could still be a test build.
if (!test && fs.existsSync(stamp) && JSON.parse(fs.readFileSync(stamp, 'utf8')).test) fail('The last build is a test build; run npm run build:android first.');
if (test) {
  const target = path.join(outDir, `${base}-test.apk`);
  fs.copyFileSync(apk, target);
  console.log(`\nTest APK (debug key; uninstall it before installing the release APK): ${target} (${size(target)})`);
  process.exit(0);
}

// Art's release key: the same key must sign every future version, or Android refuses
// the update (and a reinstall would lose the diary). It never enters the repository.
const unsignedApk = path.join(outDir, `${base}-unsigned.apk`);
fs.copyFileSync(apk, unsignedApk);
if (fs.existsSync(builtAab)) fs.copyFileSync(builtAab, path.join(outDir, `${base}-unsigned.aab`));
if (unsigned || !fs.existsSync(keystore) || !process.stdin.isTTY) {
  console.log(`\nUnsigned APK: ${unsignedApk} (${size(unsignedApk)})`);
  if (!fs.existsSync(keystore)) {
    // keytool does not create the folder, so it comes first.
    const keytool = path.join(jdk, 'bin', windows ? 'keytool.exe' : 'keytool');
    const keyArgs = `-genkeypair -v -keystore "${keystore}" -alias ${keyAlias} -keyalg RSA -keysize 4096 -validity 36500`;
    console.log(`No release key at ${keystore}. Create it once, keep a copy of the file and its password, then run \`npm run sign:android\`:`);
    console.log(windows ? `  New-Item -ItemType Directory -Force "${path.dirname(keystore)}"` : `  mkdir -p "${path.dirname(keystore)}"`);
    console.log(windows ? `  & "${keytool}" ${keyArgs}` : `  "${keytool}" ${keyArgs}`);
  }
  else if (!unsigned) console.log('Signing needs the key password: run `npm run sign:android` in a terminal.');
  process.exit(0);
}

async function askHidden(question) {
  process.stdout.write(question);
  const stdin = process.stdin;
  stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let text = '';
    const onData = chunk => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') { done(); resolve(text); return; }
        if (ch === '\u0003') { done(); reject(new Error('cancelled')); return; }
        if (ch === '\u007f' || ch === '\b') text = text.slice(0, -1); else text += ch;
      }
    };
    const done = () => { stdin.off('data', onData); stdin.setRawMode(false); stdin.pause(); process.stdout.write('\n'); };
    stdin.on('data', onData);
  });
}
const password = await askHidden(`Пароль ключа ${path.basename(keystore)}: `).catch(() => fail('Cancelled.'));
const signEnv = { ...env, WATCHER_KEY_PASSWORD: password };
const alignedApk = path.join(work, 'aligned.apk');
const signedApk = path.join(outDir, `${base}.apk`);
run(path.join(buildTools, windows ? 'zipalign.exe' : 'zipalign'), ['-f', '-p', '4', apk, alignedApk]);
run(path.join(buildTools, windows ? 'apksigner.bat' : 'apksigner'), ['sign', '--ks', keystore, '--ks-key-alias', keyAlias,
  '--ks-pass', 'env:WATCHER_KEY_PASSWORD', '--key-pass', 'env:WATCHER_KEY_PASSWORD', '--out', signedApk, alignedApk], { env: signEnv });
run(path.join(buildTools, windows ? 'apksigner.bat' : 'apksigner'), ['verify', '--min-sdk-version', '26', signedApk]);
fs.rmSync(alignedApk, { force: true });
fs.rmSync(unsignedApk, { force: true });
console.log(`\nAPK for the phone: ${signedApk} (${size(signedApk)})`);
if (fs.existsSync(builtAab)) {
  const signedAab = path.join(outDir, `${base}.aab`);
  fs.copyFileSync(builtAab, signedAab);
  run(path.join(jdk, 'bin', windows ? 'jarsigner.exe' : 'jarsigner'), ['-keystore', keystore, '-storepass:env', 'WATCHER_KEY_PASSWORD',
    '-keypass:env', 'WATCHER_KEY_PASSWORD', '-sigalg', 'SHA256withRSA', '-digestalg', 'SHA-256', signedAab, keyAlias], { env: signEnv });
  fs.rmSync(path.join(outDir, `${base}-unsigned.aab`), { force: true });
  console.log(`AAB for Google Play: ${signedAab} (${size(signedAab)})`);
}
