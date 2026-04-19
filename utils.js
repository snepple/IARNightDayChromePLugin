/**
 * Shared utility functions for IamResponding Auto Theme extension.
 */

/**
 * Wait for a DOM element to be present.
 * @param {string} selector - CSS selector of the element.
 * @param {number} maxTries - Maximum number of times to check (default 40, which is 20 seconds at 500ms intervals).
 * @returns {Promise<Element>}
 */
function waitForElement(selector, maxTries = 40) {
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
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
