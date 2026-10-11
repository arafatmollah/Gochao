import * as Crypto from 'expo-crypto';

/** Cryptographically strong random v4 UUID for stable record identifiers. */
export function newId(): string {
  return Crypto.randomUUID();
}
