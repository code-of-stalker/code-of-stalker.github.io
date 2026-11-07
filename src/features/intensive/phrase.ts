import { entropyToMnemonic, generateMnemonic, mnemonicToEntropy, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import type { Bytes } from './crypto';

/** 12 standard BIP-39 words (128 bits), as in crypto wallets. */
export function newPhrase(): { words: string[]; entropy: Bytes } {
  const mnemonic = generateMnemonic(wordlist, 128);
  return { words: mnemonic.split(' '), entropy: new Uint8Array(mnemonicToEntropy(mnemonic, wordlist)) };
}

export const phraseWords = (entropy: Bytes) => entropyToMnemonic(entropy, wordlist).split(' ');

/** The same secret as one line: 32 hex digits in groups of four. */
export function phraseKey(entropy: Bytes): string {
  const hex = Array.from(entropy, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return hex.match(/.{4}/g)!.join('-');
}

/** Accepts the 12 words (any spacing or case) or the key line. */
export function parseSecret(input: string): Bytes | null {
  const words = input.toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 12) {
    const mnemonic = words.join(' ');
    return validateMnemonic(mnemonic, wordlist) ? new Uint8Array(mnemonicToEntropy(mnemonic, wordlist)) : null;
  }
  const hex = input.replace(/[\s-]/g, '');
  if (/^[0-9a-fA-F]{32}$/.test(hex)) return new Uint8Array(hex.match(/../g)!.map(pair => parseInt(pair, 16)));
  return null;
}

/** Positions (0-based) the person types back to prove the words were written down. */
export function confirmationPositions(): number[] {
  const picks = new Set<number>();
  const random = new Uint32Array(1);
  while (picks.size < 3) {
    globalThis.crypto.getRandomValues(random);
    picks.add(random[0] % 12);
  }
  return [...picks].sort((a, b) => a - b);
}

export const isPhraseWord = (word: string) => wordlist.includes(word.trim().toLowerCase());
