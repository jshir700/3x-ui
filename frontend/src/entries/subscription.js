import { createApp } from 'vue';
import { setupAxios } from '@/api/axios-init.js';
import { i18n, readyI18n } from '@/i18n/index.js';
import SubscriptionPage from '@/pages/subscription/SubscriptionPage.vue';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';

setupAxios();

readyI18n().then(() => {
  const app = createApp(SubscriptionPage);
  app.use(Antd);
  app.use(i18n);
  app.mount('#app');
});
