import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nirvaanahouse.studio',
  appName: 'Studio Management System',
  webDir: 'dist/studio-management-system/browser',
  server: {
    androidScheme: 'https',
  },
};

export default config;
