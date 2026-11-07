/**
 * Intensive chat cryptography (WebCrypto only).
 *
 * The 12 words carry 16 bytes of entropy. Everything else is derived from it:
 * the sign-in credentials, and the key that wraps the person's ECDH P-256
 * identity key. Chat keys are random AES-256-GCM keys, wrapped for each member
 * with an ephemeral ECDH key (ECIES). A device seals the entropy under a key
 * that needs both the PIN and a pepper the server releases only for the right
 * PIN, so a copy of the browser storage cannot be brute forced offline.
 */
export type Bytes = Uint8Array<ArrayBuffer>;
export type Sealed = { iv: string; data: string };

const encoder = new TextEncoder(), decoder = new TextDecoder();
const SALT = encoder.encode('code-of-stalker/intensive/v1');
export const PIN_ITERATIONS = 200_000;

function subtle(): SubtleCrypto {
  const value = globalThis.crypto?.subtle;
  if (!value) throw new Error('Нужен современный браузер и защищённое соединение.');
  return value;
}

export function randomBytes(length: number): Bytes {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

export function toBase64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

export function fromBase64(text: string): Bytes {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const toBase64Url = (bytes: Uint8Array) => toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const toHex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

export async function hkdf(ikm: Bytes, info: string, length = 32): Promise<Bytes> {
  const key = await subtle().importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: encoder.encode(info) }, key, length * 8);
  return new Uint8Array(bits);
}

const aesKey = (raw: Bytes, usages: KeyUsage[]) => subtle().importKey('raw', raw, { name: 'AES-GCM' }, false, usages);

export async function seal(key: CryptoKey | Bytes, plain: Bytes, context: string): Promise<Sealed> {
  const cryptoKey = key instanceof Uint8Array ? await aesKey(key, ['encrypt']) : key;
  const iv = randomBytes(12);
  const data = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(context) }, cryptoKey, plain);
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(data)) };
}

export async function unseal(key: CryptoKey | Bytes, sealed: Sealed, context: string): Promise<Bytes> {
  const cryptoKey = key instanceof Uint8Array ? await aesKey(key, ['decrypt']) : key;
  const plain = await subtle().decrypt({ name: 'AES-GCM', iv: fromBase64(sealed.iv), additionalData: encoder.encode(context) }, cryptoKey, fromBase64(sealed.data));
  return new Uint8Array(plain);
}

// ------------------------------------------------------------ account

/** Supabase email/password credentials derived from the phrase. No mail is ever sent. */
export async function accountCredentials(entropy: Bytes) {
  const id = toHex(await hkdf(entropy, 'auth-id', 16));
  const password = toBase64Url(await hkdf(entropy, 'auth-password', 32));
  return { email: `walker-${id}@code-of-stalker.github.io`, password };
}

export type Identity = { publicKey: string; privateKey: CryptoKey };

/** A fresh identity key pair; the private half is sealed by the phrase. */
export async function createIdentity(entropy: Bytes): Promise<Identity & { wrapped: Sealed }> {
  const pair = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pkcs8 = new Uint8Array(await subtle().exportKey('pkcs8', pair.privateKey));
  const publicKey = toBase64(new Uint8Array(await subtle().exportKey('raw', pair.publicKey)));
  const wrapped = await seal(await hkdf(entropy, 'identity-wrap'), pkcs8, 'identity');
  const privateKey = await subtle().importKey('pkcs8', pkcs8, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  pkcs8.fill(0);
  return { publicKey, privateKey, wrapped };
}

export async function openIdentity(entropy: Bytes, wrapped: Sealed): Promise<CryptoKey> {
  const pkcs8 = await unseal(await hkdf(entropy, 'identity-wrap'), wrapped, 'identity');
  try { return await subtle().importKey('pkcs8', pkcs8, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']); }
  finally { pkcs8.fill(0); }
}

const importPublic = (raw: string) => subtle().importKey('raw', fromBase64(raw), { name: 'ECDH', namedCurve: 'P-256' }, false, []);

// ------------------------------------------------------------ chat keys

export type ChatKeyContext = { chatId: string; version: number; memberId: string };
export type WrappedChatKey = { ephemeralKey: string; iv: string; wrappedKey: string };
const keyContext = ({ chatId, version, memberId }: ChatKeyContext) => `chat-key|${chatId}|${version}|${memberId}`;

export const newChatKey = () => randomBytes(32);

export async function wrapChatKey(chatKey: Bytes, memberPublicKey: string, context: ChatKeyContext): Promise<WrappedChatKey> {
  const ephemeral = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const shared = new Uint8Array(await subtle().deriveBits({ name: 'ECDH', public: await importPublic(memberPublicKey) }, ephemeral.privateKey, 256));
  const sealed = await seal(await hkdf(shared, keyContext(context)), chatKey, keyContext(context));
  return { ephemeralKey: toBase64(new Uint8Array(await subtle().exportKey('raw', ephemeral.publicKey))), iv: sealed.iv, wrappedKey: sealed.data };
}

export async function unwrapChatKey(row: WrappedChatKey, privateKey: CryptoKey, context: ChatKeyContext): Promise<Bytes> {
  const shared = new Uint8Array(await subtle().deriveBits({ name: 'ECDH', public: await importPublic(row.ephemeralKey) }, privateKey, 256));
  return unseal(await hkdf(shared, keyContext(context)), { iv: row.iv, data: row.wrappedKey }, keyContext(context));
}

export const chatCipher = (chatKey: Bytes) => aesKey(chatKey, ['encrypt', 'decrypt']);

// ------------------------------------------------------------ messages

export async function encryptMessage(key: CryptoKey, chatId: string, text: string): Promise<{ iv: string; body: string }> {
  const sealed = await seal(key, encoder.encode(JSON.stringify({ v: 1, text })), `message|${chatId}`);
  return { iv: sealed.iv, body: sealed.data };
}

export async function decryptMessage(key: CryptoKey, chatId: string, iv: string, body: string): Promise<string> {
  const plain = JSON.parse(decoder.decode(await unseal(key, { iv, data: body }, `message|${chatId}`))) as { text?: unknown };
  if (typeof plain.text !== 'string') throw new Error('Malformed message');
  return plain.text;
}

// ------------------------------------------------------------ PIN

export async function pinSecret(pin: string, salt: Bytes): Promise<Bytes> {
  const key = await subtle().importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PIN_ITERATIONS }, key, 256));
}

/** What the server compares; it cannot be reversed to the PIN without the device's salt. */
export async function pinVerifier(secret: Bytes): Promise<string> {
  return toBase64(await hkdf(secret, 'pin-verifier'));
}

export async function vaultKey(secret: Bytes, pepper: Bytes): Promise<CryptoKey> {
  return aesKey(await hkdf(concat(secret, pepper), 'device-vault'), ['encrypt', 'decrypt']);
}

export const encodeText = (text: string): Bytes => encoder.encode(text);
export const decodeText = (bytes: Uint8Array) => decoder.decode(bytes);
