const API_URL = 'https://api.sunrise-sunset.org/json';

function pruneSunCache() {
  chrome.storage.local.get(null, (items) => {
    const nowStr = new Date().toISOString().split('T')[0];
    const keysToRemove = Object.keys(items).filter(key => {
      if (key.startsWith('sun_cache_')) {
        const parts = key.split('_');
        const dateStr = parts[parts.length - 1];
        return dateStr < nowStr;
      }
      return false;
    });
    if (keysToRemove.length > 0) {
      chrome.storage.local.remove(keysToRemove);
    }
  });
}

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  pruneSunCache();
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

async function getLocation() {
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

const pendingRequests = new Map();

export async function fetchSunriseSunset(lat, lng, date = null) {
  const dateStr = date || new Date().toISOString().split('T')[0];
  const cacheKey = `sun_cache_${lat.toFixed(4)}_${lng.toFixed(4)}_${dateStr}`;

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  const requestPromise = (async () => {
    try {
      const cached = await new Promise(resolve => {
        chrome.storage.local.get([cacheKey], (result) => resolve(result));
      });

      if (cached && cached[cacheKey]) {
        const data = cached[cacheKey];
        return {
          sunrise: new Date(data.sunrise),
          sunset: new Date(data.sunset)
        };
      }

      const url = `${API_URL}?lat=${lat}&lng=${lng}&formatted=0${date ? `&date=${date}` : ''}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'OK') {
        const results = {
          sunrise: data.results.sunrise,
          sunset: data.results.sunset
        };
        chrome.storage.local.set({ [cacheKey]: results });
        return {
          sunrise: new Date(results.sunrise),
          sunset: new Date(results.sunset)
        };
      }
    } catch (error) {
      console.error('Error fetching sunrise/sunset:', error);
    } finally {
      pendingRequests.delete(cacheKey);
    }
    return null;
  })();

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
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
    const tomorrowTimes = await fetchSunriseSunset(location.latitude, location.longitude, tomorrowStr);
    if (tomorrowTimes) {
      nextAlarmTime = tomorrowTimes.sunrise.getTime();
    } else {
      // fallback: add 24h
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
