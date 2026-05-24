<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AndroidOutlined, AppleOutlined, DownOutlined, CopyOutlined,
  LinkOutlined, QuestionCircleOutlined, UserOutlined,
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';

import { ClipboardManager, IntlUtil, LanguageManager } from '@/utils';
import {
  theme as themeState, antdThemeConfig,
  toggleTheme, toggleUltra,
  pauseAnimationsUntilLeave,
} from '@/composables/useTheme.js';

const { t } = useI18n();

const subData = window.__SUB_PAGE_DATA__ || {};

// Extract all data from the injected JSON
const sId = subData.sId || '';
const subTitle = subData.subTitle || '';
const enabled = !!subData.enabled;
const format = subData.format || '';
const download = subData.download || '0';
const upload = subData.upload || '0';
const total = subData.total || '∞';
const used = subData.used || '0';
const remained = subData.remained || '';
const downloadByte = Number(subData.downloadByte || 0);
const uploadByte = Number(subData.uploadByte || 0);
const totalByte = Number(subData.totalByte || 0);
const expireMs = Number(subData.expire || 0) * 1000;
const lastOnlineMs = Number(subData.lastOnline || 0);
const subUrl = subData.subUrl || '';
const subSupportUrl = subData.subSupportUrl || '';
const subProfileUrl = subData.subProfileUrl || '';
const announce = subData.announce || '';
const updateInterval = Number(subData.updateInterval || 0);
const callCount = Number(subData.callCount || 0);
const datepicker = subData.datepicker || 'gregorian';
const dataResult = Array.isArray(subData.links) ? subData.links : [];

const isUnlimited = computed(() => totalByte <= 0 && expireMs === 0);
const isActive = computed(() => {
  if (!enabled) return false;
  if (totalByte > 0) {
    const usedBytes = downloadByte + uploadByte;
    if (usedBytes >= totalByte) return false;
  }
  if (expireMs > 0 && Date.now() >= expireMs) return false;
  return true;
});

// Traffic percentage for progress bar
const trafficPercent = computed(() => {
  if (totalByte <= 0) return 0;
  const usedBytes = downloadByte + uploadByte;
  return Math.min(Math.round((usedBytes / totalByte) * 100), 100);
});

const trafficStatus = computed(() => {
  if (totalByte <= 0) return 'default';
  const pct = trafficPercent.value;
  if (pct >= 100) return 'exception';
  if (pct >= 80) return 'warning';
  return 'active';
});

const isMobile = ref(false);
function updateMobile() { isMobile.value = window.innerWidth < 576; }
onMounted(() => { updateMobile(); window.addEventListener('resize', updateMobile); });

// QR colour adapts to dark/ultra mode card backgrounds
const qrColor = computed(() => (themeState.isDark || themeState.isUltra) ? '#fff' : '#000');
const qrBg = computed(() => {
  if (themeState.isUltra) return '#0c0e12';
  if (themeState.isDark) return '#252526';
  return '#ffffff';
});

const langs = LanguageManager.supportedLanguages;
const lang = ref(LanguageManager.getLanguage());
function onLangChange(next) {
  lang.value = next;
  LanguageManager.setLanguage(next);
}

function cycleTheme() {
  pauseAnimationsUntilLeave('sub-theme-cycle');
  if (!themeState.isDark) { toggleTheme(); if (themeState.isUltra) toggleUltra(); }
  else if (!themeState.isUltra) { toggleUltra(); }
  else { toggleUltra(); toggleTheme(); }
}

const QR_SIZE = 200;

async function copy(value) {
  if (!value) return;
  const ok = await ClipboardManager.copyText(value);
  if (ok) message.success(t('copied'));
}
function open(url) { if (url) window.open(url, '_blank'); }

const shadowrocketUrl = computed(() => {
  if (!subUrl) return '';
  const sep = subUrl.includes('?') ? '&' : '?';
  const raw = subUrl + sep + 'flag=shadowrocket';
  const b64 = encodeURIComponent(btoa(raw));
  return `shadowrocket://add/sub/${b64}?remark=${encodeURIComponent(subTitle || sId || 'Subscription')}`;
});
const v2boxUrl = computed(() => `v2box://install-sub?url=${encodeURIComponent(subUrl)}&name=${encodeURIComponent(sId)}`);
const streisandUrl = computed(() => `streisand://import/${encodeURIComponent(subUrl)}`);
const v2raytunUrl = computed(() => subUrl);
const npvtunUrl = computed(() => subUrl);
const happUrl = computed(() => `happ://add/${subUrl}`);

const themeClass = computed(() => ({ 'is-dark': themeState.isDark, 'is-ultra': themeState.isUltra }));

const displayContent = computed(() => {
  const raw = dataResult.join('\n');
  if (!raw) return '';
  if (format === 'json') {
    try { return JSON.stringify(JSON.parse(raw), null, 2); }
    catch { return raw; }
  }
  return raw;
});
</script>

<template>
  <a-config-provider :theme="antdThemeConfig">
    <div class="sub-page" :class="themeClass">
      <a-card class="sub-card">
        <template #title>
          <a-space>
            <span>{{ t('subscription.title') }}</span>
            <a-tag v-if="format" color="blue">{{ format }}</a-tag>
            <a-tag v-if="subTitle">{{ subTitle }}</a-tag>
          </a-space>
        </template>
        <template #extra>
          <a-space>
            <a-dropdown :trigger="['click']">
              <a-button size="small">{{ langs.find(l => l.value === lang)?.icon }} {{ langs.find(l => l.value === lang)?.name }}</a-button>
              <template #overlay>
                <a-menu @click="({ key }) => onLangChange(key)">
                  <a-menu-item v-for="l in langs" :key="l.value">{{ l.icon }} {{ l.name }}</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
            <button type="button" class="theme-cycle" :aria-label="t('menu.theme')" :title="t('menu.theme')"
              @click="cycleTheme">
              <svg v-if="!themeState.isDark" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
              <svg v-else-if="!themeState.isUltra" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                <path fill="none" d="M19 3l0.7 1.4 1.4 0.7-1.4 0.7L19 7.2l-0.7-1.4-1.4-0.7 1.4-0.7z" />
              </svg>
            </button>
          </a-space>
        </template>

        <!-- Table + QR side by side -->
        <a-row :gutter="24">
          <a-col :xs="24" :sm="15">
            <a-descriptions bordered :column="1" size="small" class="info-table">
              <!-- 1. Status -->
              <a-descriptions-item :label="t('subscription.status')">
                <a-space>
                  <a-tag v-if="enabled && isActive" color="green">{{ t('subscription.active') }}</a-tag>
                  <a-tag v-else-if="enabled" color="orange">{{ t('subscription.inactive') }}</a-tag>
                  <a-tag v-else color="red">{{ t('subscription.inactive') }}</a-tag>
                </a-space>
              </a-descriptions-item>

              <!-- 2. Traffic Usage -->
              <a-descriptions-item :label="t('subTrafficUsage')">
                <div class="traffic-panel">
                  <a-progress
                    :percent="trafficPercent"
                    :status="trafficStatus"
                    :stroke-color="trafficStatus === 'exception' ? '#ff4d4f' : trafficStatus === 'warning' ? '#faad14' : '#52c41a'"
                    :show-info="totalByte > 0"
                    size="small"
                  />
                  <div class="traffic-details">
                    <a-tag color="green">↓ {{ download }}</a-tag>
                    <a-tag color="orange">↑ {{ upload }}</a-tag>
                    <a-tag v-if="totalByte > 0" color="purple">{{ t('subRemained') }}: {{ remained }}</a-tag>
                  </div>
                </div>
              </a-descriptions-item>

              <!-- 3. Expiry Time -->
              <a-descriptions-item :label="t('subscription.expiry')">
                <template v-if="expireMs === 0">{{ t('subscription.noExpiry') }}</template>
                <template v-else>{{ IntlUtil.formatDate(expireMs, datepicker) }}</template>
              </a-descriptions-item>

              <!-- 4. Update Interval -->
              <a-descriptions-item :label="t('subUpdateInterval')">
                {{ updateInterval > 0 ? updateInterval + 'h' : '-' }}
              </a-descriptions-item>

              <!-- 5. Last Online -->
              <a-descriptions-item :label="t('subLastOnlineTime')">
                <template v-if="lastOnlineMs > 0">{{ IntlUtil.formatDate(lastOnlineMs, datepicker) }}</template>
                <template v-else>-</template>
              </a-descriptions-item>

              <!-- 6. Online Calls -->
              <a-descriptions-item :label="t('subOnlineCount')">
                {{ callCount }}
              </a-descriptions-item>
            </a-descriptions>

            <!-- Announcement -->
            <a-alert
              v-if="announce"
              type="warning"
              :message="announce"
              show-icon
              class="announce-box"
            />

            <!-- Quick Actions -->
            <a-space class="quick-actions" :size="8">
              <a-button type="primary" @click="copy(subUrl)">
                <template #icon><LinkOutlined /></template>
                {{ t('subCopyLink') }}
              </a-button>
              <a-button v-if="subSupportUrl" @click="open(subSupportUrl)">
                <template #icon><QuestionCircleOutlined /></template>
                {{ t('subSupportLink') }}
              </a-button>
              <a-button v-if="subProfileUrl" @click="open(subProfileUrl)">
                <template #icon><UserOutlined /></template>
                {{ t('subProfileLink') }}
              </a-button>
            </a-space>
          </a-col>
          <a-col :xs="24" :sm="9" class="qr-col">
            <div class="qr-box">
              <a-qrcode :value="subUrl" :size="QR_SIZE" type="canvas" :bordered="false"
                :color="qrColor" :bg-color="qrBg" :title="t('copied')" @click="copy(subUrl)" />
              <a-tag color="purple" class="qr-tag">{{ t('pages.settings.subSettings') }}</a-tag>
            </div>
          </a-col>
        </a-row>

        <!-- Subscription content -->
        <div v-if="displayContent" class="links-section">
          <div class="link-box">
            <CopyOutlined class="link-copy-icon" @click="copy(displayContent)" />
            <pre class="content-pre">{{ displayContent }}</pre>
          </div>
        </div>

        <!-- App import dropdowns -->
        <a-row :gutter="[8, 8]" justify="center" class="apps-row">
          <a-col :xs="24" :sm="12" class="app-col">
            <a-dropdown :trigger="['click']">
              <a-button :block="isMobile" size="large" type="primary"><AndroidOutlined /> Android <DownOutlined /></a-button>
              <template #overlay>
                <a-menu>
                  <a-menu-item key="android-v2box" @click="open(`v2box://install-sub?url=${encodeURIComponent(subUrl)}&name=${encodeURIComponent(sId)}`)">V2Box</a-menu-item>
                  <a-menu-item key="android-v2rayng" @click="open(`v2rayng://install-config?url=${encodeURIComponent(subUrl)}`)">V2RayNG</a-menu-item>
                  <a-menu-item key="android-singbox" @click="copy(subUrl)">Sing-box</a-menu-item>
                  <a-menu-item key="android-v2raytun" @click="copy(subUrl)">V2RayTun</a-menu-item>
                  <a-menu-item key="android-npvtunnel" @click="copy(subUrl)">NPV Tunnel</a-menu-item>
                  <a-menu-item key="android-happ" @click="open(`happ://add/${subUrl}`)">Happ</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </a-col>
          <a-col :xs="24" :sm="12" class="app-col">
            <a-dropdown :trigger="['click']">
              <a-button :block="isMobile" size="large" type="primary"><AppleOutlined /> iOS <DownOutlined /></a-button>
              <template #overlay>
                <a-menu>
                  <a-menu-item key="ios-shadowrocket" @click="open(shadowrocketUrl)">Shadowrocket</a-menu-item>
                  <a-menu-item key="ios-v2box" @click="open(v2boxUrl)">V2Box</a-menu-item>
                  <a-menu-item key="ios-streisand" @click="open(streisandUrl)">Streisand</a-menu-item>
                  <a-menu-item key="ios-v2raytun" @click="copy(v2raytunUrl)">V2RayTun</a-menu-item>
                  <a-menu-item key="ios-npvtunnel" @click="copy(npvtunUrl)">NPV Tunnel</a-menu-item>
                  <a-menu-item key="ios-happ" @click="open(happUrl)">Happ</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </a-col>
        </a-row>
      </a-card>
    </div>
  </a-config-provider>
</template>

<style scoped>
.sub-page {
  --bg-page: #e6e8ec;
  --bg-card: #ffffff;
  min-height: 100vh;
  background: var(--bg-page);
}
.sub-page.is-dark {
  --bg-page: #1e1e1e;
  --bg-card: #252526;
}
.sub-page.is-dark.is-ultra {
  --bg-page: #050505;
  --bg-card: #0c0e12;
}

.sub-page :deep(.ant-layout),
.sub-page :deep(.ant-layout-content) {
  background: transparent;
}

.sub-page {
  padding: 24px 12px;
}

.sub-card {
  max-width: 960px;
  margin: 0 auto;
}

/* ---- QR code ---- */
.qr-col {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 8px;
}
.qr-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color-scheme: only light;
}
.qr-tag {
  width: 100%;
  text-align: center;
  margin: 0;
}

/* ---- Description table borders ---- */
.info-table {
  margin-top: 0;
}
.info-table :deep(.ant-descriptions-view),
.info-table :deep(.ant-descriptions-view) table,
.info-table :deep(.ant-descriptions-view) th,
.info-table :deep(.ant-descriptions-view) td {
  border-color: rgba(0,0,0,0.18) !important;
}
.info-table :deep(tbody > tr > th),
.info-table :deep(tbody > tr > td) {
  border-bottom: 1px solid rgba(0,0,0,0.18) !important;
}
.info-table :deep(tbody > tr:last-child > th),
.info-table :deep(tbody > tr:last-child > td) {
  border-bottom: none !important;
}
.is-dark .info-table :deep(.ant-descriptions-view),
.is-dark .info-table :deep(.ant-descriptions-view) table,
.is-dark .info-table :deep(.ant-descriptions-view) th,
.is-dark .info-table :deep(.ant-descriptions-view) td {
  border-color: rgba(255,255,255,0.18) !important;
}
.is-dark .info-table :deep(tbody > tr > th),
.is-dark .info-table :deep(tbody > tr > td) {
  border-bottom: 1px solid rgba(255,255,255,0.18) !important;
}
.is-dark.is-ultra .info-table :deep(.ant-descriptions-view),
.is-dark.is-ultra .info-table :deep(.ant-descriptions-view) table,
.is-dark.is-ultra .info-table :deep(.ant-descriptions-view) th,
.is-dark.is-ultra .info-table :deep(.ant-descriptions-view) td {
  border-color: rgba(255,255,255,0.08) !important;
}
.is-dark.is-ultra .info-table :deep(tbody > tr > th),
.is-dark.is-ultra .info-table :deep(tbody > tr > td) {
  border-bottom: 1px solid rgba(255,255,255,0.08) !important;
}

/* ---- Traffic panel ---- */
.traffic-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.traffic-details {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* ---- Announcement ---- */
.announce-box {
  margin-top: 12px;
}

/* ---- Quick actions ---- */
.quick-actions {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
}

/* ---- Subscription content ---- */
.links-section {
  margin-top: 16px;
}
.link-box {
  border-radius: 12px;
  padding: 16px;
  word-break: break-all;
  font-size: 13px;
  line-height: 1.5;
  background: rgba(0,0,0,0.03);
  border: 1px solid rgba(0,0,0,0.08);
  position: relative;
}
.link-copy-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  cursor: pointer;
  opacity: 0.6;
}
.link-copy-icon:hover {
  opacity: 1;
  color: #4096ff;
}
.content-pre {
  white-space: pre-wrap;
  font-family: 'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;
  margin: 0;
  font-size: 12px;
}
.is-dark .link-box {
  background: rgba(0,0,0,0.2);
  border-color: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.85);
}

/* ---- App buttons ---- */
.apps-row {
  margin-top: 24px;
}
.app-col {
  text-align: center;
}

/* ---- Theme cycle button ---- */
.theme-cycle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.08);
  background: var(--bg-card);
  color: rgba(0,0,0,0.65);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background-color 0.2s, transform 0.15s, color 0.2s;
}
.theme-cycle:hover,
.theme-cycle:focus-visible {
  background-color: rgba(64,150,255,0.1);
  color: #4096ff;
  transform: scale(1.05);
  outline: none;
}
.theme-cycle svg {
  width: 16px;
  height: 16px;
}
.is-dark .theme-cycle {
  border-color: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.85);
}
.is-dark .theme-cycle:hover,
.is-dark .theme-cycle:focus-visible {
  background-color: rgba(64,150,255,0.1);
  color: #4096ff;
}
</style>
