document.addEventListener('DOMContentLoaded', () => {
  const agencyInput = document.getElementById('agency');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const hideRespondNowInput = document.getElementById('hideRespondNow');
  const form = document.getElementById('options-form');
  const statusDiv = document.getElementById('status');

  // Load saved options
  chrome.storage.local.get(['iar_agency', 'iar_username', 'iar_password', 'iar_hide_respond_now'], (result) => {
    if (result.iar_agency) agencyInput.value = result.iar_agency;
    if (result.iar_username) usernameInput.value = result.iar_username;
    if (result.iar_password) passwordInput.value = result.iar_password;
    if (result.iar_hide_respond_now) hideRespondNowInput.checked = result.iar_hide_respond_now;
  });

  // Save options
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const agency = agencyInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value; // Don't trim password
    const hideRespondNow = hideRespondNowInput.checked;

    chrome.storage.local.set({
      iar_agency: agency,
      iar_username: username,
      iar_password: password,
      iar_hide_respond_now: hideRespondNow
    }, () => {
      // Update status to let user know options were saved.
      statusDiv.textContent = 'Options saved!';
      statusDiv.classList.add('show');
      setTimeout(() => {
        statusDiv.classList.remove('show');
      }, 3000);
    });
  });
});
