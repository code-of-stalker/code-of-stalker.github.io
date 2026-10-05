const fs = require('node:fs');
const path = require('node:path');

const packageRoot = path.resolve(__dirname, '../node_modules/@unomed/react-native-matrix-sdk');
const metadata = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
if (metadata.version !== '0.10.2') {
  throw new Error(`Expected Matrix SDK 0.10.2, found ${metadata.version}`);
}

// Upstream's downloader exits successfully even on download failure.
// Fail installation/build early if the Android artifacts are absent or invalid.
for (const [abi, elfClass, machine] of [['arm64-v8a', 2, 183], ['armeabi-v7a', 1, 40]]) {
  const filename = path.join(packageRoot, 'android/src/main/jniLibs', abi, 'libmatrix_sdk_ffi.so');
  const descriptor = fs.openSync(filename, 'r');
  const header = Buffer.alloc(20);
  try {
    fs.readSync(descriptor, header, 0, header.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }
  if (header.subarray(0, 4).toString('hex') !== '7f454c46' || header[4] !== elfClass || header[5] !== 1 || header.readUInt16LE(18) !== machine) {
    throw new Error(`Invalid Android ELF binary: ${filename}`);
  }
  console.log(`Matrix SDK ${metadata.version}: ${abi} ELF present (${fs.statSync(filename).size} bytes)`);
}
