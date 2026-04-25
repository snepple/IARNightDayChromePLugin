import { jest } from '@jest/globals';
import { sleep, waitForElement } from './utils.js';

describe('utils.js', () => {

  beforeEach(() => {
    jest.useFakeTimers();

    // Mock DOM and other globals if needed, but here we can just mock document
    global.document = {
      querySelector: jest.fn()
    };

    jest.spyOn(global, 'setInterval');
    jest.spyOn(global, 'clearInterval');
    jest.spyOn(global, 'setTimeout');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    delete global.document;
  });

  describe('sleep', () => {
    test('resolves after specified time', async () => {
      const ms = 1000;
      const promise = sleep(ms);

      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), ms);

      jest.advanceTimersByTime(ms);

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('waitForElement', () => {
    test('resolves when element is found', async () => {
      const selector = '.test-element';
      const mockElement = { id: 'test' };

      document.querySelector.mockReturnValueOnce(null).mockReturnValueOnce(mockElement);

      const promise = waitForElement(selector);

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 500);

      // Advance to first interval
      jest.advanceTimersByTime(500); // Tries: 0 -> check (null)

      // Advance to second interval
      jest.advanceTimersByTime(500); // Tries: 0 -> check (found!)

      const result = await promise;
      expect(result).toBe(mockElement);
      expect(document.querySelector).toHaveBeenCalledWith(selector);
      expect(clearInterval).toHaveBeenCalled();
    });

    test('rejects after maxTries if element is not found', async () => {
      const selector = '.missing';
      const maxTries = 3;

      document.querySelector.mockReturnValue(null);

      const promise = waitForElement(selector, maxTries);

      for (let i = 0; i < maxTries; i++) {
        jest.advanceTimersByTime(500);
      }

      await expect(promise).rejects.toThrow(`Element not found: ${selector}`);
      expect(clearInterval).toHaveBeenCalled();
    });

    test('uses default maxTries of 40', async () => {
        const selector = '.missing';
        document.querySelector.mockReturnValue(null);

        const promise = waitForElement(selector);

        // Advance 39 times
        for (let i = 0; i < 39; i++) {
            jest.advanceTimersByTime(500);
        }

        jest.advanceTimersByTime(500);

        await expect(promise).rejects.toThrow(`Element not found: ${selector}`);
    });
  });
});
