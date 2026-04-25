(async () => {
  const src = chrome.runtime.getURL('login.js');
  await import(src);
})();
