document.addEventListener('DOMContentLoaded', async () => {
  const requestButton = document.getElementById('requestLocation');
  const statusDiv = document.getElementById('status');

  // Check if we already have the location
  chrome.storage.local.get(['location'], (result) => {
    if (result.location) {
      statusDiv.textContent = 'Location access granted.';
      statusDiv.className = 'success';
      requestButton.style.display = 'none';
    }
  });

  requestButton.addEventListener('click', () => {
    statusDiv.textContent = 'Requesting location...';
    statusDiv.className = '';

    // We request location here in the popup where we have user interaction
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          chrome.storage.local.set({ location: loc }, () => {
            statusDiv.textContent = 'Location saved successfully!';
            statusDiv.className = 'success';
            requestButton.style.display = 'none';

            // Notify background script that location was updated
            chrome.runtime.sendMessage({ type: 'LOCATION_UPDATED' });
          });
        },
        (error) => {
          console.error("Geolocation error:", error);
          statusDiv.textContent = 'Failed to get location: ' + error.message;
          statusDiv.className = 'error';
        }
      );
    } else {
      statusDiv.textContent = 'Geolocation is not supported by this browser.';
      statusDiv.className = 'error';
    }
  });
});
