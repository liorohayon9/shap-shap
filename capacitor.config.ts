import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lior.shapshap',
  appName: 'Shap Shap',
  webDir: 'dist',
  android: {
    // The alarm screen is our own Activity; keep the web layer out of its way.
    backgroundColor: '#0d0f14',
  },
};

export default config;
