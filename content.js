// Wait for DOM to be ready
function waitForElement(selector, maxTries = 20) {
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setTargetTheme(targetTheme) {
  console.log(`[IamResponding Auto Theme] Attempting to set theme to: ${targetTheme}`);

  try {
    // 1. Open settings menu
    // Primary selector: .icon-gear
    // Fallback path if .icon-gear isn't found
    const gearSelector = '.icon-gear, #root > div.top-bar-print.header._topBar_1r2wu_163 > header > div > div._rightSide_dylaf_260 > div._dashboardOptions_138j8_244._menuCommon_138j8_167 > div._dropdownButton_138j8_176.iar-dropdown-btn > button > i.icon-gear';

    const gearIcon = await waitForElement(gearSelector);

    // We assume the gear icon is within a button
    const settingsButton = gearIcon.closest('button') || gearIcon;
    settingsButton.click();

    // Wait for the menu to open and render
    await sleep(1000);

    // 2. Find the theme switch
    const switchSelector = 'input[name="nightModeSwitch"]';
    const themeSwitchInput = await waitForElement(switchSelector, 5); // 5 tries max since menu is open

    // Determine current state
    const isCurrentlyDark = themeSwitchInput.checked;
    const shouldBeDark = targetTheme === 'night';

    console.log(`[IamResponding Auto Theme] Current theme: ${isCurrentlyDark ? 'night' : 'day'}, Target: ${targetTheme}`);

    // 3. Toggle if needed
    if (isCurrentlyDark !== shouldBeDark) {
      console.log('[IamResponding Auto Theme] Toggling theme...');
      // In Material UI, the click needs to happen on the switch base or we might need to dispatch an event
      const switchBase = themeSwitchInput.closest('.MuiSwitch-switchBase') || themeSwitchInput.parentElement;
      if (switchBase) {
        switchBase.click();
      } else {
        themeSwitchInput.click();
      }
    } else {
      console.log('[IamResponding Auto Theme] Theme is already correct.');
    }

    // Wait a bit to let the toggle animation and React state settle
    await sleep(500);

    // 4. Close the settings menu
    settingsButton.click();
    console.log('[IamResponding Auto Theme] Settings menu closed.');

  } catch (error) {
    console.error('[IamResponding Auto Theme] Error changing theme:', error);
  }
}

// Check initial state on load
chrome.runtime.sendMessage({ type: 'GET_THEME_STATE' }, (response) => {
  if (response && response.themeState) {
    // Give the app some time to load before trying to switch
    setTimeout(() => {
      setTargetTheme(response.themeState);
    }, 2000);
  }
});

// Listen for updates from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'THEME_UPDATE') {
    setTargetTheme(message.themeState);
  }
});


function adjustAgencyNameFontSize() {
  const container = document.querySelector('.iar-agency-name');
  let textElement = document.querySelector('[data-cy="Agency-Name"]');
  // If the direct target doesn't work, maybe the container itself has the text
  if (!textElement && container) { textElement = container; }

  if (!container || !textElement) return;

  const resizeText = () => {
    // Reset to max font size first to re-calculate if container grows
    textElement.style.fontSize = '1.8rem';
    let currentFontSize = parseFloat(window.getComputedStyle(textElement).fontSize);

    // Decrease font size until it fits
    while (textElement.scrollWidth > container.clientWidth && currentFontSize > 10) {
      currentFontSize -= 1;
      textElement.style.fontSize = `${currentFontSize}px`;
    }
  };

  // Run initially
  resizeText();

  // Create ResizeObserver to handle window resizes
  const resizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(resizeText);
  });

  resizeObserver.observe(container);
}

// Check for agency name element initially
const agencyName = document.querySelector('[data-cy="Agency-Name"]');
if (agencyName) {
  adjustAgencyNameFontSize();
} else {
  // If not there yet, observe DOM until it is
  const observer = new MutationObserver((mutations, obs) => {
    const agencyName = document.querySelector('[data-cy="Agency-Name"]');
    if (agencyName) {
      adjustAgencyNameFontSize();
      obs.disconnect();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
