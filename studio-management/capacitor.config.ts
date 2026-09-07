import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.app',
  appName: 'studio-management-system',
  webDir: 'dist/studio-management-system/browser',
  server: {
    androidScheme: 'https'
  }
};

export default config;
