import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tonpalm.merchant',
  appName: 'huaychan',
  webDir: 'out',
  server: {
    url: 'https://huaychan.web.app',
    cleartext: true,
    androidScheme: 'https',
    allowNavigation: [
      'huaychan.web.app',
      '*.web.app',
      '*.firebaseapp.com',
      'images.unsplash.com',
      'api.line.me',
      'access.line.me'
    ],
  },
  plugins: {
    StatusBar: {
      backgroundColor: '#0f172a',
      style: 'DARK',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
