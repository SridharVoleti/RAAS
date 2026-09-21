import type { CapacitorConfig } from '@capacitor/cli';

// Points the native shell at the live production site instead of bundling
// static files, since the Next.js app relies on SSR, API routes and
// Supabase cookie auth that a static export can't serve.
const PROD_URL = 'https://srikrishnamargam.in';

const config: CapacitorConfig = {
  appId: 'in.srikrishnamargam.app',
  appName: 'Krishnamargam',
  webDir: 'mobile-shell',
  server: {
    url: PROD_URL,
    cleartext: false,
    allowNavigation: ['srikrishnamargam.in', '*.srikrishnamargam.in', '*.supabase.co', '*.razorpay.com'],
  },
  android: {
    backgroundColor: '#1a0f00',
  },
};

export default config;
