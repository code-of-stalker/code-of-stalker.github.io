// Output adapter only: Rust supplies every rendered frame. This module encodes
// the canvas with WebCodecs and packages one AVC video track into an MP4.
export const VIDEO = Object.freeze({ width: 1536, height: 1024, fps: 60, seconds: 24, frames: 1440 });
const MAX_BYTES = 60 * 1024 * 1024;
const text = value => new TextEncoder().encode(value);
const zeros = length => new Uint8Array(length);
const concat = (...parts) => {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
};
const u32 = value => { const result = zeros(4); new DataView(result.buffer).setUint32(0, value); return result; };
const u16 = value => { const result = zeros(2); new DataView(result.buffer).setUint16(0, value); return result; };
const box = (type, ...parts) => { const body = concat(...parts); return concat(u32(body.length + 8), text(type), body); };
const full = (type, flags, ...parts) => box(type, u32(flags), ...parts);
const matrix = concat(u32(65536), u32(0), u32(0), u32(0), u32(65536), u32(0), u32(0), u32(0), u32(1073741824));

export function muxAvc(samples, avcc, width = VIDEO.width, height = VIDEO.height, fps = VIDEO.fps) {
  if (!samples.length || !avcc?.length) throw new Error('Видео не содержит готовых кадров.');
  if (!samples[0].key || samples.some((sample, i) => i && sample.timestamp <= samples[i - 1].timestamp)) throw new Error('Нарушен порядок кадров видео.');
  const duration = samples.length / fps;
  const ftyp = box('ftyp', text('isom'), u32(512), text('isomiso2avc1mp41'));
  const movie = offset => {
    const mvhd = full('mvhd', 0, zeros(8), u32(1000), u32(Math.round(duration * 1000)), u32(65536), u16(256), zeros(10), matrix, zeros(24), u32(2));
    const tkhd = full('tkhd', 7, zeros(8), u32(1), zeros(4), u32(Math.round(duration * 1000)), zeros(8), zeros(8), matrix, u32(width * 65536), u32(height * 65536));
    const mdhd = full('mdhd', 0, zeros(8), u32(fps * 1000), u32(samples.length * 1000), u16(0x55c4), zeros(2));
    const hdlr = full('hdlr', 0, zeros(4), text('vide'), zeros(12), text('Rust theatre illustration\0'));
    const compressor = zeros(32), name = text('Marionette'); compressor[0] = name.length; compressor.set(name, 1);
    const avc1 = box('avc1', zeros(6), u16(1), zeros(16), u16(width), u16(height), u32(0x00480000), u32(0x00480000), zeros(4), u16(1), compressor, u16(24), u16(65535), box('avcC', avcc));
    const stsd = full('stsd', 0, u32(1), avc1);
    const stts = full('stts', 0, u32(1), u32(samples.length), u32(1000));
    const stsc = full('stsc', 0, u32(1), u32(1), u32(samples.length), u32(1));
    const stsz = full('stsz', 0, u32(0), u32(samples.length), ...samples.map(sample => u32(sample.data.length)));
    const stco = full('stco', 0, u32(1), u32(offset));
    const keys = samples.flatMap((sample, i) => sample.key ? [u32(i + 1)] : []);
    const stss = full('stss', 0, u32(keys.length), ...keys);
    const stbl = box('stbl', stsd, stts, stsc, stsz, stco, stss);
    const dinf = box('dinf', full('dref', 0, u32(1), full('url ', 1)));
    const minf = box('minf', full('vmhd', 1, zeros(8)), dinf, stbl);
    return box('moov', mvhd, box('trak', tkhd, box('mdia', mdhd, hdlr, minf)));
  };
  const moov = movie(ftyp.length + movie(0).length + 8);
  return concat(ftyp, moov, box('mdat', ...samples.map(sample => sample.data)));
}

export async function exportVideo(renderer, canvas, progress) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') throw new Error('Этот браузер не поддерживает сохранение видео. Открой просмотр в актуальном Chrome или Edge.');
  const config = { codec: 'avc1.420034', width: VIDEO.width, height: VIDEO.height, bitrate: 14000000, framerate: VIDEO.fps, latencyMode: 'realtime', avc: { format: 'avc' } };
  if (!(await VideoEncoder.isConfigSupported(config)).supported) throw new Error('Браузер не поддерживает запись этого видео в H.264.');
  const samples = []; let avcc, failure, totalBytes = 0;
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data); totalBytes += data.length;
      samples.push({ data, key: chunk.type === 'key', timestamp: chunk.timestamp });
      if (metadata.decoderConfig?.description) avcc = new Uint8Array(metadata.decoderConfig.description).slice();
      if (totalBytes > MAX_BYTES - 100000) failure = new Error('Размер видео превысил допустимый объём.');
    },
    error: error => { failure = error; },
  });
  try {
    encoder.configure(config);
    for (let i = 0; i < VIDEO.frames; i++) {
      renderer.seek(i / VIDEO.fps);
      const timestamp = Math.round(i * 1000000 / VIDEO.fps);
      const frame = new VideoFrame(canvas, { timestamp, duration: Math.round((i + 1) * 1000000 / VIDEO.fps) - timestamp });
      try { encoder.encode(frame, { keyFrame: i % (VIDEO.fps * 2) === 0 }); } finally { frame.close(); }
      if (encoder.encodeQueueSize > 6) await encoder.flush();
      if (failure) throw failure;
      if ((i + 1) % 15 === 0 || i === VIDEO.frames - 1) {
        progress(i + 1, VIDEO.frames);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    await encoder.flush();
    if (failure) throw failure;
    if (samples.length !== VIDEO.frames) throw new Error('Не все кадры удалось сохранить.');
    const bytes = muxAvc(samples, avcc);
    if (bytes.length > MAX_BYTES) throw new Error('Размер видео превысил допустимый объём.');
    const response = await fetch('/export', { method: 'POST', headers: { 'Content-Type': 'video/mp4' }, body: bytes });
    if (!response.ok) throw new Error(`Не удалось сохранить файл (${response.status}).`);
    return await response.json();
  } finally { if (encoder.state !== 'closed') encoder.close(); }
}
