<script setup>
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Modal, message } from 'ant-design-vue';
import {
  SwapOutlined,
  PieChartOutlined,
  HistoryOutlined,
  BarsOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue';

import { HttpUtil, SizeFormatter, RandomUtil } from '@/utils';
import { Inbound } from '@/models/inbound.js';
import { theme as themeState, antdThemeConfig } from '@/composables/useTheme.js';
import { useMediaQuery } from '@/composables/useMediaQuery.js';
import AppSidebar from '@/components/AppSidebar.vue';
import CustomStatistic from '@/components/CustomStatistic.vue';
import { useNodeList } from '@/composables/useNodeList.js';
import InboundList from './InboundList.vue';
import InboundFormModal from './InboundFormModal.vue';
import ClientFormModal from './ClientFormModal.vue';
import ClientBulkModal from './ClientBulkModal.vue';
import CopyClientsModal from './CopyClientsModal.vue';
import BatchEditModal from './BatchEditModal.vue';
import InboundInfoModal from './InboundInfoModal.vue';
import QrCodeModal from './QrCodeModal.vue';
import TextModal from '@/components/TextModal.vue';
import PromptModal from '@/components/PromptModal.vue';
import { useInbounds } from './useInbounds.js';
import { useWebSocket } from '@/composables/useWebSocket.js';

const SubscriptionFormModal = defineAsyncComponent(() =>
  import('@/pages/subscription/SubscriptionFormModal.vue').catch((err) => {
    console.error('[ASYNC] SubscriptionFormModal chunk load/eval failed:', err);
    throw err;
  }));

const { t } = useI18n();

const {
  fetched,
  dbInbounds,
  clientCount,
  onlineClients,
  totals,
  expireDiff,
  trafficDiff,
  pageSize,
  subSettings,
  tgBotEnable,
  ipLimitEnable,
  remarkModel,
  lastOnlineMap,
  statsVersion,
  refresh,
  fetchDefaultSettings,
  applyTrafficEvent,
  applyClientStatsEvent,
  applyInvalidate,
  applyInboundsEvent,
} = useInbounds();

// Live updates over WebSocket — replaces the old 5s polling loop.
// The backend pushes traffic + per-client deltas every ~10s; we merge
// them into the local refs in-place so counters and online badges
// update without re-fetching the whole list.
useWebSocket({
  traffic: applyTrafficEvent,
  client_stats: applyClientStatsEvent,
  invalidate: applyInvalidate,
  inbounds: applyInboundsEvent,
});
const { isMobile } = useMediaQuery();
// Node list lives on the central panel; the Inbounds page consumes
// the id→node map for the new "Node" column. Fetched once on mount.
const { byId: nodesById, hasActive: hasActiveNode } = useNodeList();

const basePath = window.X_UI_BASE_PATH || '';
const requestUri = window.location.pathname;

onMounted(async () => {
  await fetchDefaultSettings();
  await refresh();
});

// === Add/Edit modal ===================================================
const formOpen = ref(false);
const formMode = ref('add');
const formDbInbound = ref(null);

// === Client modal (single + bulk) =====================================
const clientOpen = ref(false);
const clientMode = ref('add');
const clientDbInbound = ref(null);
const clientIndex = ref(null);

const bulkOpen = ref(false);
const bulkDbInbound = ref(null);
const copyOpen = ref(false);
const copyDbInbound = ref(null);

// === Info / QR-code modals ===========================================
const infoOpen = ref(false);
const infoDbInbound = ref(null);
const infoClientIndex = ref(0);

const qrOpen = ref(false);
const qrDbInbound = ref(null);
const qrClient = ref(null);

// hostOverrideFor returns the node's address for a node-managed inbound,
// or '' when the inbound runs locally. Wired into the QR / Info modals
// and into export-all-links functions so generated share links point at
// the node, not the central panel.
function hostOverrideFor(dbInbound) {
  if (!dbInbound || dbInbound.nodeId == null) return '';
  return nodesById.value.get(dbInbound.nodeId)?.address || '';
}

const infoNodeAddress = computed(() => hostOverrideFor(infoDbInbound.value));
const qrNodeAddress = computed(() => hostOverrideFor(qrDbInbound.value));

// === Subscription form modal ============================================
const subFormOpen = ref(false);
const subFormMode = ref('add');
const subFormData = ref(null);

// === Row selection state ================================================
const selectedIds = ref([]);
const selectedClientIds = ref({});

function getSelectedInbounds() {
  if (selectedIds.value.length > 0) {
    return selectedIds.value
      .map(id => dbInbounds.value.find(ib => ib.id === id))
      .filter(Boolean);
  }
  return [];
}

function onClientSelectionChange({ inboundId, ids }) {
  selectedClientIds.value = { ...selectedClientIds.value, [inboundId]: ids };
  if (ids.length === 0) {
    selectedIds.value = selectedIds.value.filter(id => id !== inboundId);
  } else if (!selectedIds.value.includes(inboundId)) {
    selectedIds.value = [...selectedIds.value, inboundId];
  }
}

// Trigger a shallowRef re-render after an enable-switch optimistic update,
// so the switch :checked binding updates immediately without waiting for
// the next WebSocket broadcast.
function onToggleEnable() {
  dbInbounds.value = [...dbInbounds.value];
}

async function onSubSave(payload) {
  const { useSubscription } = await import('@/pages/subscription/useSubscription.js');
  const { create: createSub, update: updateSub } = useSubscription();
  let msg;
  if (subFormMode.value === 'edit' && subFormData.value?.id) {
    msg = await updateSub(subFormData.value.id, payload);
  } else {
    msg = await createSub(payload);
  }
  if (msg?.success) {
    message.success('订阅已创建');
  }
  return msg;
}

// === Enable-switch race guard =========================================
// When the enable-switch calls setEnable, the backend sends an invalidate
// WebSocket event that triggers refresh(). But the refresh() may fetch
// stale data (before the DB commit is visible). Prevent this race by
// suppressing the next invalidate within a short window.
let skipNextInvalidate = false;
window.__setSkipInvalidate = (dur) => {
  skipNextInvalidate = true;
  setTimeout(() => { skipNextInvalidate = false; }, dur || 500);
};
window.__skipNextInvalidate = () => {
  if (skipNextInvalidate) { skipNextInvalidate = false; return true; }
  return false;
};

// === Shared text + prompt modal state =================================
const textOpen = ref(false);
const textTitle = ref('');
const textContent = ref('');
const textFileName = ref('');

const promptOpen = ref(false);
const promptTitle = ref('');
const promptOkText = ref('OK');
const promptType = ref('textarea');
const promptInitial = ref('');
const promptLoading = ref(false);
let promptHandler = null;

function openText({ title, content, fileName = '' }) {
  textTitle.value = title;
  textContent.value = content;
  textFileName.value = fileName;
  textOpen.value = true;
}

function openPrompt({ title, okText, type = 'textarea', value = '', confirm }) {
  promptTitle.value = title;
  promptOkText.value = okText || 'OK';
  promptType.value = type;
  promptInitial.value = value;
  promptHandler = confirm;
  promptOpen.value = true;
}

async function onPromptConfirm(value) {
  if (!promptHandler) { promptOpen.value = false; return; }
  promptLoading.value = true;
  try {
    const ok = await promptHandler(value);
    if (ok !== false) promptOpen.value = false;
  } finally {
    promptLoading.value = false;
  }
}

// === Export helpers — mirror legacy txtModal call sites ==============
function exportInboundLinks(dbInbound) {
  const projected = checkFallback(dbInbound);
  openText({
    title: t('pages.inbounds.exportInbound'),
    content: projected.genInboundLinks(remarkModel.value, hostOverrideFor(dbInbound)),
    fileName: projected.remark || 'inbound',
  });
}

function exportInboundClipboard(dbInbound) {
  openText({
    title: 'Inbound JSON',
    content: JSON.stringify(dbInbound, null, 2),
  });
}

function exportInboundSubs(dbInbound) {
  const inbound = dbInbound.toInbound();
  const clients = inbound?.clients || [];
  const subLinks = [];
  for (const c of clients) {
    if (c.subId && subSettings.value.subURI) {
      subLinks.push(subSettings.value.subURI + c.subId);
    }
  }
  openText({
    title: 'Export subscription links',
    content: [...new Set(subLinks)].join('\n'),
    fileName: `${dbInbound.remark || 'inbound'}-Subs`,
  });
}

function exportAllLinks() {
  const out = [];
  for (const ib of dbInbounds.value) {
    if (!selectedIds.value.includes(ib.id)) continue;
    const clientKeys = selectedClientIds.value[ib.id];
    const hasSelectedClients = clientKeys && clientKeys.length > 0;
    const links = ib.genInboundLinks(remarkModel.value, hostOverrideFor(ib), hasSelectedClients ? clientKeys : null);
    if (links) out.push(links);
  }
  openText({
    title: t('pages.inbounds.exportAllLinks'),
    content: out.join('\r\n'),
    fileName: t('subAllInbounds'),
  });
}

function exportAllSubs() {
  // Use the current row selection to pre-populate the subscription form:
  // - checked inbound row → whole inbound (id as number)
  // - checked client box → that specific client ("inboundId:clientId")
  //
  // selectedClientIds stores rowKey strings (email). The subscription form
  // expects numeric clientId — build a lookup map from settings JSON.
  const emailToClientId = {};
  for (const dbIb of dbInbounds.value) {
    try {
      const raw = typeof dbIb.settings === 'string' ? JSON.parse(dbIb.settings) : (dbIb.settings || {});
      for (const c of (raw.clients || [])) {
        if (c.email && c.clientId) emailToClientId[`${dbIb.id}:${c.email}`] = c.clientId;
      }
    } catch (_e) { /* skip corrupt settings */ }
  }
  const preselect = [];
  const ids = selectedIds.value;
  const sc = selectedClientIds.value;
  for (const id of ids) {
    const clientEmails = sc[id];
    if (clientEmails && clientEmails.length > 0) {
      for (const email of clientEmails) {
        const cid = emailToClientId[`${id}:${email}`];
        if (cid) preselect.push(`${id}:${cid}`);
      }
    } else {
      preselect.push(id);
    }
  }
  subFormMode.value = 'add';
  subFormData.value = null;
  window.__subPreselectIds = preselect;
  subFormOpen.value = true;
}

function importInbound() {
  openPrompt({
    title: t('pages.inbounds.importInbound'),
    okText: t('pages.inbounds.import'),
    type: 'textarea',
    value: '',
    confirm: async (value) => {
      const msg = await HttpUtil.post('/panel/api/inbounds/import', { data: value });
      if (msg?.success) {
        await refresh();
        return true;
      }
      return false;
    },
  });
}

// `checkFallback` mirrors the legacy helper: when an inbound listens
// on a unix-socket fallback (`@<name>`), point the link generator at
// the root inbound that owns the listen address so QRs/links carry
// the externally-reachable host:port and the right TLS state.
function checkFallback(dbInbound) {
  // We don't keep parsed Inbounds in state right now (the page works
  // off DBInbounds); compute on the fly.
  if (!dbInbound.listen?.startsWith?.('@')) return dbInbound;
  for (const candidate of dbInbounds.value) {
    if (candidate.id === dbInbound.id) continue;
    const parsed = candidate.toInbound();
    if (!parsed.isTcp) continue;
    if (!['trojan', 'vless'].includes(parsed.protocol)) continue;
    const fallbacks = parsed.settings.fallbacks || [];
    if (!fallbacks.find((f) => f.dest === dbInbound.listen)) continue;
    // Build a one-off DBInbound copy with the parent's listen/port +
    // copied stream so the link gen sees the public endpoint.
    const projected = JSON.parse(JSON.stringify(dbInbound));
    projected.listen = candidate.listen;
    projected.port = candidate.port;
    const inheritedStream = parsed.stream;
    const ownInbound = dbInbound.toInbound();
    ownInbound.stream.security = inheritedStream.security;
    ownInbound.stream.tls = inheritedStream.tls;
    ownInbound.stream.externalProxy = inheritedStream.externalProxy;
    projected.streamSettings = ownInbound.stream.toString();
    // Re-wrap so callers get the same DBInbound shape they had.
    return new dbInbound.constructor(projected);
  }
  return dbInbound;
}

function findClientIndex(dbInbound, client) {
  if (!client) return 0;
  const inbound = dbInbound.toInbound();
  const clients = inbound?.clients || [];
  const idx = clients.findIndex((c) => {
    if (!c) return false;
    switch (dbInbound.protocol) {
      case 'trojan':
      case 'shadowsocks':
        return c.password === client.password && c.email === client.email;
      default:
        return c.id === client.id && c.email === client.email;
    }
  });
  return idx >= 0 ? idx : 0;
}

function getClientId(protocol, client) {
  switch (protocol) {
    case 'trojan': return client.password;
    case 'shadowsocks': return client.email;
    case 'hysteria': return client.auth;
    default: return client.id;
  }
}

// === Per-client handlers (called from the expand-row table) =========
function onEditClient({ dbInbound, client }) {
  clientMode.value = 'edit';
  clientDbInbound.value = dbInbound;
  clientIndex.value = findClientIndex(dbInbound, client);
  clientOpen.value = true;
}

function onQrcodeClient({ dbInbound, client }) {
  qrDbInbound.value = checkFallback(dbInbound);
  qrClient.value = client || null;
  qrOpen.value = true;
}

function onInfoClient({ dbInbound, client }) {
  infoDbInbound.value = checkFallback(dbInbound);
  infoClientIndex.value = findClientIndex(dbInbound, client);
  infoOpen.value = true;
}

async function onResetTrafficClient({ dbInbound, client }) {
  const msg = await HttpUtil.post(
    `/panel/api/inbounds/${dbInbound.id}/resetClientTraffic/${client.email}`,
  );
  if (msg?.success) await refresh();
}

async function onDeleteClient({ dbInbound, client, force }) {
  const clientId = getClientId(dbInbound.protocol, client);
  const endpoint = force
    ? `/panel/api/inbounds/${dbInbound.id}/forceDelClient/${clientId}`
    : `/panel/api/inbounds/${dbInbound.id}/delClient/${clientId}`;
  const msg = await HttpUtil.post(endpoint);
  if (msg?.success) await refresh();
}

async function onDeleteClients({ dbInbound, clients }) {
  for (const client of clients) {
    const clientId = getClientId(dbInbound.protocol, client);
    await HttpUtil.post(`/panel/api/inbounds/${dbInbound.id}/delClient/${clientId}`);
  }
  await refresh();
}

async function onToggleEnableClient({ dbInbound, client, next }) {
  // Mirror legacy: clone the parsed inbound, flip enable on the matching
  // client, and post the whole client back through updateClient. This
  // keeps the wire shape identical to the modal save path.
  const inbound = dbInbound.toInbound();
  const clients = inbound?.clients || [];
  const idx = findClientIndex(dbInbound, client);
  if (idx < 0 || !clients[idx]) return;
  clients[idx].enable = next;
  const clientId = getClientId(dbInbound.protocol, clients[idx]);
  const msg = await HttpUtil.post(`/panel/api/inbounds/updateClient/${clientId}`, {
    id: dbInbound.id,
    settings: `{"clients": [${clients[idx].toString()}]}`,
  });
  if (msg?.success) await refresh();
}

function onAddInbound() {
  formMode.value = 'add';
  formDbInbound.value = null;
  formOpen.value = true;
}

function openEdit(dbInbound) {
  formMode.value = 'edit';
  formDbInbound.value = dbInbound;
  formOpen.value = true;
}

function openAddClient(dbInbound) {
  clientMode.value = 'add';
  clientDbInbound.value = dbInbound;
  clientIndex.value = null;
  clientOpen.value = true;
}

function openAddBulkClient(dbInbound) {
  bulkDbInbound.value = dbInbound;
  bulkOpen.value = true;
}

// Per-row destructive actions go through Modal.confirm (matches legacy).
async function confirmDelete(dbInbound) {
  let subRows = '';

  try {
    const resp = await HttpUtil.get(`/panel/api/inbounds/checkSubscriptions/${dbInbound.id}`);
    if (resp?.success && resp.obj?.subscriptions?.length > 0) {
      const subs = resp.obj.subscriptions;
      const fmtSub = (s) => `${s.remark || s.subId} (${s.subId})`;
      const willUpdate = subs.filter(s => !s.onlyOne);
      const willDelete = subs.filter(s => s.onlyOne);
      const isMulti = dbInbound.isMultiUser();
      const clientWord = isMulti ? t('pages.inbounds.batch.subWillRemoveInboundClientsSuffix') : '';

      if (willUpdate.length > 0) {
        subRows += `${isMulti ? t('pages.inbounds.batch.subWillRemoveInboundClients') : t('pages.inbounds.batch.subWillRemoveInbound')}:\n${willUpdate.map(fmtSub).join(', ')}`;
      }
      if (willDelete.length > 0) {
        if (subRows) subRows += '\n\n';
        subRows += `${isMulti ? t('pages.inbounds.batch.subWillDeleteInboundClients') : t('pages.inbounds.batch.subWillDeleteInbound')}:\n${willDelete.map(fmtSub).join(', ')}`;
      }
    }
  } catch (_e) { /* proceed without subscription info */ }

  const hasSubs = subRows !== '';

  Modal.confirm({
    title: `Delete inbound "${dbInbound.remark}"?`,
    content: subRows || 'This removes the inbound and all its clients. This cannot be undone.',
    okText: 'Delete',
    okType: 'danger',
    cancelText: 'Cancel',
    onOk: async () => {
      const endpoint = hasSubs
        ? `/panel/api/inbounds/forceDel/${dbInbound.id}`
        : `/panel/api/inbounds/del/${dbInbound.id}`;
      const msg = await HttpUtil.post(endpoint);
      if (msg?.success) await refresh();
    },
  });
}

function confirmResetTraffic(dbInbound) {
  Modal.confirm({
    title: `Reset traffic for "${dbInbound.remark}"?`,
    content: 'Resets up/down counters to 0 for this inbound.',
    okText: 'Reset',
    cancelText: 'Cancel',
    onOk: async () => {
      const msg = await HttpUtil.post(`/panel/api/inbounds/${dbInbound.id}/resetTraffic`);
      if (msg?.success) await refresh();
    },
  });
}

function confirmDelDepleted(dbInboundId) {
  Modal.confirm({
    title: 'Delete depleted clients?',
    content: 'Removes every client whose traffic is exhausted or whose expiry has passed.',
    okText: 'Delete',
    okType: 'danger',
    cancelText: 'Cancel',
    onOk: async () => {
      const msg = await HttpUtil.post(`/panel/api/inbounds/delDepletedClients/${dbInboundId}`);
      if (msg?.success) await refresh();
    },
  });
}

// Clone — adds a new inbound with the same protocol+stream+sniffing
// but a fresh remark/port and an empty client list.
function confirmClone(dbInbound) {
  Modal.confirm({
    title: `Clone inbound "${dbInbound.remark}"?`,
    content: 'Creates a copy with a new port and an empty client list.',
    okText: 'Clone',
    cancelText: 'Cancel',
    onOk: async () => {
      const baseInbound = dbInbound.toInbound();
      const data = {
        up: 0,
        down: 0,
        total: 0,
        remark: `${dbInbound.remark} (clone)`,
        enable: false,
        expiryTime: 0,
        listen: '',
        port: RandomUtil.randomInteger(10000, 60000),
        protocol: baseInbound.protocol,
        settings: Inbound.Settings.getSettings(baseInbound.protocol).toString(),
        streamSettings: baseInbound.stream.toString(),
        sniffing: baseInbound.sniffing.toString(),
      };
      const msg = await HttpUtil.post('/panel/api/inbounds/add', data);
      if (msg?.success) await refresh();
    },
  });
}

// === Batch operations =================================================
function getIntClientIdFromSettings(settingsStr, client) {
  try {
    const raw = typeof settingsStr === 'string' ? JSON.parse(settingsStr) : (settingsStr || {});
    const clients = raw.clients || [];
    const email = client.email;
    if (email) {
      const found = clients.find(c => c.email === email);
      if (found?.clientId) return found.clientId;
    }
    const clientKey = client.id || client.password || client.auth;
    if (clientKey) {
      for (const c of clients) {
        if (c.id === clientKey || c.password === clientKey || c.auth === clientKey) {
          if (c.clientId) return c.clientId;
        }
      }
    }
  } catch (_e) { /* ignore */ }
  return 0;
}

async function onBatchDeleteInbounds() {
  const ids = selectedIds.value;
  if (ids.length < 2) return;
  const fmtSub = (s) => `${s.remark || s.subId} (${s.subId})`;
  const subInfoByInbound = {}; // inboundId -> { willUpdate: [], willDelete: [] }

  for (const id of ids) {
    try {
      const resp = await HttpUtil.get(`/panel/api/inbounds/checkSubscriptions/${id}`);
      if (resp?.success && resp.obj?.subscriptions?.length > 0) {
        const subs = resp.obj.subscriptions;
        const willUpdate = subs.filter(s => !s.onlyOne);
        const willDelete = subs.filter(s => s.onlyOne);
        if (willUpdate.length > 0 || willDelete.length > 0) {
          subInfoByInbound[id] = { willUpdate, willDelete };
        }
      }
    } catch (_e) { /* skip */ }
  }

  let content = t('pages.inbounds.batch.deleteInboundsMsg', { count: ids.length });

  const hasAnySubs = Object.keys(subInfoByInbound).length > 0;
  if (hasAnySubs) {
    content += '\n';
    for (const id of ids) {
      const info = subInfoByInbound[id];
      if (!info) continue;
      const dbInbound = dbInbounds.value.find(ib => ib.id === id);
      if (!dbInbound) continue;
      const isMulti = dbInbound.isMultiUser();
      content += `\n· ${t('pages.inbounds.inbound')} "${dbInbound.remark}" (${dbInbound.protocol}):`;
      if (info.willUpdate.length > 0) {
        content += `\n${isMulti ? t('pages.inbounds.batch.subWillRemoveInboundClients') : t('pages.inbounds.batch.subWillRemoveInbound')}:\n${info.willUpdate.map(fmtSub).join(', ')}`;
      }
      if (info.willDelete.length > 0) {
        content += `\n${isMulti ? t('pages.inbounds.batch.subWillDeleteInboundClients') : t('pages.inbounds.batch.subWillDeleteInbound')}:\n${info.willDelete.map(fmtSub).join(', ')}`;
      }
    }
  }

  Modal.confirm({
    title: t('pages.inbounds.batch.deleteInboundsConfirm', { count: ids.length }),
    content,
    okText: t('pages.inbounds.batch.deleteInboundsOk', { count: ids.length }),
    okType: 'danger',
    cancelText: t('cancel'),
    onOk: async () => {
      for (const id of ids) {
        const hasSubs = !!subInfoByInbound[id];
        const endpoint = hasSubs
          ? `/panel/api/inbounds/forceDel/${id}`
          : `/panel/api/inbounds/del/${id}`;
        await HttpUtil.post(endpoint);
      }
      await refresh();
    },
  });
}

async function onBatchDeleteClients() {
  const sc = selectedClientIds.value;
  // Flatten: [{ inboundId, client, dbInbound, intClientId }]
  const entries = [];
  for (const [inboundIdStr, rowKeys] of Object.entries(sc)) {
    if (!rowKeys || rowKeys.length === 0) continue;
    const inboundId = Number(inboundIdStr);
    const dbInbound = dbInbounds.value.find(ib => ib.id === inboundId);
    if (!dbInbound) continue;
    if (!dbInbound.isMultiUser()) continue;
    const inbound = dbInbound.toInbound();
    const clients = inbound?.clients || [];
    // Exclude single-client inbounds where the only client is selected
    if (clients.length <= 1) continue;
    for (const client of clients) {
      const key = client.email || client.id || client.password || JSON.stringify(client);
      if (rowKeys.includes(key)) {
        const intId = getIntClientIdFromSettings(dbInbound.settings, client);
        entries.push({ inboundId, client, dbInbound, intClientId: intId });
      }
    }
  }

  const totalClients = entries.length;
  if (totalClients < 2) return;
  const totalInbounds = new Set(entries.map(e => e.inboundId)).size;
  const fmtSub = (s) => `${s.remark || s.subId} (${s.subId})`;

  // Check subscriptions for each client
  const subInfoByEntry = {}; // entry index -> { affected: [], toBeDeleted: [] }
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e.intClientId) continue;
    try {
      const resp = await HttpUtil.get(
        `/panel/api/inbounds/checkClientSubscriptions/${e.inboundId}/${e.intClientId}`,
      );
      if (resp?.success) {
        const affected = resp.obj?.affected || [];
        const toBeDeleted = resp.obj?.toBeDeleted || [];
        if (affected.length > 0 || toBeDeleted.length > 0) {
          subInfoByEntry[i] = { affected, toBeDeleted };
        }
      }
    } catch (_ex) { /* skip */ }
  }

  let content = t('pages.inbounds.batch.deleteClientsMsg', { count: totalClients, inboundCount: totalInbounds });

  const hasAnySubs = Object.keys(subInfoByEntry).length > 0;
  if (hasAnySubs) {
    content += '\n';
    for (let i = 0; i < entries.length; i++) {
      const info = subInfoByEntry[i];
      if (!info) continue;
      const e = entries[i];
      content += `\n· ${t('pages.inbounds.inbound')} "${e.dbInbound.remark}" / ${e.client.email}:`;
      if (info.affected.length > 0) {
        content += `\n${t('pages.inbounds.batch.subWillRemoveClient')}:\n${info.affected.map(fmtSub).join(', ')}`;
      }
      if (info.toBeDeleted.length > 0) {
        content += `\n${t('pages.inbounds.batch.subWillDeleteClient')}:\n${info.toBeDeleted.map(fmtSub).join(', ')}`;
      }
    }
  }

  Modal.confirm({
    title: t('pages.inbounds.batch.deleteClientsConfirm', { count: totalClients }),
    content,
    okText: t('pages.inbounds.batch.deleteClientsOk', { count: totalClients }),
    okType: 'danger',
    cancelText: t('cancel'),
    onOk: async () => {
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const clientId = getClientId(e.dbInbound.protocol, e.client);
        const hasSubs = !!subInfoByEntry[i];
        const endpoint = hasSubs
          ? `/panel/api/inbounds/${e.inboundId}/forceDelClient/${clientId}`
          : `/panel/api/inbounds/${e.inboundId}/delClient/${clientId}`;
        await HttpUtil.post(endpoint);
      }
      await refresh();
    },
  });
}

const batchEditOpen = ref(false);
const batchEditInbounds = ref([]);

function onBatchEditInbounds() {
  const ids = selectedIds.value;
  if (ids.length < 2) return;
  batchEditInbounds.value = ids
    .map(id => dbInbounds.value.find(ib => ib.id === id))
    .filter(Boolean);
  batchEditOpen.value = true;
}

function onGeneralAction(key) {
  switch (key) {
    case 'batchEdit':
      onBatchEditInbounds();
      break;
    case 'batchDelClients':
      onBatchDeleteClients();
      break;
    case 'batchDelInbounds':
      onBatchDeleteInbounds();
      break;
    case 'import':
      importInbound();
      break;
    case 'export':
      exportAllLinks();
      break;
    case 'subs':
      exportAllSubs();
      break;
    case 'resetInbounds':
      Modal.confirm({
        title: 'Reset all inbound traffic?',
        okText: 'Reset',
        cancelText: 'Cancel',
        onOk: async () => {
          const msg = await HttpUtil.post('/panel/api/inbounds/resetAllTraffics');
          if (msg?.success) await refresh();
        },
      });
      break;
    case 'resetClients':
      Modal.confirm({
        title: 'Reset all client traffic across all inbounds?',
        okText: 'Reset',
        cancelText: 'Cancel',
        onOk: async () => {
          const msg = await HttpUtil.post('/panel/api/inbounds/resetAllClientTraffics/-1');
          if (msg?.success) await refresh();
        },
      });
      break;
    case 'delDepletedClients':
      confirmDelDepleted(-1);
      break;
    default:
      message.info(`General action "${key}" — coming in a later 5f subphase`);
  }
}

function onRowAction({ key, dbInbound }) {
  switch (key) {
    case 'edit':
      openEdit(dbInbound);
      break;
    case 'addClient':
      openAddClient(dbInbound);
      break;
    case 'addBulkClient':
      openAddBulkClient(dbInbound);
      break;
    case 'showInfo':
      infoDbInbound.value = checkFallback(dbInbound);
      infoClientIndex.value = findClientIndex(dbInbound, null);
      infoOpen.value = true;
      break;
    case 'qrcode':
      qrDbInbound.value = checkFallback(dbInbound);
      qrClient.value = null;
      qrOpen.value = true;
      break;
    case 'export':
      exportInboundLinks(dbInbound);
      break;
    case 'subs':
      // Single-client inbound → auto-select that client.
      // Multi-client inbound → pre-select nothing, let the user pick.
      let preselect = [];
      try {
        const parsed = dbInbound.toInbound();
        const clients = parsed?.clients || [];
        if (clients.length === 1) {
          const raw = typeof dbInbound.settings === 'string'
            ? JSON.parse(dbInbound.settings)
            : (dbInbound.settings || {});
          const clientId = raw?.clients?.[0]?.clientId || 0;
          if (clientId > 0) {
            preselect = [`${dbInbound.id}:${clientId}`];
          }
        }
      } catch (_e) { /* fall through — empty preselect */ }
      window.__subPreselectIds = preselect;
      subFormMode.value = 'add';
      subFormData.value = null;
      subFormOpen.value = true;
      break;
    case 'clipboard':
      exportInboundClipboard(dbInbound);
      break;
    case 'copyClients':
      copyDbInbound.value = dbInbound;
      copyOpen.value = true;
      break;
    case 'delete':
      confirmDelete(dbInbound);
      break;
    case 'resetTraffic':
      confirmResetTraffic(dbInbound);
      break;
    case 'clone':
      confirmClone(dbInbound);
      break;
    case 'resetClients':
      Modal.confirm({
        title: `Reset client traffic on "${dbInbound.remark}"?`,
        okText: 'Reset',
        cancelText: 'Cancel',
        onOk: async () => {
          const msg = await HttpUtil.post(`/panel/api/inbounds/resetAllClientTraffics/${dbInbound.id}`);
          if (msg?.success) await refresh();
        },
      });
      break;
    case 'delDepletedClients':
      confirmDelDepleted(dbInbound.id);
      break;
    default:
      message.info(`Action "${key}" — coming in a later 5f subphase`);
  }
}
</script>

<template>
  <a-config-provider :theme="antdThemeConfig">
    <a-layout class="inbounds-page" :class="{ 'is-dark': themeState.isDark, 'is-ultra': themeState.isUltra }">
      <AppSidebar :base-path="basePath" :request-uri="requestUri" />

      <a-layout class="content-shell">
        <a-layout-content id="content-layout" class="content-area">
          <a-spin :spinning="!fetched" :delay="200" tip="Loading…" size="large">
            <div v-if="!fetched" class="loading-spacer" />

            <a-row v-else :gutter="[isMobile ? 8 : 16, 12]">
              <!-- Summary statistics card -->
              <a-col :span="24">
                <a-card size="small" hoverable class="summary-card">
                  <a-row :gutter="[16, 12]">
                    <a-col :xs="12" :sm="12" :md="5">
                      <CustomStatistic :title="t('pages.inbounds.totalDownUp')"
                        :value="`${SizeFormatter.sizeFormat(totals.up)} / ${SizeFormatter.sizeFormat(totals.down)}`">
                        <template #prefix>
                          <SwapOutlined />
                        </template>
                      </CustomStatistic>
                    </a-col>
                    <a-col :xs="12" :sm="12" :md="5">
                      <CustomStatistic :title="t('pages.inbounds.totalUsage')"
                        :value="SizeFormatter.sizeFormat(totals.up + totals.down)">
                        <template #prefix>
                          <PieChartOutlined />
                        </template>
                      </CustomStatistic>
                    </a-col>
                    <a-col :xs="12" :sm="12" :md="5">
                      <CustomStatistic :title="t('pages.inbounds.allTimeTrafficUsage')"
                        :value="SizeFormatter.sizeFormat(totals.allTime)">
                        <template #prefix>
                          <HistoryOutlined />
                        </template>
                      </CustomStatistic>
                    </a-col>
                    <a-col :xs="12" :sm="12" :md="5">
                      <CustomStatistic :title="t('pages.inbounds.inboundCount')" :value="String(dbInbounds.length)">
                        <template #prefix>
                          <BarsOutlined />
                        </template>
                      </CustomStatistic>
                    </a-col>
                    <a-col :xs="24" :sm="24" :md="4">
                      <CustomStatistic :title="t('clients')" value=" ">
                        <template #prefix>
                          <a-space direction="horizontal">
                            <TeamOutlined />
                            <a-tag color="green">{{ totals.clients }}</a-tag>
                            <a-popover v-if="totals.deactive.length" :title="t('disabled')">
                              <template #content>
                                <div class="client-email-list">
                                  <div v-for="email in totals.deactive" :key="email">{{ email }}</div>
                                </div>
                              </template>
                              <a-tag>{{ totals.deactive.length }}</a-tag>
                            </a-popover>
                            <a-popover v-if="totals.depleted.length" :title="t('depleted')">
                              <template #content>
                                <div class="client-email-list">
                                  <div v-for="email in totals.depleted" :key="email">{{ email }}</div>
                                </div>
                              </template>
                              <a-tag color="red">{{ totals.depleted.length }}</a-tag>
                            </a-popover>
                            <a-popover v-if="totals.expiring.length" :title="t('depletingSoon')">
                              <template #content>
                                <div class="client-email-list">
                                  <div v-for="email in totals.expiring" :key="email">{{ email }}</div>
                                </div>
                              </template>
                              <a-tag color="orange">{{ totals.expiring.length }}</a-tag>
                            </a-popover>
                            <a-popover v-if="totals.online.length" :title="t('online')">
                              <template #content>
                                <div class="client-email-list">
                                  <div v-for="email in totals.online" :key="email">{{ email }}</div>
                                </div>
                              </template>
                              <a-tag color="blue">{{ totals.online.length }}</a-tag>
                            </a-popover>
                          </a-space>
                        </template>
                      </CustomStatistic>
                    </a-col>
                  </a-row>
                </a-card>
              </a-col>

              <!-- Inbound list — toolbar, search/filter, columns, row actions -->
              <a-col :span="24">
                <InboundList :db-inbounds="dbInbounds" :client-count="clientCount" :online-clients="onlineClients"
                  :last-online-map="lastOnlineMap" :is-dark-theme="themeState.isDark" :expire-diff="expireDiff"
                  :traffic-diff="trafficDiff" :page-size="pageSize" :is-mobile="isMobile"
                  :sub-enable="subSettings.enable" :nodes-by-id="nodesById" :has-active-node="hasActiveNode"
                  :stats-version="statsVersion"
                  :selected-ids="selectedIds"
                  :selected-client-ids="selectedClientIds"
                  @update:selected-ids="selectedIds = $event"
                  @update:selected-client-ids="onClientSelectionChange"
                  @refresh="refresh"
                  @add-inbound="onAddInbound" @general-action="onGeneralAction" @row-action="onRowAction"
                  @edit-client="onEditClient" @qrcode-client="onQrcodeClient" @info-client="onInfoClient"
                  @reset-traffic-client="onResetTrafficClient" @delete-client="onDeleteClient"
                  @delete-clients="onDeleteClients" @toggle-enable-client="onToggleEnableClient"
                  @toggle-enable="onToggleEnable" />
              </a-col>
            </a-row>
          </a-spin>
        </a-layout-content>
      </a-layout>

      <InboundFormModal v-model:open="formOpen" :mode="formMode" :db-inbound="formDbInbound" @saved="refresh" />
      <ClientFormModal v-model:open="clientOpen" :mode="clientMode" :db-inbound="clientDbInbound"
        :client-index="clientIndex" :sub-enable="subSettings.enable" :tg-bot-enable="tgBotEnable"
        :ip-limit-enable="ipLimitEnable" :traffic-diff="trafficDiff" @saved="refresh" />
      <ClientBulkModal v-model:open="bulkOpen" :db-inbound="bulkDbInbound" :sub-enable="subSettings.enable"
        :tg-bot-enable="tgBotEnable" :ip-limit-enable="ipLimitEnable" @saved="refresh" />
      <CopyClientsModal v-model:open="copyOpen" :db-inbound="copyDbInbound" :db-inbounds="dbInbounds"
        @saved="refresh" />
      <InboundInfoModal v-model:open="infoOpen" :db-inbound="infoDbInbound" :client-index="infoClientIndex"
        :remark-model="remarkModel" :expire-diff="expireDiff" :traffic-diff="trafficDiff"
        :ip-limit-enable="ipLimitEnable" :tg-bot-enable="tgBotEnable" :sub-settings="subSettings"
        :last-online-map="lastOnlineMap" :node-address="infoNodeAddress" />
      <QrCodeModal v-model:open="qrOpen" :db-inbound="qrDbInbound" :client="qrClient" :remark-model="remarkModel"
        :node-address="qrNodeAddress" :sub-settings="subSettings" />

      <TextModal v-model:open="textOpen" :title="textTitle" :content="textContent" :file-name="textFileName" />
      <PromptModal v-model:open="promptOpen" :title="promptTitle" :ok-text="promptOkText" :type="promptType"
        :initial-value="promptInitial" :loading="promptLoading" @confirm="onPromptConfirm" />
      <SubscriptionFormModal v-model:open="subFormOpen" :mode="subFormMode" :subscription="subFormData"
        :save="onSubSave" />
      <BatchEditModal v-model:open="batchEditOpen" :inbounds="batchEditInbounds" @done="refresh" />
    </a-layout>
  </a-config-provider>
</template>

<style scoped>
.inbounds-page {
  --bg-page: #e6e8ec;
  --bg-card: #ffffff;

  min-height: 100vh;
  background: var(--bg-page);
}

.inbounds-page.is-dark {
  --bg-page: #1e1e1e;
  --bg-card: #252526;
}

.inbounds-page.is-dark.is-ultra {
  --bg-page: #050505;
  --bg-card: #0c0e12;
}

.inbounds-page :deep(.ant-layout),
.inbounds-page :deep(.ant-layout-content) {
  background: transparent;
}

.content-shell {
  background: transparent;
}

.content-area {
  padding: 24px;
}

@media (max-width: 768px) {
  .content-area {
    padding: 8px;
  }
}

.loading-spacer {
  min-height: calc(100vh - 120px);
}

.summary-card {
  padding: 16px;
}

@media (max-width: 768px) {
  .summary-card {
    padding: 8px;
  }
}
</style>

<style>
/* AD-Vue popovers teleport their content to <body>, so scoped styles
   don't reach them — this block has to be unscoped. */
.client-email-list {
  max-height: 280px;
  min-width: 160px;
  overflow-y: auto;
  padding-right: 4px;
}

.client-email-list > div {
  padding: 2px 0;
  font-size: 12px;
  white-space: nowrap;
}
</style>
