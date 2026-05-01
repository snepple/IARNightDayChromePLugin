/**
 * Shared utility functions for IamResponding Auto Theme extension.
 */

/**
 * Wait for a DOM element to be present.
 * @param {string} selector - CSS selector of the element.
 * @param {number} maxTries - Maximum number of times to check (default 40, which is 20 seconds at 500ms intervals).
 * @returns {Promise<Element>}
 */
export function waitForElement(selector, maxTries = 40) {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const interval = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(interval);
        resolve(el);
      } else {
        tries++;
        if (tries >= maxTries) {
          clearInterval(interval);
          reject(new Error(`Element not found: ${selector}`));
        }
      }
    }, 500);
  });
}

/**
 * Simple sleep function using Promises.
 * @param {number} ms - Milliseconds to sleep.
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const ALGO = 'AES-GCM';
const PREFIX = 'aes256gcm:';

async function getOrCreateKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['iar_encryption_key'], async (result) => {
      if (result.iar_encryption_key) {
        try {
          const key = await crypto.subtle.importKey(
            'jwk',
            result.iar_encryption_key,
            ALGO,
            true,
            ['encrypt', 'decrypt']
          );
          resolve(key);
        } catch (e) {
          reject(e);
        }
      } else {
        try {
          const key = await crypto.subtle.generateKey(
            { name: ALGO, length: 256 },
            true,
            ['encrypt', 'decrypt']
          );
          const jwk = await crypto.subtle.exportKey('jwk', key);
          chrome.storage.local.set({ iar_encryption_key: jwk }, () => {
            resolve(key);
          });
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}

/**
 * Encrypts a password string.
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function encryptPassword(password) {
  if (!password) return password;
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedPassword = new TextEncoder().encode(password);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    encodedPassword
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  const base64 = btoa(String.fromCharCode(...combined));
  return PREFIX + base64;
}

/**
 * Decrypts a password string.
 * @param {string} encryptedPassword
 * @returns {Promise<string>}
 */
export async function decryptPassword(encryptedPassword) {
  if (!encryptedPassword || !encryptedPassword.startsWith(PREFIX)) {
    return encryptedPassword;
  }

  const base64 = encryptedPassword.slice(PREFIX.length);
  const combined = new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const key = await getOrCreateKey();
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGO, iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error('Decryption failed:', e);
    return null;
  }
}
