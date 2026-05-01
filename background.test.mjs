import { jest } from '@jest/globals';

// Mock chrome API before importing background.js
global.chrome = {
  runtime: {
    onInstalled: { addListener: jest.fn() },
    onMessage: { addListener: jest.fn() },
    getURL: jest.fn(),
    getContexts: jest.fn(),
    sendMessage: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn()
  },
  alarms: {
    onAlarm: { addListener: jest.fn() },
    create: jest.fn()
  },
  offscreen: {
    createDocument: jest.fn()
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  }
};

const { fetchSunriseSunset, getLocation } = await import('./background.js');

describe('getLocation', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('returns location from storage if available', async () => {
    const mockLocation = { latitude: 40.7128, longitude: -74.0060 };
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ location: mockLocation });
    });

    const result = await getLocation();

    expect(result).toEqual(mockLocation);
    expect(chrome.storage.local.get).toHaveBeenCalledWith(['location'], expect.any(Function));
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  test('requests location from offscreen document if not in storage', async () => {
    const mockLocation = { latitude: 34.0522, longitude: -118.2437 };

    // Not in storage
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });

    // No existing offscreen document
    chrome.runtime.getURL.mockReturnValue('chrome-extension://id/offscreen.html');
    chrome.runtime.getContexts.mockResolvedValue([]);
    chrome.offscreen.createDocument.mockResolvedValue();

    // Successful message response
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.type === 'GET_LOCATION') {
        callback({ success: true, location: mockLocation });
      }
    });

    const result = await getLocation();

    expect(result).toEqual(mockLocation);
    expect(chrome.offscreen.createDocument).toHaveBeenCalled();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'GET_LOCATION' },
      expect.any(Function)
    );
  });

  test('does not recreate offscreen document if it already exists', async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });

    chrome.runtime.getContexts.mockResolvedValue([{ contextType: 'OFFSCREEN_DOCUMENT' }]);

    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      callback({ success: true, location: { lat: 1, lng: 1 } });
    });

    await getLocation();

    expect(chrome.offscreen.createDocument).not.toHaveBeenCalled();
  });

  test('returns null if offscreen document fails to get location', async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });

    chrome.runtime.getContexts.mockResolvedValue([]);
    chrome.offscreen.createDocument.mockResolvedValue();

    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      callback({ success: false });
    });

    const result = await getLocation();

    expect(result).toBeNull();
  });
});

describe('fetchSunriseSunset', () => {
  const lat = 36.7201600;
  const lng = -4.4203400;

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns sunrise and sunset when API returns OK', async () => {
    const mockResponse = {
      status: 'OK',
      results: {
        sunrise: '2023-05-20T05:00:00+00:00',
        sunset: '2023-05-20T19:00:00+00:00'
      }
    };

    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockResponse)
    });

    const result = await fetchSunriseSunset(lat, lng);

    expect(result).toEqual({
      sunrise: new Date(mockResponse.results.sunrise),
      sunset: new Date(mockResponse.results.sunset)
    });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(`lat=${lat}&lng=${lng}`));
  });

  test('returns null when API status is not OK', async () => {
    const mockResponse = {
      status: 'INVALID_REQUEST'
    };

    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockResponse)
    });

    const result = await fetchSunriseSunset(lat, lng);

    expect(result).toBeNull();
  });

  test('returns null and logs error when fetch throws', async () => {
    const error = new Error('Network failure');
    global.fetch.mockRejectedValue(error);

    const result = await fetchSunriseSunset(lat, lng);

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith('Error fetching sunrise/sunset:', error);
  });

  test('returns null and logs error when json parsing fails', async () => {
    global.fetch.mockResolvedValue({
      json: jest.fn().mockRejectedValue(new Error('Unexpected token'))
    });

    const result = await fetchSunriseSunset(lat, lng);

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
