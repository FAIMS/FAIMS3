import type {CapacitorConfig} from '@capacitor/cli';

const appId = process.env.VITE_APP_ID || 'org.fedarch.faims3';
const appName = process.env.VITE_APP_NAME || 'APPNAME';

const adbForwardMode = process.env.CAP_ANDROID_ADB_FORWARD === 'true';
const devServerUrl =
  process.env.CAP_SERVER_URL ||
  (adbForwardMode ? 'http://localhost:3000' : undefined);

const config: CapacitorConfig = {
  appId,
  appName,
  npmClient: 'pnpm',
  webDir: 'build',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
    StatusBar: {
      style: 'Light',
      backgroundColor: '#FAFAFB',
      overlaysWebView: false,
    },
    CapacitorHttp: {
      enabled: adbForwardMode ? true : false,
    },
  },
  server: devServerUrl
    ? {
        url: devServerUrl,
        cleartext: true,
        allowNavigation: [],
        iosScheme: appId,
      }
    : {
        allowNavigation: [],
        iosScheme: appId,
      },
  android: {
    webContentsDebuggingEnabled: true,
  },
  cordova: {},
};

export default config;
