<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Modal, message } from 'ant-design-vue';
import {
  CloudServerOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  CopyOutlined,
  EditOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  MoreOutlined,
} from '@ant-design/icons-vue';

import { HttpUtil, SizeFormatter } from '@/utils';
import { theme as themeState, antdThemeConfig } from '@/composables/useTheme.js';
import { useMediaQuery } from '@/composables/useMediaQuery.js';
import { useAllSetting } from '@/pages/settings/useAllSetting.js';
import { useSubscription } from './useSubscription.js';
import InfinityIcon from '@/components/InfinityIcon.vue';
import AppSidebar from '@/components/AppSidebar.vue';
import CustomStatistic from '@/components/CustomStatistic.vue';
import SubscriptionFormModal from './SubscriptionFormModal.vue';

const { t, locale } = useI18n();
const { subscriptions, loading, fetched, fetchAll, create, update, remove, setEnable } = useSubscription();
const { allSetting } = useAllSetting();
const { isMobile } = useMediaQuery();

const tableScrollY = ref(500);
const tableWrapperRef = ref(null);
let tableRo = null;

function calcTableScrollY() {
  const el = tableWrapperRef.value?.$el || tableWrapperRef.value;
  tableScrollY.value = Math.max(300, el
    ? window.innerHeight - el.getBoundingClientRect().top - 55
    : window.innerHeight - 350);
}

onMounted(() => {
  nextTick(() => {
    const el = tableWrapperRef.value?.$el || tableWrapperRef.value;
    if (el) {
      tableRo = new ResizeObserver(() => calcTableScrollY());
      tableRo.observe(el);
    }
    calcTableScrollY();
  });
  window.addEventListener('resize', calcTableScrollY);
});
onUnmounted(() => {
  tableRo?.disconnect();
  window.removeEventListener('resize', calcTableScrollY);
});

function trafficTagColor(record) {
  const used = (record.trafficDown || 0) + (record.trafficUp || 0);
  const total = record.quotaTotal || 0;
  if (total === 0) return 'purple';       // unlimited
  if (used < total) return 'green';       // under quota
  return 'red';                            // at or over quota
}

const basePath = window.X_UI_BASE_PATH || '';
const requestUri = window.location.pathname;

// Load all inbounds for dynamic count
const allInbounds = ref([]);
async function loadInbounds() {
  const msg = await HttpUtil.get('/panel/api/inbounds/list');
  if (msg?.success) allInbounds.value = msg.obj || [];
}
// Refresh inbounds list periodically to pick up enable/disable changes
watch(fetched, (v) => { if (v) loadInbounds(); });
setInterval(() => { if (fetched.value) loadInbounds(); }, 5000);

const columns = [
  { title: '#', key: 'index', width: 50, align: 'center' },
  { title: t('subName'), key: 'name', width: 200, customHeaderCell: () => ({ style: { textAlign: 'center' } }) },
  { title: t('subStatus'), key: 'enable', width: 55, align: 'center' },
  { title: t('subFormat'), key: 'format', width: 65, align: 'center' },
  { title: t('subInboundCount'), dataIndex: 'inboundCount', key: 'inboundCount', width: 65, align: 'center' },
  { title: t('subClients'), dataIndex: 'clientCount', key: 'clientCount', width: 65, align: 'center' },
  { title: t('subTraffic'), key: 'traffic', width: 130, align: 'center' },
  { title: t('subExpiryTime'), dataIndex: 'expiryTimeDisplay', key: 'expiryTime', width: 150, align: 'center' },
  { title: t('subOnlineCount'), key: 'callCount', width: 80, align: 'center' },
  { title: t('subLastOnlineTime'), dataIndex: 'lastUsedDisplay', key: 'lastUsed', width: 160, align: 'center' },
  { title: t('subCreatedAt'), dataIndex: 'createdAtDisplay', key: 'createdAt', width: 150, align: 'center' },
  { title: t('subActions'), key: 'actions', width: 120, fixed: 'right', align: 'center' },
];

const totals = computed(() => {
  const total = subscriptions.value.length;
  const enabled = subscriptions.value.filter(s => s.enable).length;
  return { total, enabled };
});

const subDisabled = computed(() => !allSetting?.subEnable);

const formOpen = ref(false);
const formMode = ref('add');
const formSub = ref(null);

function onAdd() {
  formMode.value = 'add';
  formSub.value = null;
  formOpen.value = true;
}

// Mobile: detail modal for a subscription row
const detailSub = ref(null);
function openDetail(sub) { detailSub.value = sub; }
function closeDetail() { detailSub.value = null; }

function onEdit(sub) {
  formMode.value = 'edit';
  formSub.value = { ...sub };
  formOpen.value = true;
}

async function onSave(payload) {
  let msg;
  if (formMode.value === 'edit' && formSub.value?.id) {
    msg = await update(formSub.value.id, payload);
  } else {
    msg = await create(payload);
  }
  if (msg?.success) {
    await fetchAll();
  }
  return msg;
}

function onDelete(sub) {
  Modal.confirm({
    title: t('subDeleteTitle'),
    content: t('subDeleteConfirm', { remark: sub.remark || sub.subId }),
    okText: t('subOk'),
    okType: 'danger',
    cancelText: t('subCancel'),
    onOk: async () => {
      const msg = await remove(sub.id);
      if (msg?.success) {
        message.success(t('subDeleted'));
        await fetchAll();
      }
    },
  });
}

// Auto-disable expired subscriptions & track expiry status
const expiredSubIds = computed(() => {
  const now = Date.now();
  const ids = {};
  if (!subscriptions.value) return ids;
  for (const sub of subscriptions.value) {
    if (sub.expiryTime > 0 && now > sub.expiryTime) ids[sub.id] = true;
  }
  return ids;
});
watch(subscriptions, (list) => {
  if (!list || list.length === 0) return;
  const now = Date.now();
  for (const sub of list) {
    if (sub.enable && sub.expiryTime > 0 && now > sub.expiryTime) {
      setEnable(sub.id, false);
      sub.enable = false;
    }
  }
}, { deep: true });

async function onToggleEnable(sub, next) {
  const prev = sub.enable;
  sub.enable = next; // optimistic toggle → creates "shake" if reverted
  if (next && sub.expiryTime > 0 && Date.now() > sub.expiryTime) {
    sub.enable = prev; // revert
    message.warning(t('subExpiredWarning'));
    return;
  }
  const msg = await setEnable(sub.id, next);
  if (!msg?.success) {
    sub.enable = prev; // revert on API error
  } else {
    message.success(next ? t('subEnabledMsg') : t('subDisabledMsg'));
    await fetchAll();
  }
}

async function onCopyLink(sub) {
  const port = allSetting?.subPort || '2096';
  const proto = window.location.protocol;
  const host = window.location.hostname;
  const basePath = allSetting?.subURI || `${proto}//${host}:${port}/sub/`;
  const path = allSetting?.subPath || '/sub/';
  let baseUrl;
  if (allSetting?.subURI) {
    baseUrl = allSetting.subURI.endsWith('/') ? allSetting.subURI : allSetting.subURI + '/';
  } else {
    baseUrl = `${proto}//${host}:${port}${path}`;
  }
  let url = `${baseUrl}${sub.subId}`;
  if (sub.password) url += `?pwd=${sub.password}`;
  try {
    await navigator.clipboard.writeText(url);
    message.success(t('subLinkCopied'));
  } catch {
    message.error(t('subCopyFailed'));
  }
}

function formatTs(ts) {
  if (!ts || ts === 0) return '-';
  const currentLocale = locale?.value || navigator.language || 'en';
  let tz = allSetting?.timeLocation;
  if (!tz || tz === 'Local') {
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { tz = undefined; }
  }
  const opts = {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  };
  if (tz) opts.timeZone = tz;
  try {
    return new Date(ts).toLocaleString(currentLocale, opts);
  } catch {
    return new Date(ts).toLocaleString(currentLocale, { ...opts, timeZone: undefined });
  }
}

const tableData = computed(() => {
  const now = Date.now();
  const enabledIds = new Set((allInbounds.value || []).filter(ib =>
    ib.enable && (ib.expiryTime <= 0 || now < ib.expiryTime)
  ).map(ib => ib.id));
  // Pre-build inbound data map + client lookups per inbound
  const inboundMap = {};
  const clientEmailMap = {};
  const clientActiveMap = {};  // inboundId → { clientId → { enable, expiryTime } }
  for (const ib of allInbounds.value || []) {
    inboundMap[ib.id] = ib;
    clientEmailMap[ib.id] = {};
    clientActiveMap[ib.id] = {};
    try {
      const raw = typeof ib.settings === 'string' ? JSON.parse(ib.settings) : (ib.settings || {});
      for (const c of (raw.clients || [])) {
        const key = c.id || c.clientId;
        if (key && c.email) {
          clientEmailMap[ib.id][key] = c.email;
          clientActiveMap[ib.id][key] = {
            enable: c.enable !== false,
            expiryTime: c.expiryTime || 0,
          };
        }
      }
    } catch (_e) { /* skip corrupt settings */ }
  }
  return subscriptions.value.map(s => {
    // Parse inboundIds which may be "inboundId" or "inboundId:clientId"
    const inboundIds = new Set();
    const clientRefs = {};
    let totalClientCount = 0;
    let activeClientCount = 0;
    for (const part of (s.inboundIds || '').split(',').filter(Boolean)) {
      const segments = part.split(':');
      const id = parseInt(segments[0]);
      if (!id) continue;
      inboundIds.add(id);
      if (segments.length === 2) {
        const clientId = segments[1];
        if (clientId && clientId !== '') {
          totalClientCount++;
          if (!clientRefs[id]) clientRefs[id] = [];
          clientRefs[id].push(clientId);
        }
      }
    }
    const enabledSubIds = [...inboundIds].filter(id => enabledIds.has(id));
    // Traffic and quota — compute from active clients or whole inbounds
    let sumDown = 0, sumUp = 0, sumTotal = 0;
    for (const id of enabledSubIds) {
      const ib = inboundMap[id];
      if (!ib) continue;
      const stats = Array.isArray(ib.clientStats) ? ib.clientStats : [];
      const selectedClientIds = clientRefs[id];
      if (!selectedClientIds || selectedClientIds.length === 0) {
        // Whole inbound selected — sum all clientStats, fallback to inbound-level
        if (stats.length > 0) {
          for (const st of stats) { sumUp += Number(st.up || 0); sumDown += Number(st.down || 0); }
        } else {
          sumUp += Number(ib.up || 0); sumDown += Number(ib.down || 0);
        }
        sumTotal += Number(ib.total || 0);
        // Count all enabled clients in this inbound
        const allClientIds = Object.keys(clientEmailMap[id] || {});
        totalClientCount += allClientIds.length;
        for (const cid of allClientIds) {
          const info = clientActiveMap[id]?.[cid];
          if (info && ib.enable && info.enable &&
              (ib.expiryTime <= 0 || now < ib.expiryTime) &&
              (info.expiryTime <= 0 || now < info.expiryTime)) {
            activeClientCount++;
          }
        }
      } else {
        // Client-level selection — match by email via clientEmailMap
        let sumClientQuota = 0;
        for (const cid of selectedClientIds) {
          const email = clientEmailMap[id]?.[cid];
          if (!email) continue;
          const st = stats.find(s => s.email === email);
          if (st) {
            sumUp += Number(st.up || 0);
            sumDown += Number(st.down || 0);
            sumClientQuota += Number(st.total || 0);
          }
          // Count as active only if both inbound and client are active
          const clientInfo = clientActiveMap[id]?.[cid];
          if (clientInfo && ib.enable && clientInfo.enable &&
              (ib.expiryTime <= 0 || now < ib.expiryTime) &&
              (clientInfo.expiryTime <= 0 || now < clientInfo.expiryTime)) {
            activeClientCount++;
          }
        }
        // Quota = min(client-sum, inbound-total) when inbound has a limit
        const ibTotal = Number(ib.total || 0);
        sumTotal += ibTotal > 0 ? Math.min(sumClientQuota, ibTotal) : sumClientQuota;
      }
    }
    return Object.assign(s, {
      inboundCount: enabledSubIds.length,
      totalInboundCount: inboundIds.size,
      clientCount: activeClientCount,
      totalClientCount,
      trafficDown: sumDown,
      trafficUp: sumUp,
      quotaTotal: sumTotal,
      expiryTimeDisplay: s.expiryTime > 0 ? formatTs(s.expiryTime) : t('subNeverExpire'),
      createdAtDisplay: formatTs(s.createdAt),
      lastUsedDisplay: s.lastUsedAt > 0 ? formatTs(s.lastUsedAt) : '-',
    });
  });
});
</script>

<template>
  <a-config-provider :theme="antdThemeConfig">
    <a-layout class="subs-page" :class="{ 'is-dark': themeState.isDark, 'is-ultra': themeState.isUltra }">
      <AppSidebar :base-path="basePath" :request-uri="requestUri" />

      <a-layout class="content-shell">
        <a-layout-content id="content-layout" class="content-area">
          <a-spin :spinning="!fetched" :delay="200" tip="Loading…" size="large">
            <div v-if="!fetched" class="loading-spacer" />

            <a-row v-else :gutter="[isMobile ? 8 : 16, isMobile ? 8 : 12]">
              <a-col :span="24">
                <a-card size="small" hoverable class="summary-card">
                  <a-row :gutter="[16, isMobile ? 16 : 12]">
                    <a-col :xs="12" :sm="12" :md="8">
                      <CustomStatistic :title="t('subTotal')" :value="String(totals.total)">
                        <template #prefix><CloudServerOutlined /></template>
                      </CustomStatistic>
                    </a-col>
                    <a-col :xs="12" :sm="12" :md="8">
                      <CustomStatistic :title="t('subEnabled')" :value="String(totals.enabled)">
                        <template #prefix><CheckCircleOutlined style="color: #52c41a" /></template>
                      </CustomStatistic>
                    </a-col>
                    <a-col :xs="12" :sm="12" :md="8">
                      <CustomStatistic :title="t('subDisabled')" :value="String(totals.total - totals.enabled)">
                        <template #prefix><CloseCircleOutlined style="color: #ff4d4f" /></template>
                      </CustomStatistic>
                    </a-col>
                  </a-row>
                </a-card>
              </a-col>

              <a-col :span="24">
                <a-card hoverable>
                  <template #title>
                    <a-button type="primary" :disabled="subDisabled" @click="onAdd">
                      <template #icon><PlusOutlined /></template>
                      {{ t('subCreate') }}
                    </a-button>
                  </template>
                  <a-alert v-if="subDisabled" type="warning" show-icon :message="t('subServiceDisabled')"
                    :description="t('subServiceDisabledDesc')"
                    style="margin-bottom:16px" banner />

                  <!-- Desktop: a-table -->
                  <a-table ref="tableWrapperRef" v-if="!isMobile" :data-source="tableData" :columns="columns" :loading="loading"
                    :pagination="{ pageSize: 50 }" :row-key="(r) => r.id" size="small" :scroll="{ x: 900, y: tableScrollY }">
                    <template #bodyCell="{ column, record }">
                      <template v-if="column.key === 'index'">{{ tableData.indexOf(record) + 1 }}</template>
                      <template v-if="column.key === 'name'">
                        <div>
                          <div style="font-weight:500;font-size:13px">{{ record.title || '-' }}</div>
                          <div style="font-size:11px;color:#888">{{ record.remark || '' }}</div>
                        </div>
                      </template>
                      <template v-if="column.key === 'enable'">
                        <a-switch :checked="record.enable" :disabled="subDisabled"
                          :class="expiredSubIds[record.id] ? 'sub-expired-switch' : ''"
                          @change="(v) => onToggleEnable(record, v)" />
                      </template>
                      <template v-if="column.key === 'format'">
                        <a-tag>{{ record.format }}</a-tag>
                      </template>
                      <template v-if="column.key === 'inboundCount'">
                        <span v-if="record.inboundCount === record.totalInboundCount">{{ record.inboundCount }}</span>
                        <span v-else>{{ record.inboundCount }}/{{ record.totalInboundCount }}
                          <span style="color:#ff4d4f;margin-left:2px" title="部分入站已禁用/过期">⚠</span>
                        </span>
                      </template>
                      <template v-if="column.key === 'clientCount'">
                        <span v-if="record.clientCount === record.totalClientCount">{{ record.clientCount }}</span>
                        <span v-else>{{ record.clientCount }}/{{ record.totalClientCount }}
                          <span style="color:#ff4d4f;margin-left:2px" title="部分客户端已禁用/过期">⚠</span>
                        </span>
                      </template>
                      <template v-if="column.key === 'traffic'">
                        <a-popover>
                          <template #content>
                            <table cellpadding="2">
                              <tbody>
                                <tr><td>↑ {{ SizeFormatter.sizeFormat(record.trafficUp || 0) }}</td><td>↓ {{ SizeFormatter.sizeFormat(record.trafficDown || 0) }}</td></tr>
                                <tr v-if="record.quotaTotal > 0">
                                  <td>{{ t('remained') }}</td>
                                  <td>{{ SizeFormatter.sizeFormat(Math.max(0, record.quotaTotal - record.trafficDown - record.trafficUp)) }}</td>
                                </tr>
                              </tbody>
                            </table>
                          </template>
                          <a-tag :color="trafficTagColor(record)">
                            {{ SizeFormatter.sizeFormat(record.trafficDown + record.trafficUp) }} /
                            <template v-if="record.quotaTotal > 0">{{ SizeFormatter.sizeFormat(record.quotaTotal) }}</template>
                            <InfinityIcon v-else />
                          </a-tag>
                        </a-popover>
                      </template>
                      <template v-if="column.key === 'expiryTime'">
                        <a-tag v-if="record.expiryTime > 0 && Date.now() > record.expiryTime" color="red">{{ t('subExpired') }}</a-tag>
                        <span v-else>{{ record.expiryTimeDisplay }}</span>
                      </template>
                      <template v-if="column.key === 'callCount'">
                        <span>{{ record.callCount || 0 }}</span>
                      </template>
                      <template v-if="column.key === 'actions'">
                        <a-space>
                          <a-tooltip :title="t('subCopyLink')">
                            <a-button type="text" size="small" :disabled="subDisabled" @click="onCopyLink(record)">
                              <template #icon><CopyOutlined /></template>
                            </a-button>
                          </a-tooltip>
                          <a-tooltip :title="t('subEdit')">
                            <a-button type="text" size="small" :disabled="subDisabled" @click="onEdit(record)">
                              <template #icon><EditOutlined /></template>
                            </a-button>
                          </a-tooltip>
                          <a-tooltip :title="t('subDel')">
                            <a-button type="text" size="small" danger :disabled="subDisabled" @click="onDelete(record)">
                              <template #icon><DeleteOutlined /></template>
                            </a-button>
                          </a-tooltip>
                        </a-space>
                      </template>
                    </template>
                  </a-table>

                  <!-- Mobile: card list -->
                  <div v-else class="sub-cards">
                    <div v-if="tableData.length === 0" class="card-empty">—</div>
                    <div v-for="record in tableData" :key="record.id" class="sub-card">
                      <div class="card-head">
                        <div class="card-title">
                          <div class="title-text">{{ record.title || '-' }}</div>
                          <div class="remark-text">{{ record.remark || '' }} <a-tag style="font-size:10px">{{ record.format }}</a-tag></div>
                        </div>
                        <div class="card-actions">
                          <a-tooltip :title="t('info')">
                            <InfoCircleOutlined class="row-action-trigger" @click="openDetail(record)" />
                          </a-tooltip>
                          <a-switch :checked="record.enable" :disabled="subDisabled" size="small"
                            :class="expiredSubIds[record.id] ? 'sub-expired-switch' : ''"
                            @change="(v) => onToggleEnable(record, v)" />
                          <a-dropdown :trigger="['click']" placement="bottomRight">
                            <MoreOutlined class="row-action-trigger" @click.prevent />
                            <template #overlay>
                              <a-menu>
                                <a-menu-item key="copy" @click="onCopyLink(record)">
                                  <CopyOutlined /> {{ t('subCopyLink') }}
                                </a-menu-item>
                                <a-menu-item key="edit" @click="onEdit(record)">
                                  <EditOutlined /> {{ t('subEdit') }}
                                </a-menu-item>
                                <a-menu-item key="delete" class="danger-item" @click="onDelete(record)">
                                  <DeleteOutlined /> {{ t('subDel') }}
                                </a-menu-item>
                              </a-menu>
                            </template>
                          </a-dropdown>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Mobile: detail modal -->
                  <a-modal v-if="isMobile" :open="!!detailSub" :footer="null" :width="360" centered
                    :title="detailSub?.title || ''" @cancel="closeDetail">
                    <div v-if="detailSub" class="card-stats">
                      <div v-if="detailSub.remark" class="stat-row">
                        <span class="stat-label">{{ t('remark') }}</span>
                        <span>{{ detailSub.remark }}</span>
                      </div>
                      <div class="stat-row">
                        <span class="stat-label">{{ t('subFormat') }}</span>
                        <a-tag>{{ detailSub.format }}</a-tag>
                      </div>
                      <div class="stat-row">
                        <span class="stat-label">{{ t('subStatus') }}</span>
                        <a-badge :status="detailSub.enable ? 'success' : 'default'" />
                        <span>{{ detailSub.enable ? t('enabled') : t('disabled') }}</span>
                      </div>
                      <div class="stat-row">
                        <span class="stat-label">{{ t('subInboundCount') }}</span>
                        <span v-if="detailSub.inboundCount === detailSub.totalInboundCount">{{ detailSub.inboundCount }}</span>
                        <span v-else>{{ detailSub.inboundCount }} / {{ detailSub.totalInboundCount }} ⚠</span>
                      </div>
                      <div class="stat-row">
                        <span class="stat-label">{{ t('subClients') }}</span>
                        <span v-if="detailSub.clientCount === detailSub.totalClientCount">{{ detailSub.clientCount }}</span>
                        <span v-else>{{ detailSub.clientCount }} / {{ detailSub.totalClientCount }} ⚠</span>
                      </div>
                      <div class="stat-row">
                        <span class="stat-label">{{ t('subTraffic') }}</span>
                        <a-tag color="blue">↓ {{ SizeFormatter.sizeFormat(detailSub.trafficDown || 0) }}</a-tag>
                        <a-tag color="orange">↑ {{ SizeFormatter.sizeFormat(detailSub.trafficUp || 0) }}</a-tag>
                      </div>
                      <div class="stat-row">
                        <span class="stat-label">{{ t('usage') }}</span>
                        <a-tag :color="trafficTagColor(detailSub)">
                          {{ SizeFormatter.sizeFormat((detailSub.trafficDown || 0) + (detailSub.trafficUp || 0)) }} /
                          <template v-if="detailSub.quotaTotal > 0">{{ SizeFormatter.sizeFormat(detailSub.quotaTotal) }}</template>
                          <InfinityIcon v-else />
                        </a-tag>
                      </div>
                      <div class="stat-row">
                        <span class="stat-label">{{ t('subExpiryTime') }}</span>
                        <a-tag v-if="detailSub.expiryTime > 0 && Date.now() > detailSub.expiryTime" color="red">{{ t('subExpired') }}</a-tag>
                        <span v-else>{{ detailSub.expiryTimeDisplay }}</span>
                      </div>
                      <div class="stat-row">
                        <span class="stat-label">{{ t('subLastUsed') }}</span>
                        <span>{{ detailSub.lastUsedDisplay }}</span>
                      </div>
                      <div class="stat-row">
                        <span class="stat-label">{{ t('subOnlineCount') }}</span>
                        <span>{{ detailSub.callCount || 0 }}</span>
                      </div>
                      <div class="stat-row">
                        <span class="stat-label">{{ t('subCreatedAt') }}</span>
                        <span>{{ detailSub.createdAtDisplay }}</span>
                      </div>
                      <div class="modal-actions">
                        <a-button size="small" :disabled="subDisabled" @click="onCopyLink(detailSub); closeDetail()">
                          <template #icon><CopyOutlined /></template>
                          {{ t('subCopyLink') }}
                        </a-button>
                        <a-button size="small" :disabled="subDisabled" @click="closeDetail(); onEdit(detailSub)">
                          <template #icon><EditOutlined /></template>
                          {{ t('subEdit') }}
                        </a-button>
                        <a-button size="small" danger :disabled="subDisabled" @click="closeDetail(); onDelete(detailSub)">
                          <template #icon><DeleteOutlined /></template>
                          {{ t('subDel') }}
                        </a-button>
                      </div>
                    </div>
                  </a-modal>
                </a-card>
              </a-col>
            </a-row>
          </a-spin>
        </a-layout-content>
      </a-layout>

      <SubscriptionFormModal v-model:open="formOpen" :mode="formMode" :subscription="formSub" :save="onSave" />
    </a-layout>
  </a-config-provider>
</template>

<style scoped>
.subs-page {
  --bg-page: #e6e8ec;
  --bg-card: #ffffff;
  min-height: 100vh;
  background: var(--bg-page);
}
.subs-page.is-dark {
  --bg-page: #1e1e1e;
  --bg-card: #252526;
}
.subs-page.is-dark.is-ultra {
  --bg-page: #050505;
  --bg-card: #0c0e12;
}
.subs-page :deep(.ant-layout),
.subs-page :deep(.ant-layout-content) {
  background: transparent;
}
.content-shell { background: transparent; }
.content-area { padding: 24px; }
.loading-spacer { min-height: calc(100vh - 120px); }
.summary-card { padding: 16px; }
.sub-expired-switch { opacity: 0.4; }
.sub-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sub-card {
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 10px;
  padding: 10px 8px;
  background: rgba(255, 255, 255, 0.02);
}

:global(body.dark) .sub-card {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.1);
}

.card-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-title {
  flex: 1;
  min-width: 0;
}

.title-text {
  font-weight: 600;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remark-text {
  font-size: 11px;
  opacity: 0.55;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.row-action-trigger {
  font-size: 20px;
  cursor: pointer;
}

.card-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.stat-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.6;
  min-width: 72px;
  flex-shrink: 0;
}

.card-stats :deep(.ant-tag) {
  margin: 0;
}

.card-empty {
  text-align: center;
  opacity: 0.4;
}

.modal-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(128, 128, 128, 0.15);
}

@media (max-width: 768px) {
  .content-area { padding: 8px; }
  .summary-card { padding: 8px; }
}
</style>
