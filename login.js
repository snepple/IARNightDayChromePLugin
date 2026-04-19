async function performAutoLogin() {
  try {
    // 1. Handle Cookie Consent if present
    const consentBtn = document.querySelector("#cookie-consent button[data-cookie-string]");
    const accPolicy = document.getElementById("accept-policy");
    if (accPolicy && consentBtn && accPolicy.innerText === "Accept") {
        console.log("[IamResponding Auto Login] Accepting cookie policy...");
        await sleep(1000); // Give it a sec before clicking
        consentBtn.click();
    }

    // 2. Check if we are on the login page
    if (window.location.href.toLowerCase().includes("/login/member")) {
      console.log("[IamResponding Auto Login] Login page detected. Waiting for fields...");

      // Wait for fields to be available
      const agencyBox = await waitForElement('#Input_Agency');
      const userBox = await waitForElement('#Input_Username');
      const passBox = await waitForElement('#Input_Password');
      const submitBtn = await waitForElement("[name='Input.button']");

      // Retrieve credentials
      chrome.storage.local.get(['iar_agency', 'iar_username', 'iar_password'], async (result) => {
        if (result.iar_agency && result.iar_username && result.iar_password) {
          console.log("[IamResponding Auto Login] Credentials found, filling form...");

          agencyBox.value = result.iar_agency;
          userBox.value = result.iar_username;
          passBox.value = result.iar_password;

          // Dispatch input events in case the page uses React/Angular/Vue which needs events to update internal state
          agencyBox.dispatchEvent(new Event('input', { bubbles: true }));
          userBox.dispatchEvent(new Event('input', { bubbles: true }));
          passBox.dispatchEvent(new Event('input', { bubbles: true }));

          console.log("[IamResponding Auto Login] Waiting 3 seconds before submitting...");
          // Implement a 3-second delay to bypass certain front-end validations
          await sleep(3000);

          console.log("[IamResponding Auto Login] Clicking submit button.");
          submitBtn.click();
        } else {
          console.log("[IamResponding Auto Login] Missing credentials in storage. Please configure them in extension options.");
        }
      });
    }
  } catch (error) {
    console.error("[IamResponding Auto Login] Error during auto-login sequence:", error);
  }
}

// Run the auto-login sequence
console.log("[IamResponding Auto Login] Content script loaded.");
performAutoLogin();

// To handle SPA redirects or dynamic loading on auth.iamresponding.com
// We can set up a MutationObserver or listen to popstate, but since it's auth.,
// it usually does full page loads. If it's a SPA, we check periodically or observe changes.
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    if (url.toLowerCase().includes("/login/member")) {
       console.log("[IamResponding Auto Login] URL changed to login page. Triggering auto-login.");
       setTimeout(performAutoLogin, 1000); // Wait a bit for DOM to settle
    }
  }
}).observe(document, {subtree: true, childList: true});
