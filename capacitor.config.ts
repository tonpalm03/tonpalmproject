import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cprufood.app',
  appName: 'CPRUFood',
  webDir: 'out',
  server: {
    url: 'https://cprufood.web.app',
    cleartext: true,
    androidScheme: 'https',
    allowNavigation: [
      'cprufood.web.app',
      '*.web.app',
      '*.firebaseapp.com',
      'images.unsplash.com',
      'api.line.me',
      'access.line.me',
      'accounts.google.com',
      '*.google.com',
      '*.googleusercontent.com'
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
