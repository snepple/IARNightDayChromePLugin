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

const { fetchSunriseSunset } = await import('./background.js');
const onInstalledListener = global.chrome.runtime.onInstalled.addListener.mock.calls[0][0];

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

describe('onInstalled listener', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('sets badge when location is missing', () => {
    onInstalledListener();

    // The listener calls chrome.storage.local.get(['location'], ...)
    expect(global.chrome.storage.local.get).toHaveBeenCalledWith(['location'], expect.any(Function));
    const getCallback = global.chrome.storage.local.get.mock.calls[0][1];

    // Simulate missing location
    getCallback({});

    expect(global.chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "!" });
    expect(global.chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: "#FF0000" });
  });

  test('does not set badge when location exists', () => {
    onInstalledListener();

    const getCallback = global.chrome.storage.local.get.mock.calls[0][1];

    // Simulate location exists
    getCallback({ location: { latitude: 36.72, longitude: -4.42 } });

    expect(global.chrome.action.setBadgeText).not.toHaveBeenCalled();
  });
});
