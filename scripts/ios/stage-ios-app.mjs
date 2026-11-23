// node scripts/ios/stage-ios-app.mjs <web export folder>
//
// Fills ios-app/build/ (git-ignored) for XcodeGen and xcodebuild:
//   build/web             the prepared web export the app serves from its bundle
//   build/Assets.xcassets the app icon (assets/icon.png, the same art as the site and the
//                         Android app) and the launch color (black, as every site theme is dark)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { prepareIosExport } from './prepare-ios-export.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const info = { author: 'xcode', version: 1 };
const json = value => `${JSON.stringify(value, null, 2)}\n`;

export async function stageIosApp(exportDirectory, buildDirectory = path.join(repo, 'ios-app', 'build')) {
  const prepared = await prepareIosExport(exportDirectory);
  await fs.rm(buildDirectory, { recursive: true, force: true });
  const web = path.join(buildDirectory, 'web');
  await fs.cp(exportDirectory, web, { recursive: true });
  const assets = path.join(buildDirectory, 'Assets.xcassets');
  const icon = path.join(assets, 'AppIcon.appiconset');
  const launch = path.join(assets, 'LaunchBackground.colorset');
  await fs.mkdir(icon, { recursive: true });
  await fs.mkdir(launch, { recursive: true });
  await fs.writeFile(path.join(assets, 'Contents.json'), json({ info }));
  await fs.copyFile(path.join(repo, 'assets', 'icon.png'), path.join(icon, 'icon-1024.png'));
  await fs.writeFile(path.join(icon, 'Contents.json'), json({
    images: [{ filename: 'icon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }], info,
  }));
  await fs.writeFile(path.join(launch, 'Contents.json'), json({
    colors: [{ color: { 'color-space': 'srgb', components: { red: '0.000', green: '0.000', blue: '0.000', alpha: '1.000' } }, idiom: 'universal' }], info,
  }));
  return { ...prepared, web, assets };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const source = process.argv[2];
  if (!source) throw new Error('Usage: node scripts/ios/stage-ios-app.mjs <web export folder> [build folder]');
  console.log(JSON.stringify(await stageIosApp(path.resolve(source), process.argv[3] && path.resolve(process.argv[3]))));
}
