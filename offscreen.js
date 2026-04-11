chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_LOCATION') {
    getGeolocation()
      .then(loc => {
        chrome.storage.local.set({ location: loc }, () => {
           sendResponse({ success: true, location: loc });
        });
      })
      .catch(error => {
        console.error('Error getting location in offscreen doc:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
});

function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        reject(error);
      },
      {
        maximumAge: 60000,
        timeout: 10000,
        enableHighAccuracy: false
      }
    );
  });
}
