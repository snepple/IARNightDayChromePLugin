import { encryptPassword, decryptPassword } from './utils.js';
import { jest } from '@jest/globals';

// Mock chrome.storage.local
const mockStorage = {};
global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        const result = {};
        keys.forEach(key => {
          if (mockStorage[key] !== undefined) {
            result[key] = mockStorage[key];
          }
        });
        callback(result);
      }),
      set: jest.fn((data, callback) => {
        Object.assign(mockStorage, data);
        if (callback) callback();
      })
    }
  }
};

// Node.js doesn't have crypto.subtle by default in global scope in older versions,
// but it is available in newer versions.
// However, the test environment 'node' might need it explicitly if it's not there.
import { webcrypto } from 'node:crypto';
if (!global.crypto) {
  global.crypto = webcrypto;
}

describe('Crypto Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key in mockStorage) {
      delete mockStorage[key];
    }
  });

  test('should encrypt and decrypt a password', async () => {
    const password = 'mySecretPassword123';
    const encrypted = await encryptPassword(password);

    expect(encrypted.startsWith('aes256gcm:')).toBe(true);
    expect(encrypted).not.toBe(password);

    const decrypted = await decryptPassword(encrypted);
    expect(decrypted).toBe(password);
  });

  test('should handle plaintext passwords (migration)', async () => {
    const plaintext = 'existingPlaintextPassword';
    const result = await decryptPassword(plaintext);
    expect(result).toBe(plaintext);
  });

  test('should use the same key for multiple operations', async () => {
    const password = 'pass';
    await encryptPassword(password);
    expect(chrome.storage.local.set).toHaveBeenCalled();

    const keyCallCount = chrome.storage.local.set.mock.calls.length;

    await encryptPassword('another');
    // Should NOT have called set for the key again
    expect(chrome.storage.local.set.mock.calls.length).toBe(keyCallCount);
  });

  test('should produce different ciphertexts for the same password', async () => {
    const password = 'samePassword';
    const enc1 = await encryptPassword(password);
    const enc2 = await encryptPassword(password);

    expect(enc1).not.toBe(enc2);

    const dec1 = await decryptPassword(enc1);
    const dec2 = await decryptPassword(enc2);

    expect(dec1).toBe(password);
    expect(dec2).toBe(password);
  });
});
