<script setup>
console.log('[MODAL] SubscriptionFormModal module evaluating');
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { HttpUtil } from '@/utils';
import { useAllSetting } from '@/pages/settings/useAllSetting.js';

import dayjs from 'dayjs';
// Dayjs locales
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/zh-tw';
import 'dayjs/locale/vi';
import 'dayjs/locale/uk';
import 'dayjs/locale/tr';
import 'dayjs/locale/ru';
import 'dayjs/locale/pt-br';
import 'dayjs/locale/ja';
import 'dayjs/locale/id';
import 'dayjs/locale/es';
import 'dayjs/locale/ar';
import 'dayjs/locale/fa';
// Ant-design locale objects for date picker UI
import enUS from 'ant-design-vue/es/locale/en_US';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import zhTW from 'ant-design-vue/es/locale/zh_TW';
import viVN from 'ant-design-vue/es/locale/vi_VN';
import ukUA from 'ant-design-vue/es/locale/uk_UA';
import trTR from 'ant-design-vue/es/locale/tr_TR';
import ruRU from 'ant-design-vue/es/locale/ru_RU';
import ptBR from 'ant-design-vue/es/locale/pt_BR';
import jaJP from 'ant-design-vue/es/locale/ja_JP';
import idID from 'ant-design-vue/es/locale/id_ID';
import esES from 'ant-design-vue/es/locale/es_ES';
import arEG from 'ant-design-vue/es/locale/ar_EG';
// fa_IR is not available in ant-design; fallback to en


const props = defineProps({
  open: { type: Boolean, default: false },
  mode: { type: String, default: 'add' },
  subscription: { type: Object, default: null },
  save: { type: Function, required: true },
});

const emit = defineEmits(['update:open']);
const { t, locale: i18nLocale } = useI18n();


const activeTabKey = ref('general');
const allInbounds = ref([]);
const selectedInbounds = ref([]);
const uaOpen = ref(false); // User-Agent select dropdown visibility
let uaTimer = null; // debounce timer for UA dropdown close
function onUaEnter() { if (uaTimer) { clearTimeout(uaTimer); uaTimer = null; } uaOpen.value = true; }
function onUaLeave() { uaTimer = setTimeout(() => { uaOpen.value = false; }, 150); }
const searchQuery = ref('');
const submitting = ref(false);
const isDarkModal = ref(false);
const isUltraModal = ref(false);
// Expiry date (dayjs) + custom 3‑column time picker
const expiryDateVal = ref(null);
const nowInit = dayjs();
const timeH = ref(nowInit.hour());
const timeM = ref(nowInit.minute());
const timeS = ref(nowInit.second());
const timeOpen = ref(false);
const pad2 = (n) => String(n).padStart(2, '0');
const timeDisplay = computed(() => `${pad2(timeH.value)} : ${pad2(timeM.value)} : ${pad2(timeS.value)}`);

watch(() => form.expiryTime, (ts) => {
  if (!ts) { expiryDateVal.value = null; return; }
  const d = dayjs(ts);
  expiryDateVal.value = d;
  timeH.value = d.hour(); timeM.value = d.minute(); timeS.value = d.second();
}, { immediate: true });

function pickDate(d) {
  expiryDateVal.value = d;
  if (d) form.expiryTime = d.hour(timeH.value).minute(timeM.value).second(timeS.value).valueOf();
  else form.expiryTime = 0;
}
function scrollColsToTop(idx, val) {
  const cols = document.querySelectorAll('.time-picker-wrap .time-col');
  if (!cols[idx]) return;
  const target = cols[idx].querySelector(`.time-opt:nth-child(${val + 1})`);
  if (target) cols[idx].scrollTop = target.offsetTop;
}
function selectH(v) { timeH.value = v; form.expiryTime = (expiryDateVal.value || dayjs()).hour(v).minute(timeM.value).second(timeS.value).valueOf(); scrollColsToTop(0, v); }
function selectM(v) { timeM.value = v; form.expiryTime = (expiryDateVal.value || dayjs()).hour(timeH.value).minute(v).second(timeS.value).valueOf(); scrollColsToTop(1, v); }
function selectS(v) { timeS.value = v; form.expiryTime = (expiryDateVal.value || dayjs()).hour(timeH.value).minute(timeM.value).second(v).valueOf(); scrollColsToTop(2, v); }
function pickNow() {
  const now = dayjs();
  expiryDateVal.value = now;
  timeH.value = now.hour(); timeM.value = now.minute(); timeS.value = now.second();
  form.expiryTime = now.valueOf();
  timeOpen.value = false;
}
// Time input validation on blur — only check when input loses focus
function onTimeBlur(e) {
  const raw = (e.target.value || '').trim();
  if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(raw)) { e.target.value = timeDisplay.value; return; }
  const parts = raw.split(':').map(Number);
  const h = parts[0], m = parts[1], s = parts[2] || 0;
  if (h > 23 || m > 59 || s > 59) { e.target.value = timeDisplay.value; return; }
  timeH.value = h; timeM.value = m; timeS.value = s;
  const d = expiryDateVal.value || dayjs();
  form.expiryTime = d.hour(h).minute(m).second(s).valueOf();
}
// Click outside to close
onMounted(() => {
  document.addEventListener('click', (e) => {
    if (timeOpen.value && !e.target.closest('.time-picker-wrap')) timeOpen.value = false;
  });
});
// Auto-scroll to top when opening
watch(timeOpen, (open) => {
  if (!open) return;
  nextTick(() => {
    const cols = document.querySelectorAll('.time-picker-wrap .time-col');
    if (cols.length < 3) return;
    const vals = [timeH.value, timeM.value, timeS.value];
    for (let i = 0; i < 3; i++) {
      const target = cols[i].querySelector(`.time-opt:nth-child(${vals[i] + 1})`);
      if (target) cols[i].scrollTop = target.offsetTop;
    }
  });
});

// When expiry changes — always refresh to current time
function onExpiryToggle(v) {
  form.expiryEnabled = v;
  if (v) {
    const now = dayjs();
    expiryDateVal.value = now;
    timeH.value = now.hour(); timeM.value = now.minute(); timeS.value = now.second();
    form.expiryTime = now.valueOf();
  } else {
    expiryDateVal.value = null;
    form.expiryTime = 0;
  }
}

const subIdChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function generateSubId() {
  let id = '';
  for (let i = 0; i < 16; i++) id += subIdChars[Math.floor(Math.random() * subIdChars.length)];
  return id;
}

const { allSetting } = useAllSetting();

// Subscription link hint for SubId input — mirrors the settings page subLinkHint
function subLinkFor(subId) {
  if (!subId) return '';
  const host = window.location.hostname;
  const port = allSetting?.subPort || '2096';
  return `${window.location.protocol}//${host}:${port}/sub/${subId}`;
}

const form = reactive({
  subId: '',
  remark: '',
  enable: true,
  format: 'base64',
  password: '',
  expiryEnabled: false,
  expiryTime: 0,
  showInfo: true,
  emailInRemark: false,
  title: '',
  supportUrl: '',
  profileUrl: '',
  announce: '',
  updateInterval: 12,
  syncWithInboundOrder: false,
  autoIncludeAllEnabled: false,
  userAgentEnabled: false,
  userAgentValues: [],
});

// Drag-and-drop — real-time reorder
let dragIdx = null;

const isMobileWidth = () => window.innerWidth < 768;

// Dayjs locale mapping for date picker
const dayjsLocaleMap = {
  'en-US': 'en', 'zh-CN': 'zh-cn', 'zh-TW': 'zh-tw',
  'vi-VN': 'vi', 'uk-UA': 'uk', 'tr-TR': 'tr',
  'ru-RU': 'ru', 'pt-BR': 'pt-br', 'ja-JP': 'ja',
  'id-ID': 'id', 'es-ES': 'es', 'ar-EG': 'ar', 'fa-IR': 'fa',
};

// Watch i18n locale changes → update dayjs locale for date picker
watch(i18nLocale, (code) => {
  const djLocale = dayjsLocaleMap[code] || 'en';
  try { dayjs.locale(djLocale); } catch (e) { dayjs.locale('en'); }
}, { immediate: true });

// Ant-design locale map for date picker UI (calendar header, weekdays, "Now" button)
const antdLocaleMap = {
  'en-US': enUS, 'zh-CN': zhCN, 'zh-TW': zhTW,
  'vi-VN': viVN, 'uk-UA': ukUA, 'tr-TR': trTR, 'ru-RU': ruRU,
  'pt-BR': ptBR, 'ja-JP': jaJP, 'id-ID': idID, 'es-ES': esES,
  'ar-EG': arEG,
  'fa-IR': enUS,
};
const antdLocale = computed(() => antdLocaleMap[i18nLocale.value] || enUS);

// Locale-specific date-time format for the date picker
const dateTimeFormat = computed(() => {
  const code = i18nLocale.value;
  const formats = {
    'en-US': 'MM/DD/YYYY hh:mm:ss A',
    'zh-CN': 'YYYY-MM-DD HH:mm:ss',
    'zh-TW': 'YYYY/MM/DD HH:mm:ss',
    'vi-VN': 'DD/MM/YYYY HH:mm:ss',
    'uk-UA': 'DD.MM.YYYY HH:mm:ss',
    'tr-TR': 'DD.MM.YYYY HH:mm:ss',
    'ru-RU': 'DD.MM.YYYY HH:mm:ss',
    'pt-BR': 'DD/MM/YYYY HH:mm:ss',
    'ja-JP': 'YYYY/MM/DD HH:mm:ss',
    'id-ID': 'DD/MM/YYYY HH:mm:ss',
    'fa-IR': 'YYYY/MM/DD HH:mm:ss',
    'es-ES': 'DD/MM/YYYY HH:mm:ss',
    'ar-EG': 'DD/MM/YYYY HH:mm:ss',
  };
  return formats[code] || 'YYYY-MM-DD HH:mm:ss';
});

// Scroll position persistence per tab, reset on dialog close
const scrollPos = { available: 0, selected: 0 };
watch(activeTabKey, (key, oldKey) => {
  if (oldKey === 'inbounds') {
    const a = document.querySelector('.inbounds-panel-col:first-child .inbound-list');
    const s = document.querySelector('.inbounds-panel-col:last-child .inbound-list');
    if (a) scrollPos.available = a.scrollTop;
    if (s) scrollPos.selected = s.scrollTop;
  }
  if (key === 'inbounds') {
    nextTick(() => {
      const a = document.querySelector('.inbounds-panel-col:first-child .inbound-list');
      const s = document.querySelector('.inbounds-panel-col:last-child .inbound-list');
      if (a) a.scrollTop = scrollPos.available;
      if (s) s.scrollTop = scrollPos.selected;
    });
  }
});
watch(() => props.open, (open) => { if (!open) { scrollPos.available = 0; scrollPos.selected = 0; } });

// === Pointer Events drag & reorder with pointerId tracking ===
let pointerDrag = { started: false, startY: 0 };
let dragPointerId = -1;

function onPointerDown(e, index) {
  if (form.syncWithInboundOrder) return;
  e.preventDefault();
  dragPointerId = e.pointerId;
  pointerDrag = { started: false, startY: e.clientY, targetIdx: index };
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
}
function onPointerMove(e) {
  if (e.pointerId !== dragPointerId) return; // 非拖拽指针：放行（允许双指滚动）
  e.preventDefault();
  if (!pointerDrag.started) {
    if (Math.abs(e.clientY - pointerDrag.startY) < 5) return;
    pointerDrag.started = true;
    dragIdx = pointerDrag.targetIdx;
    subDraggedIdx.value = pointerDrag.targetIdx;
    isDraggingInbounds.value = true;
  }
  if (dragIdx === null) return;
  const container = document.querySelector('.inbound-list:last-child');
  if (!container) return;
  // Reorder under pointer
  const items = container.querySelectorAll(':scope > .inbound-item');
  if (items) {
    for (const itemEl of items) {
      const rect = itemEl.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY < rect.bottom) {
        const key = Number(itemEl.getAttribute('data-key'));
        if (key) {
          const idx = selectedInbounds.value.findIndex(i => i.key === key);
          if (idx >= 0 && idx !== dragIdx) {
            const arr = selectedInbounds.value;
            const it = arr.splice(dragIdx, 1)[0];
            arr.splice(idx, 0, it);
            dragIdx = idx;
            subDraggedIdx.value = idx;
          }
        }
        break;
      }
    }
  }
}
function onPointerUp() {
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
  dragIdx = null; subDraggedIdx.value = -1; isDraggingInbounds.value = false;
  selectedInbounds.value = [...selectedInbounds.value];
  document.activeElement?.blur();
  dragPointerId = -1;
  pointerDrag = { started: false, startY: 0 };
}
// === HTML5 DnD (kept for fallback) ===
function onDragStart(index) {} /* unused */
function onDragEnd() {} /* unused */
function onDrop() {} /* unused */

// === Auto-scroll (commented out — kept for reference) ===
// let subRAF = null;
// let subLastTs = 0;
// let subScrollDir = 0;
// let subScrollDist = 0;
// let subScrollContainer = null;
// const SUB_ROW_H = 34;
// function getSubScrollThresholds() {
//   if (!subScrollContainer) return { idleTrigger: 120 };
//   const h = subScrollContainer.clientHeight;
//   return { idleTrigger: Math.min(200, Math.max(80, Math.round(h * 0.1))) };
// }
// function subScrollTick(timestamp) {
//   if (!subScrollContainer || subScrollDir === 0) { subRAF = null; return; }
//   if (!subLastTs) subLastTs = timestamp;
//   const delta = Math.min(timestamp - subLastTs, 100);
//   subLastTs = timestamp;
//   const { idleTrigger } = getSubScrollThresholds();
//   const t = Math.max(0, Math.min(1, subScrollDist / idleTrigger));
//   const pxPerMs = SUB_ROW_H / (300 + 2000 * Math.pow(1 - t, 4));
//   subScrollContainer.scrollTop += subScrollDir * pxPerMs * delta;
//   subRAF = requestAnimationFrame(subScrollTick);
// }
// function subUpdateScroll(container, clientY) {
//   if (!container) return;
//   subScrollContainer = container;
//   const { idleTrigger } = getSubScrollThresholds();
//   const rect = container.getBoundingClientRect();
//   const topDist = clientY - rect.top;
//   const botDist = rect.bottom - clientY;
//   let dir = 0;
//   if (topDist < idleTrigger) { dir = -1; subScrollDist = topDist; }
//   else if (botDist < idleTrigger) { dir = 1; subScrollDist = botDist; }
//   if (dir !== subScrollDir) {
//     subScrollDir = dir;
//     if (dir === 0 && subRAF) { cancelAnimationFrame(subRAF); subRAF = null; }
//   }
//   if (dir !== 0 && !subRAF) { subLastTs = 0; subRAF = requestAnimationFrame(subScrollTick); }
// }
// function onDragOver(e, index) {
//   if (dragIdx === null || dragIdx === index) return;
//   subUpdateScroll(e.currentTarget.closest('.inbound-list'), e.clientY);
//   const arr = selectedInbounds.value;
//   const item = arr.splice(dragIdx, 1)[0];
//   arr.splice(index, 0, item);
//   dragIdx = index;
//   subDraggedIdx.value = index;
// }
// function onDragOverContainer(e) {
//   if (dragIdx === null) return;
//   subUpdateScroll(e.currentTarget, e.clientY);
// }
// function resetSubScroll() { subScrollDir = 0; subScrollContainer = null; if (subRAF) { cancelAnimationFrame(subRAF); subRAF = null; } }

function moveUp(index) {
  if (index <= 0) return;
  const arr = selectedInbounds.value;
  [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
}
function moveDown(index) {
  if (index >= selectedInbounds.value.length - 1) return;
  const arr = selectedInbounds.value;
  [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
}

// Drag highlight — the row being dragged gets highlighted
const subDraggedIdx = ref(-1);
const isDraggingInbounds = ref(false);
const isDragDark = computed(() => {
  return document.querySelector('.subs-page.is-ultra, .inbounds-page.is-ultra') !== null ? 2
       : document.querySelector('.subs-page.is-dark, .inbounds-page.is-dark') !== null ? 1 : 0;
});

function itemStyle(index) {
  const showHighlight = subDraggedIdx.value === index;
  const dd = isDragDark.value;
  const style = { cursor: form.syncWithInboundOrder ? 'default' : 'grab' };
  if (showHighlight) {
    style.background = dd === 2 ? 'rgba(24,144,255,0.5)' : dd === 1 ? 'rgba(24,144,255,0.45)' : '#d6e9ff';
    style.outline = '2px dashed #1890ff';
    style.outlineOffset = '-2px';
  } else {
    style.outline = 'none';
    style.outlineOffset = '0';
  }
  return style;
}
function addItem(inbound) {
  if (form.autoIncludeAllEnabled) return;
  if (!selectedInbounds.value.find(i => i.key === inbound.key)) {
    selectedInbounds.value.push({ ...inbound });
    if (form.syncWithInboundOrder) sortByInboundOrder();
  }
}
function removeItem(index) { selectedInbounds.value.splice(index, 1); }
function addAll() {
  const flat = flatInboundList(allInbounds.value);
  const currentKeys = new Set(selectedInbounds.value.map(i => i.key));
  for (const fi of flat) {
    if (!currentKeys.has(fi.key)) selectedInbounds.value.push({ ...fi });
  }
}
function removeAll() { selectedInbounds.value = []; }
async function sortByInboundOrder() {
  const msg = await HttpUtil.get('/panel/api/inbounds/list');
  if (!msg?.success || !Array.isArray(msg.obj)) return;
  const orderMap = new Map();
  msg.obj.forEach((ib, idx) => orderMap.set(ib.id, idx));
  selectedInbounds.value.sort((a, b) => {
    const oa = orderMap.has(a.inboundKey) ? orderMap.get(a.inboundKey) : 999999;
    const ob = orderMap.has(b.inboundKey) ? orderMap.get(b.inboundKey) : 999999;
    if (oa !== ob) return oa - ob;
    return (a.clientId || 0) - (b.clientId || 0);
  });
}

// Flat item key helpers
function inboundItemKey(inboundKey) { return `inbound-${inboundKey}`; }
function clientItemKey(inboundKey, clientId) { return `client-${inboundKey}-${clientId}`; }

// Flatten inbounds into a list where single-client inbounds are one item,
// and multi-client inbounds have one item per client.
function flatInboundList(list) {
  const result = [];
  const now = Date.now();
  for (const ib of list) {
    const inboundActive = ib.enable && (ib.expiryTime <= 0 || now < ib.expiryTime);
    if (!ib.clients || ib.clients.length <= 1) {
      result.push({
        type: 'inbound',
        key: inboundItemKey(ib.key),
        inboundKey: ib.key,
        clientId: (ib.clients && ib.clients.length === 1) ? ib.clients[0].clientId : 0,
        title: ib.title,
        remark: ib.remark,
        label: '',
        enable: ib.enable,
        expiryTime: ib.expiryTime,
        active: inboundActive,
      });
    } else {
      for (const c of ib.clients) {
        const clientActive = inboundActive && c.enable && (c.expiryTime <= 0 || now < c.expiryTime);
        result.push({
          type: 'client',
          key: clientItemKey(ib.key, c.clientId),
          inboundKey: ib.key,
          clientId: c.clientId,
          title: ib.title,
          remark: ib.remark,
          label: c.label,
          enable: c.enable,
          expiryTime: c.expiryTime,
          active: clientActive,
        });
      }
    }
  }
  return result;
}

// Check if a flat item is active (enabled + not expired, including inbound cascade)
function isItemActive(item) { return item.active; }

// Available = items not in selected
const filteredAvailable = computed(() => {
  const selectedKeys = new Set(selectedInbounds.value.map(i => i.key));
  const q = searchQuery.value.toLowerCase();
  const flat = flatInboundList(allInbounds.value);
  return flat.filter(i => !selectedKeys.has(i.key)).filter(i => {
    if (!q) return true;
    return (i.remark || '').toLowerCase().includes(q) || (i.label || '').toLowerCase().includes(q);
  });
});

// Extract client list from inbound settings. Handles clients[], accounts[], peers[].
function extractInboundClients(ib) {
  const clients = [];
  try {
    const settings = typeof ib.settings === 'string' ? JSON.parse(ib.settings) : (ib.settings || {});
    // clients[] — vmess/vless/trojan/ss/hysteria
    for (const c of (settings.clients || [])) {
      const clientId = c.clientId || 0;
      const label = c.email || (c.auth ? 'auth:' + c.auth : '');
      if (clientId > 0 && label) clients.push({
        clientId,
        label,
        enable: c.enable !== false,
        expiryTime: c.expiryTime || 0,
      });
    }
    // accounts[] and peers[] intentionally omitted:
    // mixed, http, wireguard should show only inbound-level rows (no client expansion),
    // consistent with tunnel/tun behavior. These protocols produce no subscription URLs
    // in the backend (GetLink returns \"\").
  } catch (e) { /* ignore parse errors */ }
  return clients;
}

async function loadInbounds() {
  const msg = await HttpUtil.get('/panel/api/inbounds/list');
  if (msg?.success && Array.isArray(msg.obj)) {
    allInbounds.value = msg.obj.map(ib => ({
      key: ib.id,
      title: `${ib.protocol} (${ib.port})`,
      remark: ib.remark || ib.tag,
      enable: ib.enable,
      expiryTime: ib.expiryTime || 0,
      clients: extractInboundClients(ib),
    }));
  }
}

function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let pwd = '';
  for (let i = 0; i < 16; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  form.password = pwd;
}

watch(() => props.open, async (open) => {
  if (!open) return;
  // Reset drag state (in case previous drag was interrupted)
  isDraggingInbounds.value = false;
  activeTabKey.value = 'general';
  isUltraModal.value = document.querySelector('.subs-page.is-ultra, .inbounds-page.is-ultra') !== null;
  isDarkModal.value = isUltraModal.value || document.querySelector('.subs-page.is-dark, .inbounds-page.is-dark') !== null;
  await loadInbounds();

  if (props.mode === 'edit' && props.subscription) {
    const et = props.subscription.expiryTime || 0;
    Object.assign(form, {
      subId: props.subscription.subId || '',
      remark: props.subscription.remark || '',
      enable: props.subscription.enable !== false,
      format: props.subscription.format || 'base64',
      password: props.subscription.password || '',
      expiryEnabled: et > 0,
      expiryTime: et > 0 ? et : Date.now() + 86400000,
      showInfo: props.subscription.showInfo !== false,
      emailInRemark: !!props.subscription.emailInRemark,
      title: props.subscription.title || '',
      supportUrl: props.subscription.supportUrl || '',
      profileUrl: props.subscription.profileUrl || '',
      announce: props.subscription.announce || '',
      updateInterval: props.subscription.updateInterval || 12,
      syncWithInboundOrder: !!props.subscription.syncWithInboundOrder,
      autoIncludeAllEnabled: !!props.subscription.autoIncludeAllEnabled,
      userAgentEnabled: !!props.subscription.userAgentEnabled,
      userAgentValues: (props.subscription.userAgentValues || '').split(',').filter(Boolean),
    });
    // Parse inboundIds which may be in "inboundId:clientId" format
    const refs = (props.subscription.inboundIds || '').split(',').filter(Boolean);
    const flat = flatInboundList(allInbounds.value);
    const flatItemMap = new Map(flat.map(i => [i.key, i]));
    selectedInbounds.value = [];
    for (const r of refs) {
      const parts = r.trim().split(':');
      const inboundKey = parseInt(parts[0]);
      if (!inboundKey) continue;
      if (parts.length === 2) {
        const clientId = parseInt(parts[1]);
        if (clientId) {
          // 2+ clients → clientItemKey ("client-{inboundKey}-{clientId}")
          let item = flatItemMap.get(clientItemKey(inboundKey, clientId));
          // 1 client  → inboundItemKey ("inbound-{inboundKey}") as fallback
          if (!item) item = flatItemMap.get(inboundItemKey(inboundKey));
          if (item) selectedInbounds.value.push({ ...item });
        }
      } else {
        const item = flatItemMap.get(inboundItemKey(inboundKey));
        if (item) selectedInbounds.value.push({ ...item });
      }
    }
  } else {
    Object.assign(form, {
      subId: generateSubId(), remark: '', enable: true, format: 'base64', password: '',
      expiryEnabled: false, expiryTime: Date.now() + 86400000,
      showInfo: true, emailInRemark: false,
      title: '', supportUrl: '', profileUrl: '', announce: '', updateInterval: 12,
      syncWithInboundOrder: false, autoIncludeAllEnabled: false,
      userAgentEnabled: false, userAgentValues: [],
    });
    const preselect = window.__subPreselectIds;
    if (preselect && Array.isArray(preselect) && preselect.length > 0) {
      const flat = flatInboundList(allInbounds.value);
      // preselect can be:
      // - number (inbound ID) → include ALL clients of that inbound
      // - string "inboundId:clientId" → include that specific client
      const inboundAll = new Set();       // Set<inboundId> (whole inbound)
      const clientMap = new Map();        // Map<inboundId, Set<clientId>>
      for (const item of preselect) {
        if (typeof item === 'number') {
          inboundAll.add(item);
        } else if (typeof item === 'string') {
          const parts = item.split(':').map(Number);
          if (parts.length === 2 && parts[0] > 0) {
            if (!clientMap.has(parts[0])) clientMap.set(parts[0], new Set());
            clientMap.get(parts[0]).add(parts[1]);
          }
        }
      }
      selectedInbounds.value = flat.filter(i => {
        if (inboundAll.has(i.inboundKey)) return true;
        const cs = clientMap.get(i.inboundKey);
        if (cs && cs.has(i.clientId)) return true;
        return false;
      });
      window.__subPreselectIds = null;
    } else {
      selectedInbounds.value = [];
    }
  }

  // Apply auto/sync after loading
  if (form.autoIncludeAllEnabled) syncInboundsWithAutoInclude();
  if (form.syncWithInboundOrder) sortByInboundOrder();
});

// Sync auto-include — only adds enabled / removes disabled, NEVER sorts
function syncInboundsWithAutoInclude() {
  const flat = flatInboundList(allInbounds.value);
  // Build a lookup of inboundKey->inbound from the current allInbounds
  const ibEnableMap = new Map();
  for (const ib of allInbounds.value) ibEnableMap.set(ib.key, ib.enable);
  // Remove any item whose inbound no longer exists or is disabled
  selectedInbounds.value = selectedInbounds.value.filter(item => {
    const en = ibEnableMap.get(item.inboundKey);
    return en === true;
  });
  // Append any enabled flat item not yet in the selection (at end)
  const currentKeys = new Set(selectedInbounds.value.map(i => i.key));
  for (const fi of flat) {
    if (ibEnableMap.get(fi.inboundKey) && !currentKeys.has(fi.key)) {
      selectedInbounds.value.push({ ...fi });
    }
  }
}

// Watch auto-include toggle
watch(() => form.autoIncludeAllEnabled, (on) => {
  if (on) syncInboundsWithAutoInclude();
});

// Watch sync-order toggle - immediately apply
watch(() => form.syncWithInboundOrder, (on) => {
  if (on) sortByInboundOrder();
});

// Watch allInbounds changes for auto-include and sync-order (independent)
watch(allInbounds, () => {
  if (form.autoIncludeAllEnabled) syncInboundsWithAutoInclude();
  if (form.syncWithInboundOrder) sortByInboundOrder();
}, { deep: true });

// Watch tab switch to re-sync when coming back to inbounds tab
watch(activeTabKey, (key) => {
  if (key !== 'inbounds') return;
  if (form.autoIncludeAllEnabled) syncInboundsWithAutoInclude();
  if (form.syncWithInboundOrder) sortByInboundOrder();
});

function close() {
  if (!submitting.value) emit('update:open', false);
}

async function onSave() {
  if (selectedInbounds.value.length === 0) {
    activeTabKey.value = 'inbounds';
    message.warning(t('subSelectFromLeft'));
    return;
  }
  if (form.userAgentEnabled && form.userAgentValues.length === 0) {
    message.warning(t('subUaValuesRequired'));
    return;
  }
  submitting.value = true;
  try {
    // Handle auto-include and sync-order before saving
    if (form.autoIncludeAllEnabled) {
      // Preserve existing order — don't replace the whole list with allInbounds order
      syncInboundsWithAutoInclude();
    }
    if (form.syncWithInboundOrder) {
      const msg = await HttpUtil.get('/panel/api/inbounds/list');
      if (msg?.success && Array.isArray(msg.obj)) {
        const orderMap = new Map();
        msg.obj.forEach((ib, idx) => orderMap.set(ib.id, idx));
        selectedInbounds.value.sort((a, b) => {
          const oa = orderMap.has(a.inboundKey) ? orderMap.get(a.inboundKey) : 999999;
          const ob = orderMap.has(b.inboundKey) ? orderMap.get(b.inboundKey) : 999999;
          if (oa !== ob) return oa - ob;
          return (a.clientId || 0) - (b.clientId || 0);
        });
      }
    }
    const payload = {
      subId: form.subId || undefined,
      remark: form.remark, enable: form.enable, format: form.format,
      password: form.password,
      expiryTime: form.expiryEnabled ? Number(form.expiryTime) : 0,
      showInfo: form.showInfo, emailInRemark: form.emailInRemark,
      title: form.title, supportUrl: form.supportUrl,
      profileUrl: form.profileUrl, announce: form.announce,
      updateInterval: form.updateInterval,
      syncWithInboundOrder: form.syncWithInboundOrder,
      autoIncludeAllEnabled: form.autoIncludeAllEnabled,
      userAgentEnabled: form.userAgentEnabled,
      userAgentValues: form.userAgentValues.join(','),
      inboundIds: selectedInbounds.value.map(i => i.clientId > 0 ? `${i.inboundKey}:${i.clientId}` : String(i.inboundKey)).join(','),
    };
    const msg = await props.save(payload);
    if (msg?.success) emit('update:open', false);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <a-modal :open="open" :title="mode === 'edit' ? t('subEditTitle') : t('subCreateTitle')"
    :confirm-loading="submitting" :ok-text="t('subSave')"
    :cancel-text="t('subCancel')" :mask-closable="false" width="820px" @ok="onSave" @cancel="close"
    :class="{ 'sub-form-dark': isDarkModal, 'sub-form-ultra': isUltraModal }">

    <a-tabs v-model:active-key="activeTabKey">
      <!-- === Tab 1: General === -->
      <a-tab-pane key="general" :tab="t('subGeneral')">
        <a-form layout="vertical">
          <!-- Row 1: Title + Remark -->
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item :label="t('subTitle')">
                <a-input v-model:value="form.title" :placeholder="t('subTitlePlaceholder')" />
                <div class="form-hint">{{ t('subTitleHint') }}</div>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('subRemark')">
                <a-input v-model:value="form.remark" :placeholder="t('subRemarkPlaceholder')" />
                <div class="form-hint">{{ t('subRemarkHint') }}</div>
              </a-form-item>
            </a-col>
          </a-row>

          <!-- Row 2: SubId + Enable (Enable left-edge aligned with expiry) -->
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="SubId">
                <a-input v-model:value="form.subId" placeholder="Auto-generated 16-char ID" />
                <div class="form-hint">{{ subLinkFor(form.subId) }}</div>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('subEnable')">
                <a-switch v-model:checked="form.enable" />
              </a-form-item>
            </a-col>
          </a-row>

          <!-- Row 3: Format + Update interval (Update interval left-edge aligned with expiry) -->
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item :label="t('subFormatLabel')">
                <a-radio-group v-model:value="form.format" button-style="solid">
                  <a-radio-button value="text">Text</a-radio-button>
                  <a-radio-button value="base64">Base64</a-radio-button>
                  <a-radio-button value="json">JSON</a-radio-button>
                  <a-radio-button value="clash">Clash</a-radio-button>
                </a-radio-group>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('subUpdateInterval')">
                <a-input-number v-model:value="form.updateInterval" :min="1" style="width:80px" />
                <div class="form-hint">{{ t('subUpdateIntervalHint') }}</div>
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="24">
            <a-col :span="12">
              <a-form-item :label="t('subPasswordLabel')">
                <div style="display:flex;gap:8px;width:100%">
                  <a-input-password v-model:value="form.password" :placeholder="t('subPasswordPlaceholder')"
                    style="flex:1" />
                  <a-button @click="generatePassword">{{ t('subRandom') }}</a-button>
                </div>
                <div class="form-hint">{{ t('subPasswordHint') }}</div>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('subExpiryLabel')">
                <div class="expiry-row">
                  <a-switch :checked="form.expiryEnabled" @change="onExpiryToggle" />
                  <span v-if="!form.expiryEnabled" class="expiry-label">{{ t('subNeverExpire') }}</span>
                  <a-config-provider :locale="antdLocale">
                    <a-date-picker v-show="form.expiryEnabled"
                      v-model:value="expiryDateVal" @change="pickDate"
                      :disabled="!form.expiryEnabled" format="YYYY-MM-DD"
                      style="width:150px" />
                    <div class="time-picker-wrap" style="display:inline-block;margin-left:4px;vertical-align:top" v-show="form.expiryEnabled">
                      <a-input :value="timeDisplay" :disabled="!form.expiryEnabled"
                        style="width:110px;cursor:text;font-variant-numeric:tabular-nums"
                        @click="timeOpen = !timeOpen" @blur="onTimeBlur" />
                      <transition name="tf">
                        <div v-if="timeOpen" class="time-dropdown">
                        <div class="time-cols-wrap">
                          <div class="time-col">
                            <div v-for="h in 24" :key="h-1"
                              :class="['time-opt', h-1===timeH ? 'on' : '']"
                              @click="selectH(h-1)">{{ pad2(h-1) }}</div>
                          </div>
                          <div class="time-col">
                            <div v-for="m in 60" :key="m-1"
                              :class="['time-opt', m-1===timeM ? 'on' : '']"
                              @click="selectM(m-1)">{{ pad2(m-1) }}</div>
                          </div>
                          <div class="time-col">
                            <div v-for="s in 60" :key="s-1"
                              :class="['time-opt', s-1===timeS ? 'on' : '']"
                              @click="selectS(s-1)">{{ pad2(s-1) }}</div>
                          </div>
                        </div>
                        <div class="time-now-btn" @click="pickNow">{{ t('subNow') }}</div>
                      </div>
                      </transition>
                    </div>
                  </a-config-provider>
                </div>
                <div class="form-hint">{{ t('subExpiryHint') }}</div>
              </a-form-item>
            </a-col>
          </a-row>

          <!-- User-Agent filter -->
          <a-row :gutter="24">
            <a-col :span="12">
              <a-form-item :label="t('subUaFilter')" :colon="false">
                <a-switch v-model:checked="form.userAgentEnabled" />
                <div class="form-hint">{{ t('subUaFilterHint') }}</div>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <template v-if="form.userAgentEnabled">
                <a-form-item :label="t('subUaValues')" :validate-status="form.userAgentEnabled && form.userAgentValues.length === 0 ? 'error' : ''"
                  :help="form.userAgentEnabled && form.userAgentValues.length === 0 ? t('subUaValuesRequired') : ''">
                  <div class="ua-select-wrap" @mouseenter="onUaEnter" @mouseleave="onUaLeave">
                    <a-select mode="tags" v-model:value="form.userAgentValues" :placeholder="t('subUaValuesRequired')"
                      v-model:open="uaOpen" placement="topLeft"
                      :get-popup-container="(trigger) => trigger.parentElement"
                      style="width:100%" />
                  </div>
                  <div class="form-hint">{{ t('subUaValuesHint') }}</div>
                </a-form-item>
              </template>
            </a-col>
          </a-row>
        </a-form>
      </a-tab-pane>

      <!-- === Tab 2: Select Inbounds === -->
      <a-tab-pane key="inbounds" :tab="t('subSelectInbounds')">
        <!-- Toggles -->
        <a-form layout="vertical">
          <a-row :gutter="16" style="margin-bottom:12px">
            <a-col :xs="24" :sm="12">
              <a-form-item :label="t('subAutoIncludeAll')" :colon="false">
                <a-switch v-model:checked="form.autoIncludeAllEnabled" />
                <div class="form-hint">{{ t('subAutoIncludeHint') }}</div>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item :label="t('subSyncOrder')" :colon="false">
                <a-switch v-model:checked="form.syncWithInboundOrder" />
                <div class="form-hint">{{ t('subSyncOrderHint') }}</div>
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>

        <!-- Disabled indicator hint -->
        <div class="disabled-hint-row" style="margin:4px 0 2px">
          <span class="disabled-hint-text">{{ t('subDisabledHint') }}</span>
        </div>

        <a-row :gutter="16">
          <a-col :xs="24" :sm="12" class="inbounds-panel-col">
            <div class="panel-box">
              <a-input v-model:value="searchQuery" placeholder="搜索入站..." style="margin-bottom:8px" />
              <div class="inbound-list">
                <div v-for="item in filteredAvailable" :key="item.key" class="inbound-item"
                  @click="addItem(item)"
                  :class="{ 'inactive-item': !isItemActive(item) }"
                  :style="{ opacity: form.autoIncludeAllEnabled ? 0.5 : 1, cursor: form.autoIncludeAllEnabled ? 'not-allowed' : 'pointer' }">
                  <div style="display:flex;flex-direction:column;flex:1;min-width:0">
                    <span class="item-remark" style="font-weight:500">{{ item.remark }}</span>
                    <span v-if="item.label" :class="['client-email', !isItemActive(item) ? 'text-danger' : '']">{{ item.label }}</span>
                  </div>
                  <span v-if="!form.autoIncludeAllEnabled" :class="['add-btn', isItemActive(item) ? '' : 'add-btn-disabled']">+</span>
                </div>
                <div v-if="filteredAvailable.length === 0" class="empty-hint">{{ t('subNoAvailable') }}</div>
              </div>
              <a-button size="small" type="dashed" @click="addAll"
                :disabled="filteredAvailable.length === 0 || form.autoIncludeAllEnabled" style="margin-top:4px">{{ t('subAddAll') }}</a-button>
            </div>
          </a-col>
          <a-col :xs="24" :sm="12" class="inbounds-panel-col">
            <div :class="['panel-box', { 'is-dragging-inbounds': isDraggingInbounds }]">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:4px">
                <span style="font-weight:500">{{ t('subSelected') }} {{ selectedInbounds.length }} {{ t('subItems') }}</span>
                <a-space size="small">
                  <a-button size="small" @click="sortByInboundOrder" :disabled="selectedInbounds.length < 2 || form.syncWithInboundOrder">{{ t('subSortByOrder') }}</a-button>
                  <a-button size="small" danger @click="removeAll" :disabled="selectedInbounds.length === 0 || form.autoIncludeAllEnabled">{{ t('subClearAll') }}</a-button>
                </a-space>
              </div>
              <div class="inbound-list" style="position:relative">
                <div v-for="(item, index) in selectedInbounds" :key="item.key"
                  :class="['inbound-item', 'selected', !isItemActive(item) ? 'inactive-item' : '']"
                  :data-key="item.key"
                  :style="{ ...itemStyle(index), touchAction: 'none', userSelect: 'none' }"
                  @pointerdown="(!form.syncWithInboundOrder && !isMobileWidth()) ? onPointerDown($event, index) : null">
                  <span :class="['order-badge', isItemActive(item) ? '' : 'order-badge-disabled']">{{ index + 1 }}</span>
                  <div style="display:flex;flex-direction:column;flex:1;min-width:0">
                    <span class="item-remark" style="font-weight:500">{{ item.remark }}</span>
                    <span v-if="item.label" :class="['client-email', !isItemActive(item) ? 'text-danger' : '']">{{ item.label }}</span>
                  </div>
                  <span v-if="!form.syncWithInboundOrder && !isMobileWidth()" class="drag-handle">⠿</span>
                  <a-button size="small" @click="moveUp(index)" :disabled="index === 0 || form.syncWithInboundOrder" class="move-btn">↑</a-button>
                  <a-button size="small" @click="moveDown(index)" :disabled="index === selectedInbounds.length - 1 || form.syncWithInboundOrder" class="move-btn">↓</a-button>
                  <a-button size="small" danger type="link" @click="removeItem(index)" v-if="!form.autoIncludeAllEnabled">✕</a-button>
                </div>
                <div v-if="selectedInbounds.length === 0" class="empty-hint">{{ t('subSelectFromLeft') }}</div>
              </div>
            </div>
          </a-col>
        </a-row>
      </a-tab-pane>

      <!-- === Tab 3: Info === -->
      <a-tab-pane key="info" :tab="t('subInfo')">
        <a-form layout="vertical">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item :label="t('subShowInfo')">
                <a-switch v-model:checked="form.showInfo" />
                <div class="form-hint">{{ t('subShowInfoHint') }}</div>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('subEmailInRemark')">
                <a-switch v-model:checked="form.emailInRemark" />
                <div class="form-hint">{{ t('subEmailInRemarkHint') }}</div>
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item :label="t('subSupportUrl')">
                <a-input v-model:value="form.supportUrl" placeholder="https://..." />
                <div class="form-hint">{{ t('subSupportUrlHint') }}</div>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="t('subProfileUrl')">
                <a-input v-model:value="form.profileUrl" placeholder="https://..." />
                <div class="form-hint">{{ t('subProfileUrlHint') }}</div>
              </a-form-item>
            </a-col>
          </a-row>
          <a-form-item :label="t('subAnnounce')">
            <a-textarea v-model:value="form.announce" :rows="3" :placeholder="t('subAnnouncePlaceholder')" />
          </a-form-item>
        </a-form>
      </a-tab-pane>
    </a-tabs>
  </a-modal>
</template>

<style scoped>
.panel-box {
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  padding: 8px;
  min-height: 240px;
  max-height: 380px;
  display: flex;
  flex-direction: column;
}
.inbound-list { flex: 1; overflow-y: auto; }
.inbound-item {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px; border-radius: 3px; margin-bottom: 2px;
  cursor: pointer; font-size: 13px; transition: background 0.15s; color: inherit;
}
.inbound-item:hover {
  background: #f0f5ff;
}
.is-dragging-inbounds .inbound-item.selected {
  border: none !important;
  background: #fafafa;
}
.is-dragging-inbounds .inbound-item.selected:hover {
  background: #fafafa;
}
.sub-form-dark .is-dragging-inbounds .inbound-item.selected {
  background: #383838;
}
.sub-form-ultra .is-dragging-inbounds .inbound-item.selected {
  background: #222;
}
.inbound-item.selected {
  cursor: grab; border: 1px solid #e8e8e8; background: #fafafa;
}
.inbound-item.selected:hover {
  background: #f0f5ff;
  border-color: var(--ant-primary-color, #1890ff);
}

.item-title { font-weight: 500; flex-shrink: 0; }
.item-remark { color: #999; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.client-email { font-size: 11px; color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.disabled-tag { font-size: 10px; color: #999; background: #f5f5f5; padding: 0 5px; border-radius: 3px; }
.add-btn { margin-left: auto; color: var(--ant-primary-color, #1890ff); font-weight: bold; font-size: 16px; }
.drag-handle { cursor: grab; color: #bbb; font-size: 14px; margin-left: auto; }
.order-badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--ant-primary-color, #1890ff); color: #fff;
  font-size: 11px; font-weight: 600; flex-shrink: 0;
}
.move-btn { font-size: 12px; padding: 0 4px; min-width: 24px; }
.add-btn-disabled { color: #ff4d4f !important; }
.order-badge-disabled { background: #ff4d4f !important; }
.disabled-hint { font-size: 11px; color: #999; margin-top: 4px; min-height: 16px; }
.empty-hint { color: #bbb; text-align: center; padding: 40px 0; font-size: 13px; }
.text-danger { color: #ff4d4f !important; }
.inactive-item { opacity: 0.55; }
.form-hint { font-size: 12px; color: #999; margin-top: 4px; min-height: 18px; }
.expiry-row { display: flex; align-items: center; gap: 8px; min-height: 32px; }
.expiry-label { font-size: 13px; white-space: nowrap; }
/* Custom 3-column time dropdown */
.time-picker-wrap { position: relative; vertical-align: top; }
.time-dropdown {
  position: absolute; top: 100%; left: 0; z-index: 1050;
  background: #fff; border: 1px solid #d9d9d9;
  border-radius: 6px; box-shadow: 0 6px 16px rgba(0,0,0,0.08);
  margin-top: 4px; overflow: hidden;
}
.time-cols-wrap { display: flex; }
.time-col {
  width: 50px; max-height: 210px; overflow-y: auto;
  border-right: 1px solid #f0f0f0; text-align: center;
}
.time-col:last-child { border-right: none; }
.time-col::-webkit-scrollbar { width: 4px; }
.time-col::-webkit-scrollbar-thumb { background: #d9d9d9; border-radius: 2px; }
.time-col::-webkit-scrollbar-track { background: transparent; }
.time-opt {
  padding: 3px 6px; font-size: 13px; cursor: pointer; color: #333;
  transition: background 0.1s; font-variant-numeric: tabular-nums;
}
.time-opt:hover { background: #f0f0f0; }
.time-opt.on { background: #e6f4ff; color: #1677ff; font-weight: 600; }
.time-now-btn {
  border-top: 1px solid #f0f0f0; padding: 5px 0; text-align: center;
  cursor: pointer; font-size: 13px; color: #1677ff; transition: background 0.15s;
}
.time-now-btn:hover { background: #f0f0f0; }
/* Dark mode for time dropdown */
.sub-form-dark .time-dropdown { background: #252526; border-color: #444; }
.sub-form-dark .time-col { border-color: #333; }
.sub-form-dark .time-col::-webkit-scrollbar-thumb { background: #555; }
.sub-form-dark .time-opt { color: #ccc; }
.sub-form-dark .time-opt:hover { background: #333; }
.sub-form-dark .time-opt.on { background: #1a3a5c; color: #4096ff; }
.sub-form-dark .time-now-btn { border-color: #333; color: #4096ff; }
.sub-form-dark .time-now-btn:hover { background: #333; }
/* Ultra dark mode — match date picker background (#1e1e1e) */
.sub-form-ultra .time-dropdown { background: #1e1e1e; border-color: #333; }
.sub-form-ultra .time-col { border-color: #2a2a2a; }
.sub-form-ultra .time-col::-webkit-scrollbar-thumb { background: #444; }
.sub-form-ultra .time-opt { color: #bbb; }
.sub-form-ultra .time-opt:hover { background: #252525; }
.sub-form-ultra .time-opt.on { background: #1a3050; color: #4096ff; }
.sub-form-ultra .time-now-btn { border-color: #2a2a2a; color: #4096ff; }
.sub-form-ultra .time-now-btn:hover { background: #252525; }
</style>

<!-- Non-scoped: reach elements teleported to <body> -->
<style>
/* === Dark mode — only custom (non-ant) elements === */
.sub-form-dark { color: #e0e0e0; }
.sub-form-dark .panel-box { border-color: #444; background: #252526; }
.sub-form-dark .inbound-item { color: #d0d0d0; }
.sub-form-dark .inbound-item:hover { background: #333; }
.sub-form-dark .inbound-item.selected { background: #383838; border-color: #555; color: #f0f0f0; }
.sub-form-dark .inbound-item.selected:hover { background: #404040; border-color: var(--ant-primary-color, #1890ff); }
.sub-form-dark .item-remark { color: #888; }
.sub-form-dark .disabled-tag { background: #444; color: #999; }
.sub-form-dark .drag-handle { color: #666; }
.sub-form-dark .empty-hint { color: #555; }
.sub-form-dark .form-hint { color: #888; }
.sub-form-dark .expiry-label { color: #bbb; }
.sub-form-dark .inbound-list::-webkit-scrollbar { width: 8px; }
.sub-form-dark .inbound-list::-webkit-scrollbar-track { background: #1e1e1e; }
.sub-form-dark .inbound-list::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }

/* === Ultra dark mode — only custom (non-ant) elements === */
.sub-form-ultra .panel-box { border-color: #444; background: #111; }
.sub-form-ultra .inbound-item { color: #c0c0c0; }
.sub-form-ultra .inbound-item:hover { background: #1a1e24; }
.sub-form-ultra .inbound-item.selected { background: #222; border-color: #444; color: #e0e0e0; }
.sub-form-ultra .inbound-item.selected:hover { background: #333; }
.sub-form-ultra .inbound-list::-webkit-scrollbar-track { background: #0c0e12; }
.sub-form-ultra .inbound-list::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
.sub-form-ultra .time-col::-webkit-scrollbar-thumb { background: #333; }

/* Allow multi-line text in inbound items */
.inbound-item .item-remark { white-space: normal; word-break: break-word; flex: 1; min-width: 0; }
.inbound-item .item-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px; }

/* Mobile: vertical spacing between the two panels */
@media (max-width: 767px) {
  .inbounds-panel-col { margin-bottom: 16px; }
  .inbounds-panel-col:last-child { margin-bottom: 0; }
}

/* Drag target highlight — inline style on the element handles background + border */
:global(.is-dark) .inbound-item.selected.drag-target { color: #e0e0e0 !important; }
:global(.is-ultra) .inbound-item.selected.drag-target { color: #c0c0c0 !important; }
/* User-Agent tags wrapper — keeps dropdown inside the hover zone */
.ua-select-wrap { position: relative; }
.ua-select-wrap .ant-select-dropdown { position: absolute; margin-top: -4px !important; margin-bottom: -4px !important; }
/* Disabled indicator hint */
.disabled-hint-row { display: flex; justify-content: center; }
.disabled-hint-text { font-size: 12px; color: #999; white-space: nowrap; }
/* Time dropdown fade+slide animation */
.tf-enter-active { animation: tfIn 0.2s ease-out; }
.tf-leave-active { animation: tfOut 0.15s ease-in; }
@keyframes tfIn  { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
@keyframes tfOut { from { opacity:1; } to { opacity:0; } }
</style>
