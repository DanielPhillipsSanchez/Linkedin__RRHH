import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'LinkedIn HHRH Screener',
    description: 'Evaluate LinkedIn candidates against job descriptions using AI scoring',
    version: '0.1.0',
    permissions: [
      'storage',
      'alarms',
      'notifications',
      'activeTab',
      'scripting',
      'downloads',
      'webNavigation',
      'declarativeNetRequest',
    ],
    host_permissions: [
      'https://www.linkedin.com/*',
      'https://*.snowflakecomputing.com/*',
      'https://api.anthropic.com/*',
    ],
    options_ui: {
      page: 'options/index.html',
      open_in_tab: true,
    },
  },
});
