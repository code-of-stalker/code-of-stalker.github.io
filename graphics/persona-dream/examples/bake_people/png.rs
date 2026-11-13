//! A plain PNG writer (stored deflate blocks): the bake's pictures are
//! intermediate files, re-encoded by tools/prepare-assets.mjs.
use std::io::Write;

fn crc32(data: &[u8], mut crc: u32) -> u32 {
    for &b in data {
        crc ^= b as u32;
        for _ in 0..8 {
            crc = if crc & 1 != 0 {
                0xEDB8_8320 ^ (crc >> 1)
            } else {
                crc >> 1
            };
        }
    }
    crc
}

fn chunk(out: &mut Vec<u8>, kind: &[u8; 4], data: &[u8]) {
    out.extend_from_slice(&(data.len() as u32).to_be_bytes());
    out.extend_from_slice(kind);
    out.extend_from_slice(data);
    let crc = crc32(data, crc32(kind, 0xFFFF_FFFF)) ^ 0xFFFF_FFFF;
    out.extend_from_slice(&crc.to_be_bytes());
}

/// Writes 8-bit pixels with `channels` 1 (grey), 3 (RGB) or 4 (RGBA).
pub fn write(path: &std::path::Path, w: usize, h: usize, channels: usize, px: &[u8]) {
    let kind = match channels {
        1 => 0u8,
        3 => 2,
        _ => 6,
    };
    let mut raw = Vec::with_capacity((w * channels + 1) * h);
    for row in px.chunks(w * channels) {
        raw.push(0);
        raw.extend_from_slice(row);
    }
    let mut z = vec![0x78, 0x01];
    let blocks: Vec<&[u8]> = raw.chunks(65535).collect();
    for (n, b) in blocks.iter().enumerate() {
        z.push(u8::from(n + 1 == blocks.len()));
        z.extend_from_slice(&(b.len() as u16).to_le_bytes());
        z.extend_from_slice(&(!(b.len() as u16)).to_le_bytes());
        z.extend_from_slice(b);
    }
    let (mut a, mut b) = (1u32, 0u32);
    for &v in &raw {
        a = (a + v as u32) % 65521;
        b = (b + a) % 65521;
    }
    z.extend_from_slice(&((b << 16) | a).to_be_bytes());
    let mut out = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
    let mut ihdr = Vec::new();
    ihdr.extend_from_slice(&(w as u32).to_be_bytes());
    ihdr.extend_from_slice(&(h as u32).to_be_bytes());
    ihdr.extend_from_slice(&[8, kind, 0, 0, 0]);
    chunk(&mut out, b"IHDR", &ihdr);
    chunk(&mut out, b"IDAT", &z);
    chunk(&mut out, b"IEND", &[]);
    std::fs::File::create(path)
        .and_then(|mut f| f.write_all(&out))
        .unwrap_or_else(|e| panic!("{}: {e}", path.display()));
}

pub fn byte(v: f32) -> u8 {
    (v.clamp(0.0, 1.0) * 255.0).round() as u8
}
