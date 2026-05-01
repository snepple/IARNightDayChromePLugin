const API_URL = 'https://api.sunrise-sunset.org/json';

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['location'], (result) => {
    if (!result.location) {
      // If no location, prompt user by opening options/popup or similar
      // Manifest v3 allows action.openPopup() in some contexts but typically requires user interaction.
      // Easiest is to open it in a tab or just notify them.
      // We will create a small onboarding tab if location is missing.
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
    } else {
      updateTimesAndSchedule();
    }
  });
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOCATION_UPDATED') {
    updateTimesAndSchedule();
  } else if (message.type === 'GET_THEME_STATE') {
    // Content script requesting current state on load
    // Trigger an update immediately to recover from stuck state if alarm failed
    updateTimesAndSchedule();
    chrome.storage.local.get(['themeState'], (result) => {
      sendResponse({ themeState: result.themeState || 'day' });
    });
    return true;
  }
});

// Alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'THEME_SWITCH') {
    updateTimesAndSchedule(); // Re-eval and schedule next
  }
});

async function setupOffscreenDocument(path) {
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: path,
    reasons: ['GEOLOCATION'],
    justification: 'To get user location for sunrise/sunset times'
  });
}

export async function getLocation() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['location'], async (result) => {
      if (result.location) {
        resolve(result.location);
      } else {
        // Try offscreen doc
        await setupOffscreenDocument('offscreen.html');
        chrome.runtime.sendMessage({ type: 'GET_LOCATION' }, (response) => {
          if (response && response.success) {
            resolve(response.location);
          } else {
            resolve(null);
          }
        });
      }
    });
  });
}

export async function fetchSunriseSunset(lat, lng) {
  try {
    const response = await fetch(`${API_URL}?lat=${lat}&lng=${lng}&formatted=0`);
    const data = await response.json();
    if (data.status === 'OK') {
      return {
        sunrise: new Date(data.results.sunrise),
        sunset: new Date(data.results.sunset)
      };
    }
  } catch (error) {
    console.error('Error fetching sunrise/sunset:', error);
  }
  return null;
}

async function updateTimesAndSchedule() {
  const location = await getLocation();
  if (!location) return;

  const times = await fetchSunriseSunset(location.latitude, location.longitude);
  if (!times) {
    // If API fails (e.g. network down when waking from sleep), retry in 5 minutes
    chrome.alarms.create('THEME_SWITCH', { when: Date.now() + 5 * 60 * 1000 });
    return;
  }

  const now = new Date();
  let themeState = 'day';
  let nextAlarmTime = null;

  if (now < times.sunrise) {
    // Before sunrise -> Night
    themeState = 'night';
    nextAlarmTime = times.sunrise.getTime();
  } else if (now >= times.sunrise && now < times.sunset) {
    // Daytime -> Day
    themeState = 'day';
    nextAlarmTime = times.sunset.getTime();
  } else {
    // After sunset -> Night
    themeState = 'night';
    // Fetch times for tomorrow to get next sunrise
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    try {
      const resp = await fetch(`${API_URL}?lat=${location.latitude}&lng=${location.longitude}&date=${tomorrowStr}&formatted=0`);
      const data = await resp.json();
      if (data.status === 'OK') {
        nextAlarmTime = new Date(data.results.sunrise).getTime();
      } else {
         // fallback: add 24h
         nextAlarmTime = now.getTime() + 24 * 60 * 60 * 1000;
      }
    } catch(e) {
      nextAlarmTime = now.getTime() + 24 * 60 * 60 * 1000;
    }
  }

  // Save current state
  chrome.storage.local.set({ themeState }, () => {
    // Broadcast state to all open IamResponding tabs
    chrome.tabs.query({ url: "https://dashboard.iamresponding.com/*" }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: 'THEME_UPDATE', themeState });
      });
    });
  });

  // Schedule next alarm
  if (nextAlarmTime) {
    chrome.alarms.create('THEME_SWITCH', { when: nextAlarmTime });
  }
}
