<script setup>
import { computed, reactive, ref, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';

import { HttpUtil, LanguageManager } from '@/utils';
import { cronToDescription } from '@/utils/cron-parser.js';

const props = defineProps({
  open: { type: Boolean, default: false },
  mode: { type: String, default: 'add' },
  node: { type: Object, default: null },
  testConnection: { type: Function, required: true },
  save: { type: Function, required: true },
});

const emit = defineEmits(['update:open']);

const { t } = useI18n();

const activeTabKey = ref('basic');
const remoteSettings = ref(null);
const remoteSettingsLoading = ref(false);
const remoteSettingsError = ref('');

function defaultForm() {
  return {
    id: 0,
    name: '',
    remark: '',
    scheme: 'https',
    address: '',
    port: 2053,
    basePath: '/',
    apiToken: '',
    enable: true,
    allowPrivateAddress: false,
  };
}

const form = reactive(defaultForm());
const submitting = ref(false);
const testing = ref(false);
const testResult = ref(null);

const isEdit = computed(() => props.mode === 'edit');

watch(() => props.open, async (open) => {
  if (!open) return;
  activeTabKey.value = 'basic';
  Object.assign(form, defaultForm());
  testResult.value = null;
  remoteSettingsError.value = '';
  remoteSettings.value = null;

  if (isEdit.value && props.node) {
    Object.assign(form, props.node);
    // Fetch remote node settings
    remoteSettingsLoading.value = true;
    try {
      const msg = await HttpUtil.post(`/panel/api/nodes/fetchSettings/${props.node.id}`);
      if (msg?.success && msg.obj) {
        remoteSettings.value = msg.obj;
      } else {
        remoteSettingsError.value = t('nodeFetchError') + (msg?.msg || t('nodeUnknownError'));
      }
    } catch (e) {
      remoteSettingsError.value = t('nodeConnectError') + (e.message || '');
    } finally {
      remoteSettingsLoading.value = false;
    }
  }
});

const title = computed(() =>
  isEdit.value ? t('pages.nodes.editNode') : t('pages.nodes.addNode'),
);

function close() {
  if (!submitting.value) emit('update:open', false);
}

function buildPayload() {
  return {
    id: form.id || 0,
    name: form.name?.trim() || '',
    remark: form.remark?.trim() || '',
    scheme: form.scheme || 'https',
    address: form.address?.trim() || '',
    port: Number(form.port) || 0,
    basePath: form.basePath?.trim() || '/',
    apiToken: form.apiToken?.trim() || '',
    enable: !!form.enable,
    allowPrivateAddress: !!form.allowPrivateAddress,
  };
}

async function onTest() {
  testing.value = true;
  testResult.value = null;
  try {
    const payload = buildPayload();
    if (!payload.address || !payload.port) {
      message.error(t('pages.nodes.toasts.fillRequired'));
      return;
    }
    const msg = await props.testConnection(payload);
    if (msg?.success) {
      testResult.value = msg.obj;
    } else {
      testResult.value = { status: 'offline', error: msg?.msg || 'unknown error' };
    }
  } finally {
    testing.value = false;
  }
}

async function onSave() {
  const payload = buildPayload();
  if (!payload.name || !payload.address || !payload.port) {
    message.error(t('pages.nodes.toasts.fillRequired'));
    return;
  }
  submitting.value = true;
  try {
    const msg = await props.save(payload);
    if (msg?.success) {
      // Push remote settings if in edit mode and settings were loaded
      if (isEdit.value && remoteSettings.value && props.node?.id) {
        await HttpUtil.post(`/panel/api/nodes/pushSettings/${props.node.id}`, remoteSettings.value, {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      emit('update:open', false);
    }
  } finally {
    submitting.value = false;
  }
}

const cronDescription = computed(() => {
  const expr = remoteSettings.value?.xrayUpdateCron || '';
  return cronToDescription(expr, t('subUpdateXray'), t);
});

// === Timezone utilities ==============================================
function getTimezones() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['UTC', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Singapore',
      'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow'];
  }
}

function getTzOffsetMinutes(tz) {
  try {
    const now = Date.now();
    const utcDate = new Date(new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).format(now));
    const tzDate = new Date(new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).format(now));
    return (tzDate - utcDate) / 60000;
  } catch {
    return 0;
  }
}

function formatTzOffset(minutes) {
  const sign = minutes >= 0 ? '+' : '-';
  const totalHours = Math.abs(minutes) / 60;
  if (totalHours % 1 === 0) return `${sign}${Math.floor(totalHours)}`;
  return `${sign}${totalHours.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`;
}

function getMachineTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'Asia/Shanghai';
  }
}

const tzList = computed(() => {
  const zones = getTimezones();
  const now = Date.now();
  return zones
    .map(z => {
      const offsetMin = getTzOffsetMinutes(z);
      const offsetStr = formatTzOffset(offsetMin);
      return {
        label: `${z.replace(/_/g, ' ')} (UTC${offsetStr})`,
        value: z,
        offsetMin,
      };
    })
    .sort((a, b) => a.offsetMin - b.offsetMin || a.value.localeCompare(b.value));
});
</script>

<template>
  <a-modal :open="open" :title="title" :confirm-loading="submitting" :ok-text="t('save')" :cancel-text="t('cancel')"
    :mask-closable="false" width="720px" @ok="onSave" @cancel="close">
    <a-tabs v-model:active-key="activeTabKey">
      <!-- === Basic config tab (shown in both add and edit mode) === -->
      <a-tab-pane key="basic" :tab="t('subNodeInfo')">
        <a-form layout="vertical" :model="form">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item :label="t('pages.nodes.name')" required>
                <a-input v-model:value="form.name" :placeholder="t('pages.nodes.namePlaceholder')" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('pages.nodes.remark')">
                <a-input v-model:value="form.remark" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="6">
              <a-form-item :label="t('pages.nodes.scheme')">
                <a-select v-model:value="form.scheme">
                  <a-select-option value="https">https</a-select-option>
                  <a-select-option value="http">http</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('pages.nodes.address')" required>
                <a-input v-model:value="form.address" :placeholder="t('pages.nodes.addressPlaceholder')" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item :label="t('pages.nodes.port')" required>
                <a-input-number v-model:value="form.port" :min="1" :max="65535" style="width: 100%" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item :label="t('pages.nodes.basePath')">
                <a-input v-model:value="form.basePath" placeholder="/" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('pages.nodes.enable')">
                <a-switch v-model:checked="form.enable" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item :label="t('pages.nodes.allowPrivateAddress')">
            <a-switch v-model:checked="form.allowPrivateAddress" />
            <div class="hint">{{ t('pages.nodes.allowPrivateAddressHint') }}</div>
          </a-form-item>

          <a-form-item :label="t('pages.nodes.apiToken')" required>
            <a-input-password v-model:value="form.apiToken" :placeholder="t('pages.nodes.apiTokenPlaceholder')" />
            <div class="hint">{{ t('pages.nodes.apiTokenHint') }}</div>
          </a-form-item>

          <div class="test-row">
            <a-button :loading="testing" @click="onTest">
              {{ t('pages.nodes.testConnection') }}
            </a-button>
            <div v-if="testResult" class="test-result">
              <a-alert v-if="testResult.status === 'online'" type="success" show-icon
                :message="t('pages.nodes.connectionOk', { ms: testResult.latencyMs })"
                :description="testResult.xrayVersion ? `Xray ${testResult.xrayVersion}` : undefined" />
              <a-alert v-else type="error" show-icon :message="t('pages.nodes.connectionFailed')"
                :description="testResult.error" />
            </div>
          </div>
        </a-form>
      </a-tab-pane>

      <!-- === Tabs below only shown in edit mode === -->
      <template v-if="isEdit">
        <a-tab-pane key="panel" :tab="t('pages.nodes.tabPanel')">
          <div v-if="remoteSettingsLoading" class="loading-text">{{ t('pages.nodes.loadingRemoteSettings') }}</div>
          <div v-else-if="remoteSettingsError" class="error-text">{{ remoteSettingsError }}</div>
          <a-form v-else layout="vertical">
            <a-form-item :label="t('pages.nodes.remoteLang')">
              <a-select v-model:value="remoteSettings.tgLang" :style="{ width: '100%' }">
                <a-select-option v-for="l in LanguageManager.supportedLanguages" :key="l.value" :value="l.value">
                  <span role="img" :aria-label="l.name">{{ l.icon }}</span>
                  &nbsp;&nbsp;<span>{{ l.name }}</span>
                </a-select-option>
              </a-select>
            </a-form-item>

            <a-form-item :label="t('pages.nodes.remoteTimezone')">
              <a-select v-model:value="remoteSettings.timeLocation" show-search
                :filter-option="(input, option) => option.value.toLowerCase().includes(input.toLowerCase())"
                :style="{ width: '100%' }">
                <a-select-option v-for="tz in tzList" :key="tz.value" :value="tz.value">
                  {{ tz.label }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-form>
        </a-tab-pane>

        <a-tab-pane key="xray" :tab="t('pages.nodes.tabXray')">
          <div v-if="remoteSettingsLoading" class="loading-text">{{ t('pages.nodes.loadingRemoteSettings') }}</div>
          <div v-else-if="remoteSettingsError" class="error-text">{{ remoteSettingsError }}</div>
          <a-form v-else layout="vertical">
            <a-form-item :label="t('pages.nodes.remoteXrayAutoUpdate')">
              <a-switch v-model:checked="remoteSettings.xrayAutoUpdate" />
              <div class="hint">{{ t('pages.nodes.remoteXrayAutoUpdateHint') }}</div>
            </a-form-item>

            <a-form-item :label="t('pages.nodes.remoteXrayUpdateCron')">
              <a-input v-model:value="remoteSettings.xrayUpdateCron"
                :disabled="!remoteSettings?.xrayAutoUpdate"
                placeholder="0 30 2 * * *" />
              <div class="hint">{{ t('pages.nodes.remoteCronHint', { tz: remoteSettings?.timeLocation || 'Local' }) }}</div>
              <div v-if="remoteSettings?.xrayAutoUpdate && cronDescription" class="cron-hint">
                {{ cronDescription }}
              </div>
            </a-form-item>
          </a-form>
        </a-tab-pane>

        <a-tab-pane key="telegram" :tab="t('pages.nodes.tabTelegram')">
          <div v-if="remoteSettingsLoading" class="loading-text">{{ t('pages.nodes.loadingRemoteSettings') }}</div>
          <div v-else-if="remoteSettingsError" class="error-text">{{ remoteSettingsError }}</div>
          <a-form v-else layout="vertical">
            <a-form-item :label="t('pages.nodes.remoteTgEnable')">
              <a-switch v-model:checked="remoteSettings.tgBotEnable" />
            </a-form-item>

            <a-form-item :label="t('pages.nodes.remoteTgToken')">
              <a-input-password v-model:value="remoteSettings.tgBotToken"
                :placeholder="remoteSettings.hasTgBotToken ? t('pages.nodes.remoteTgTokenConfigured') : ''" />
            </a-form-item>

            <a-form-item :label="t('pages.nodes.remoteTgChatId')">
              <a-input v-model:value="remoteSettings.tgBotChatId" />
            </a-form-item>

            <a-form-item :label="t('pages.nodes.remoteTgLang')">
              <a-select v-model:value="remoteSettings.tgLang" :style="{ width: '100%' }">
                <a-select-option v-for="l in LanguageManager.supportedLanguages" :key="l.value" :value="l.value">
                  <span role="img" :aria-label="l.name">{{ l.icon }}</span>
                  &nbsp;&nbsp;<span>{{ l.name }}</span>
                </a-select-option>
              </a-select>
            </a-form-item>

            <a-form-item :label="t('pages.nodes.remoteTgRunTime')">
              <a-input v-model:value="remoteSettings.tgRunTime" placeholder="@daily" />
              <div class="hint">{{ t('pages.nodes.remoteTgRunTimeHint') }}</div>
            </a-form-item>

            <a-form-item :label="t('pages.nodes.remoteTgBackup')">
              <a-switch v-model:checked="remoteSettings.tgBotBackup" />
            </a-form-item>

            <a-form-item :label="t('pages.nodes.remoteTgLoginNotify')">
              <a-switch v-model:checked="remoteSettings.tgBotLoginNotify" />
            </a-form-item>

            <a-form-item :label="t('pages.nodes.remoteTgCpu')">
              <a-input-number v-model:value="remoteSettings.tgCpu" :min="0" :max="100" :style="{ width: '100%' }" />
              <div class="hint">{{ t('pages.nodes.remoteTgCpuHint') }}</div>
            </a-form-item>
          </a-form>
        </a-tab-pane>
      </template>
    </a-tabs>
  </a-modal>
</template>

<style scoped>
.hint {
  font-size: 12px;
  opacity: 0.6;
  margin-top: 4px;
}

.cron-hint {
  font-size: 12px;
  color: #888;
  margin-top: 8px;
}

.loading-text {
  padding: 20px;
  text-align: center;
  color: #888;
}

.error-text {
  padding: 20px;
  text-align: center;
  color: #ff4d4f;
}

.test-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.test-result {
  width: 100%;
}
</style>
