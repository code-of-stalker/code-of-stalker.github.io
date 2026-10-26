// Platform bridge only: load the Rust module and construct the shared field.
import init, { SkeletonField } from './pkg/watcher_skeleton.js';
let ready;
export async function field() {
  ready ??= init().catch(error => { ready = undefined; throw error; });
  await ready;
  return new SkeletonField();
}
