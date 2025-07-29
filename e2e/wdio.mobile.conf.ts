import {config as baseConfig} from './wdio.conf.ts';
// Add these imports at the top
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const platform = process.env.PLATFORM || 'android';

const mobileConfig = {
  ...baseConfig,

  // Appium service
  services: ['appium'],

  // Mobile capabilities
  capabilities:
    platform === 'android'
      ? [
          {
            platformName: 'Android',
            'appium:deviceName': 'Android Emulator',
            'appium:automationName': 'UiAutomator2',
            'appium:app':
              process.env.ANDROID_APK_PATH ||
              '../app/android/app/build/outputs/apk/debug/app-debug.apk',
            'appium:autoGrantPermissions': true,
            'appium:newCommandTimeout': 240,
            'appium:chromedriverAutodownload': true,
            'appium:chromedriverChromeMappingFile': null, // Let Appium auto-detect
          },
        ]
      : [
          {
            platformName: 'iOS',
            'appium:deviceName': 'iPhone Simulator',
            'appium:automationName': 'XCUITest',
            'appium:app':
              process.env.IOS_APP_PATH ||
              '../app/ios/App/build/Products/Debug-iphonesimulator/App.app',
            'appium:autoAcceptAlerts': true,
            'appium:newCommandTimeout': 240,
          },
        ],

  // Mobile-specific settings
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
};

export {mobileConfig as config};
