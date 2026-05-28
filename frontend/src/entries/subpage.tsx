import { createRoot } from 'react-dom/client';
import { message } from 'antd';
import 'antd/dist/reset.css';

import { setupAxios } from '@/api/axios-init.js';
setupAxios();

import { readyI18n } from '@/i18n/react';
import { ThemeProvider } from '@/hooks/useTheme';

const messageContainer = document.getElementById('message');
if (messageContainer) {
  message.config({ getContainer: () => messageContainer });
}

const isPublicSubPage = !!(window as any).__SUB_PAGE_DATA__;

readyI18n().then(async () => {
  const root = document.getElementById('app');
  if (!root) return;

  if (isPublicSubPage) {
    const { default: SubPage } = await import('@/pages/sub/SubPage');
    createRoot(root).render(
      <ThemeProvider>
        <SubPage />
      </ThemeProvider>,
    );
  } else {
    const { default: SubscriptionAdminPage } = await import('@/pages/subscription/SubscriptionAdminPage');
    createRoot(root).render(
      <ThemeProvider>
        <SubscriptionAdminPage />
      </ThemeProvider>,
    );
  }
});
