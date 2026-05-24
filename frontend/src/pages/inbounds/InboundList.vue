<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import {
  PlusOutlined,
  MenuOutlined,
  SearchOutlined,
  FilterOutlined,
  MoreOutlined,
  EditOutlined,
  QrcodeOutlined,
  UserAddOutlined,
  UsergroupAddOutlined,
  CopyOutlined,
  FileDoneOutlined,
  ExportOutlined,
  ImportOutlined,
  ReloadOutlined,
  RestOutlined,
  RetweetOutlined,
  BlockOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  RightOutlined,
  SortAscendingOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons-vue';

import { HttpUtil, ObjectUtil, SizeFormatter, IntlUtil, ColorUtils } from '@/utils';
import axios from 'axios';
import { DBInbound } from '@/models/dbinbound.js';
import { Inbound } from '@/models/inbound.js';
import InfinityIcon from '@/components/InfinityIcon.vue';
import ClientRowTable from './ClientRowTable.vue';
import { useDatepicker } from '@/composables/useDatepicker.js';

const { datepicker } = useDatepicker();

const { t } = useI18n();

const props = defineProps({
  dbInbounds: { type: Array, required: true },
  clientCount: { type: Object, required: true },
  onlineClients: { type: Array, required: true },
  lastOnlineMap: { type: Object, default: () => ({}) },
  expireDiff: { type: Number, default: 0 },
  trafficDiff: { type: Number, default: 0 },
  pageSize: { type: Number, default: 0 },
  isMobile: { type: Boolean, default: false },
  isDarkTheme: { type: Boolean, default: false },
  subEnable: { type: Boolean, default: false },
  // Map node id -> node row, supplied by the parent page so each
  // inbound row can render its node name without an extra fetch.
  nodesById: { type: Map, default: () => new Map() },
  hasActiveNode: { type: Boolean, default: false },
  statsVersion: { type: Number, default: 0 },
  selectedIds: { type: Array, default: () => [] },
  subCountMap: { type: Object, default: () => ({}) },
  portConflictMap: { type: Object, default: () => ({}) },
  // inboundId → number[] : selected clientId values within each inbound
  selectedClientIds: { type: Object, default: () => ({}) },
});

const emit = defineEmits([
  'refresh',
  'add-inbound',
  'general-action',
  'row-action',
  'update:selected-ids',
  'update:selected-client-ids',
  'toggle-enable',
  // Per-client events surfaced from the expand-row table.
  'edit-client',
  'qrcode-client',
  'info-client',
  'reset-traffic-client',
  'delete-client',
  'delete-clients',
  'toggle-enable-client',
]);

const tableScrollY = ref(500);
const tableWrapperRef = ref(null);
let tableRo = null;

const scrollX = computed(() => {
  // 40 checkbox + 28 expand + 30 rowNo + 60 action + 55 enable
  let w = 32 + 30 + 30 + 60 + 55;
  if (hasAnyRemark.value) w += 80;
  if (props.hasActiveNode) w += 70;
  // port + protocol + subCount + clients + traffic + allTime + expiry
  w += 55 + 150 + 45 + 60 + 90 + 95 + 60;
  return w;
});

function calcTableScrollY() {
  const el = tableWrapperRef.value;
  if (el) {
    tableScrollY.value = Math.max(300, window.innerHeight - el.getBoundingClientRect().top - 55);
  } else {
    tableScrollY.value = Math.max(300, window.innerHeight - 300);
  }
}

onMounted(() => {
  nextTick(() => {
    const el = tableWrapperRef.value;
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

// Auto-expand multi-client inbounds when selected via checkbox
const expandedRowKeys = ref([]);
// Incremented on every expand to give ClientRowTable a unique key.
// When the user collapses and re-expands a row this counter forces
// the component to re-mount so watch(clients, {immediate:true}) picks
// up the first client again.
const expandCounter = reactive({});
// When an inbound id is in this set, ClientRowTable will NOT auto-select
// the first client on mount.  Set by manual expand (chevron / card-head
// click) and cleared by checkbox-triggered expand, so that only the
// checkbox path triggers auto-selection.
const suppressAutoSelect = reactive(new Set());
watch(() => props.selectedIds, (ids) => {
  const next = new Set(expandedRowKeys.value);
  const inbounds = props.dbInbounds || [];
  for (const ib of inbounds) {
    const clientCount = props.clientCount[ib.id]?.clients || 0;
    if (clientCount > 1) {
      if (ids.includes(ib.id)) {
        if (!expandedRowKeys.value.includes(ib.id)) {
          expandCounter[ib.id] = (expandCounter[ib.id] || 0) + 1;
        }
        next.add(ib.id);
        // Checkbox-triggered expand — allow auto-select.
        suppressAutoSelect.delete(ib.id);
      } else {
        next.delete(ib.id);
      }
    }
  }
  expandedRowKeys.value = Array.from(next);
}, { deep: true });

function onExpand(expanded, record) {
  const keys = new Set(expandedRowKeys.value);
  if (expanded) {
    keys.add(record.id);
    if (!expandCounter[record.id]) expandCounter[record.id] = 0;
    expandCounter[record.id]++;
    // Manual expand via chevron — suppress auto-select so the first
    // client isn't picked automatically.
    suppressAutoSelect.add(record.id);
    nextTick(() => { suppressAutoSelect.delete(record.id); });
  } else {
    keys.delete(record.id);
  }
  expandedRowKeys.value = Array.from(keys);
}

// ============ Toolbar / search & filter =============================
const FILTER_STATE_KEY = 'inboundsFilterState';
const savedFilterState = (() => {
  try {
    return JSON.parse(localStorage.getItem(FILTER_STATE_KEY) || '{}');
  } catch (_e) {
    return {};
  }
})();
const enableFilter = ref(!!savedFilterState.enableFilter);
const searchKey = ref(savedFilterState.searchKey || '');
const filterBy = ref(savedFilterState.filterBy || '');
const protocolFilter = ref(savedFilterState.protocolFilter || undefined);
const nodeFilter = ref(savedFilterState.nodeFilter || '');

watch([enableFilter, searchKey, filterBy, protocolFilter, nodeFilter], () => {
  localStorage.setItem(FILTER_STATE_KEY, JSON.stringify({
    enableFilter: enableFilter.value,
    searchKey: searchKey.value,
    filterBy: filterBy.value,
    protocolFilter: protocolFilter.value,
    nodeFilter: nodeFilter.value,
  }));
});

// Toggle the filter mode — flip cleans the other input.
function onToggleFilter() {
  if (enableFilter.value) searchKey.value = '';
  else filterBy.value = '';
}

const totalSelectedClients = computed(() => {
  let count = 0;
  const sc = props.selectedClientIds || {};
  for (const inboundIdStr of Object.keys(sc)) {
    const rowKeys = sc[inboundIdStr];
    if (!rowKeys || rowKeys.length === 0) continue;
    const inboundId = Number(inboundIdStr);
    const dbInbound = props.dbInbounds.find(ib => ib.id === inboundId);
    if (!dbInbound || !dbInbound.isMultiUser()) continue;
    const inbound = dbInbound.toInbound();
    const clients = inbound?.clients || [];
    if (clients.length <= 1) continue;
    for (const client of clients) {
      const key = client.email || client.id || client.password || JSON.stringify(client);
      if (rowKeys.includes(key)) count++;
    }
  }
  return count;
});

const protocolOptions = computed(() => {
  const values = new Set(props.dbInbounds.map((i) => i.protocol).filter(Boolean));
  return [...values].sort();
});

const nodeOptions = computed(() => {
  const values = new Map();
  if (props.dbInbounds.some((i) => i.nodeId == null)) {
    values.set('local', t('pages.inbounds.localPanel'));
  }
  for (const dbInbound of props.dbInbounds) {
    if (dbInbound.nodeId == null) continue;
    const node = props.nodesById.get(dbInbound.nodeId);
    values.set(String(dbInbound.nodeId), node?.name || `#${dbInbound.nodeId}`);
  }
  return [...values.entries()].map(([value, label]) => ({ value, label }));
});

function applySecondaryFilters(rows) {
  return rows.filter((dbInbound) => {
    if (protocolFilter.value && dbInbound.protocol !== protocolFilter.value) return false;
    if (nodeFilter.value) {
      const nodeValue = dbInbound.nodeId == null ? 'local' : String(dbInbound.nodeId);
      if (nodeValue !== nodeFilter.value) return false;
    }
    return true;
  });
}

// ============ Search / filter projection =============================
// Mirrors the legacy logic: when searching, keep inbounds that match
// anywhere (deep search); when filtering, keep inbounds that have at
// least one client in the requested bucket and reduce their settings
// to that bucket.
function projectInbound(dbInbound, predicate) {
  const next = new DBInbound(dbInbound);
  let settings;
  try {
    settings = JSON.parse(dbInbound.settings || '{}');
  } catch (_e) {
    settings = {};
  }
  if (!Array.isArray(settings.clients)) return next;
  const filtered = settings.clients.filter(predicate);
  next.settings = Inbound.Settings.fromJson(dbInbound.protocol, { clients: filtered });
  next.invalidateCache();
  return next;
}

const visibleInbounds = computed(() => {
  if (enableFilter.value) {
    if (ObjectUtil.isEmpty(filterBy.value)) return applySecondaryFilters([...props.dbInbounds]);
    const out = [];
    for (const dbInbound of props.dbInbounds) {
      const c = props.clientCount[dbInbound.id];
      if (!c || !c[filterBy.value] || c[filterBy.value].length === 0) continue;
      const list = c[filterBy.value];
      out.push(projectInbound(dbInbound, (client) => list.includes(client.email)));
    }
    return applySecondaryFilters(out);
  }
  if (ObjectUtil.isEmpty(searchKey.value)) return applySecondaryFilters([...props.dbInbounds]);
  const out = [];
  for (const dbInbound of props.dbInbounds) {
    if (!ObjectUtil.deepSearch(dbInbound, searchKey.value)) continue;
    out.push(projectInbound(dbInbound, (client) => ObjectUtil.deepSearch(client, searchKey.value)));
  }
  return applySecondaryFilters(out);
});

// ============ Sorting =================================================
const sortState = ref({ column: null, order: null });

function sortableCol(col, key) {
  return {
    ...col,
    sorter: true,
    showSorterTooltip: false,
    sortOrder: sortState.value.column === key ? sortState.value.order : null,
    sortDirections: ['ascend', 'descend'],
  };
}

const sortFns = {
  id: (a, b) => a.id - b.id,
  enable: (a, b) => Number(a.enable) - Number(b.enable),
  remark: (a, b) => (a.remark || '').localeCompare(b.remark || ''),
  port: (a, b) => a.port - b.port,
  protocol: (a, b) => {
    const ia = a.toInbound();
    const ib = b.toInbound();
    const sa = ia.stream;
    const sb = ib.stream;

    // Level 1: protocol type
    const PROTO_ORDER = ['vless','hysteria2','hysteria','trojan','vmess','shadowsocks','http','tunnel','mixed','wireguard'];
    const pa = PROTO_ORDER.indexOf(a.protocol);
    const pb = PROTO_ORDER.indexOf(b.protocol);
    if (pa !== pb) return pa - pb;

    // Level 2: network (transport) — hysteria always sorts as "udp"
    const NET_ORDER = ['tcp','xhttp','grpc','httpupgrade','ws','kcp','http','udp','none'];
    const getNet = (r, strm) => r.isHysteria ? 'udp' : (strm.network || 'none');
    const na = NET_ORDER.indexOf(getNet(a, sa));
    const nb = NET_ORDER.indexOf(getNet(b, sb));
    if (na !== nb) return na - nb;

    // Level 3: security — reality > tls > none
    const secVal = (s) => {
      if (s.isReality) return 0;
      if (s.isTls) return 1;
      return 2;
    };
    const sea = secVal(sa);
    const seb = secVal(sb);
    if (sea !== seb) return sea - seb;

    // Level 4: ECH PQ group — ml-kem-768 > x25519 > none
    const echPq = (s) => {
      const list = s.tls?.settings?.echConfigList || '';
      if (list.includes('ml-kem-768')) return 0;
      if (list.includes('x25519')) return 1;
      return 2;
    };
    const e4a = echPq(sa);
    const e4b = echPq(sb);
    if (e4a !== e4b) return e4a - e4b;

    // Level 5: MLDSA65 — has > doesn't have
    const mlA = !!(sa.reality?.settings?.mldsa65Verify);
    const mlB = !!(sb.reality?.settings?.mldsa65Verify);
    if (mlA !== mlB) return mlA ? -1 : 1;

    // Level 6: ECH server keys — has > doesn't have
    const echA = !!(sa.tls?.echServerKeys);
    const echB = !!(sb.tls?.echServerKeys);
    return echA === echB ? 0 : echA ? -1 : 1;
  },
  traffic: (a, b) => (a.up + a.down) - (b.up + b.down),
  allTimeInbound: (a, b) => (a.allTime || 0) - (b.allTime || 0),
  expiryTime: (a, b) => (a.expiryTime || Infinity) - (b.expiryTime || Infinity),
  node: (a, b) => {
    const nameA = props.nodesById.get(a.nodeId)?.name ?? (a.nodeId == null ? '\uffff' : `node #${a.nodeId}`);
    const nameB = props.nodesById.get(b.nodeId)?.name ?? (b.nodeId == null ? '\uffff' : `node #${b.nodeId}`);
    return nameA.localeCompare(nameB);
  },
  clients: (a, b) => (props.clientCount[a.id]?.clients || 0) - (props.clientCount[b.id]?.clients || 0),
};

const sortedInbounds = computed(() => {
  const { column, order } = sortState.value;
  if (!column || !order) return visibleInbounds.value;
  const fn = sortFns[column];
  if (!fn) return visibleInbounds.value;
  const sorted = [...visibleInbounds.value].sort(fn);
  return order === 'descend' ? sorted.reverse() : sorted;
});



function onTableChange(_pag, _filters, sorter) {
  if (reorderMode.value) return;
  sortState.value = {
    column: sorter?.columnKey || sorter?.field || null,
    order: sorter?.order || null,
  };
}

watch([searchKey, filterBy], () => {
  sortState.value = { column: null, order: null };
});

// ============ Columns =================================================
// `key`-driven so we can render via the body-cell slot below. AD-Vue 4's
// `responsive` array still works on column defs. Computed so column
// labels react to live locale switches.
const hasAnyRemark = computed(() =>
  props.dbInbounds.some((i) => typeof i?.remark === 'string' && i.remark.trim() !== ''),
);

const desktopColumns = computed(() => {
  const cols = [
    { title: '#', key: 'rowNo', align: 'right', width: 30 },
    { title: t('pages.inbounds.operate'), key: 'action', align: 'center', width: 60 },
    sortableCol({ title: t('pages.inbounds.enable'), key: 'enable', align: 'center', width: 55 }, 'enable'),
  ];
  if (hasAnyRemark.value) {
    cols.push(sortableCol({ title: t('pages.inbounds.remark'), dataIndex: 'remark', key: 'remark', align: 'center', width: 80 }, 'remark'));
  }
  if (props.hasActiveNode) {
    cols.push(sortableCol({ title: t('pages.inbounds.node'), key: 'node', align: 'center', width: 70 }, 'node'));
  }
  cols.push(
    sortableCol({ title: t('pages.inbounds.port'), dataIndex: 'port', key: 'port', align: 'center', width: 55 }, 'port'),
    sortableCol({ title: t('pages.inbounds.protocol'), key: 'protocol', align: 'center', width: 150 }, 'protocol'),
    sortableCol({ title: t('pages.inbounds.subCount'), key: 'subCount', align: 'center', width: 45 }, 'subCount'),
    sortableCol({ title: t('clients'), key: 'clients', align: 'center', width: 60 }, 'clients'),
    sortableCol({ title: t('pages.inbounds.traffic'), key: 'traffic', align: 'center', width: 90 }, 'traffic'),
    sortableCol({ title: t('pages.inbounds.allTimeTraffic'), key: 'allTimeInbound', align: 'center', width: 95 }, 'allTimeInbound'),
    sortableCol({ title: t('pages.inbounds.expireDate'), key: 'expiryTime', align: 'center', width: 60 }, 'expiryTime'),
  );
  return cols;
});
const columns = computed(() => desktopColumns.value);

// Mobile expansion state — replaces a-table's expandable() since the
// mobile branch renders a hand-rolled card list rather than a table.
const expandedIds = ref(new Set());
function toggleExpanded(id) {
  const next = new Set(expandedIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
    // Manual expand on mobile — suppress auto-select so the first
    // client isn't picked automatically.
    if (!expandCounter[id]) expandCounter[id] = 0;
    expandCounter[id]++;
    suppressAutoSelect.add(id);
    nextTick(() => { suppressAutoSelect.delete(id); });
  }
  expandedIds.value = next;
}
function isExpanded(id) {
  return expandedIds.value.has(id);
}

// Sync mobile expansion state with checkbox selection:
// auto-expand multi-client inbounds when selected, collapse when deselected.
watch(() => props.selectedIds, (ids) => {
  const next = new Set(expandedIds.value);
  const inbounds = props.dbInbounds || [];
  for (const ib of inbounds) {
    const clientCount = props.clientCount[ib.id]?.clients || 0;
    if (clientCount > 1) {
      if (ids.includes(ib.id)) {
        if (!expandedIds.value.has(ib.id)) {
          expandCounter[ib.id] = (expandCounter[ib.id] || 0) + 1;
        }
        next.add(ib.id);
        suppressAutoSelect.delete(ib.id);
      } else {
        next.delete(ib.id);
      }
    }
  }
  expandedIds.value = next;
});

const statsRecord = ref(null);
const statsIndex = ref(0);
function openStats(record, idx) {
  statsRecord.value = record;
  statsIndex.value = idx;
}
function closeStats() {
  statsRecord.value = null;
}

// ============ Manual reorder (drag & drop) ============================
const reorderMode = ref(false);
const reorderData = ref([]);
let snapshotBeforeReorder = [];

function enterReorder() {
  // Use the full sorted list (bypass search/filter) so the user can
  // rearrange all inbounds at once.  Sort by the current column or by
  // sort_order/id as a starting point.
  let items = [...props.dbInbounds];
  const { column, order } = sortState.value;
  if (column && order && sortFns[column]) {
    items.sort(sortFns[column]);
    if (order === 'descend') items.reverse();
  }
  snapshotBeforeReorder = items.map((r) => r.id);
  reorderData.value = items;  // keep original DBInbound instances (methods intact)
  reorderMode.value = true;
}

function cancelReorder() {
  // Restore the original ordering by snapshot IDs before reorder started
  if (snapshotBeforeReorder.length) {
    const byId = new Map(props.dbInbounds.map((r) => [r.id, r]));
    reorderData.value = snapshotBeforeReorder.map((id) => byId.get(id)).filter(Boolean);
  }
  snapshotBeforeReorder = [];
  reorderMode.value = false;
  reorderData.value = [];
  removeDragStyle();
}

async function confirmReorder() {
  const ids = reorderData.value.map((r) => r.id);
  try {
    const res = await HttpUtil.post('/panel/api/inbounds/reorder', { ids }, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res?.success) throw new Error(res?.msg || 'reorder failed');
  } catch (_e) {
    return;
  }
  reorderMode.value = false;
  reorderData.value = [];
  snapshotBeforeReorder = [];
  removeDragStyle();
  emit('refresh');
  await nextTick();
  message.success(t('pages.inbounds.reorderSuccess') || '排序成功');
}

// Record being dragged. We store the item key on dragstart. For desktop
// (row-level) we use IDs; for mobile (card-level) we use indices.
let dragItemId = null;

function rowReorderById(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return;
  const arr = reorderData.value;
  const fromIdx = arr.findIndex((r) => r.id === fromId);
  const toIdx = arr.findIndex((r) => r.id === toId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
  const [moved] = arr.splice(fromIdx, 1);
  arr.splice(toIdx, 0, moved);
}

const draggedRowId = ref(null); // which row is being dragged

let dragStyle = null;

function injectDragStyle() {
  if (dragStyle) return;
  dragStyle = document.createElement('style');
  dragStyle.textContent = `.reorder-active .ant-table-tbody .ant-table-row td{background:transparent!important}.reorder-active .ant-table-tbody .ant-table-row:hover td{background:transparent!important}`;
  document.head.appendChild(dragStyle);
}

function removeDragStyle() {
  if (dragStyle) { dragStyle.remove(); dragStyle = null; }
}

// ============ Pointer Events drag & reorder (wheel/scroll works naturally) ============
// 使用事件委托 + pointerId 追踪（第二根手指可滚动）
let pointerDrag = { started: false, startY: 0 };
let dragPointerId = -1; // 拖拽的 pointerId，非该 id 的事件放行（允许双指滚动）

function initTablePointerDrag() {
  const table = document.querySelector('.ant-table');
  if (!table || table._ptrInit) return;
  table._ptrInit = true;
  table.addEventListener('pointerdown', (e) => {
    if (!reorderMode.value) return;
    const row = e.target.closest('.ant-table-row');
    if (!row) return;
    const rowId = Number(row.getAttribute('data-row-key'));
    if (!rowId) return;
    const rec = reorderData.value.find(r => r.id === rowId);
    if (!rec) return;
    e.preventDefault();
    dragPointerId = e.pointerId;
    pointerDrag = { started: false, startY: e.clientY, _record: rec };
    document.addEventListener('pointermove', onRowPointerMove);
    document.addEventListener('pointerup', onRowPointerUp);
  });
}
function onRowPointerMove(e) {
  if (e.pointerId !== dragPointerId) return; // 非拖拽指针：放行（让浏览器处理滚动）
  e.preventDefault();
  if (!pointerDrag.started) {
    if (Math.abs(e.clientY - pointerDrag.startY) < 5) return;
    pointerDrag.started = true;
    const rec = pointerDrag._record;
    if (rec) { dragItemId = rec.id; draggedRowId.value = rec.id; injectDragStyle(); }
  }
  if (!dragItemId) return;
  const rows = document.querySelectorAll('.ant-table-row');
  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    if (e.clientY >= rect.top && e.clientY < rect.bottom) {
      const rowId = Number(row.getAttribute('data-row-key'));
      if (rowId && rowId !== dragItemId) { rowReorderById(dragItemId, rowId); draggedRowId.value = dragItemId; }
      break;
    }
  }
}
function onRowPointerUp() {
  document.removeEventListener('pointermove', onRowPointerMove);
  document.removeEventListener('pointerup', onRowPointerUp);
  cleanupDragState();
}
function cleanupDragState() {
  dragItemId = null; draggedRowId.value = null;
  if (reorderData.value) reorderData.value = [...reorderData.value];
  document.activeElement?.blur(); window.getSelection()?.removeAllRanges();
  document.querySelectorAll('.ant-table-row').forEach(r => r.dispatchEvent(new MouseEvent('mouseleave')));
  removeDragStyle();
  dragPointerId = -1;
  pointerDrag = { started: false, startY: 0 };
}
// Deferred init: wait for DOM ready, then set up pointer delegation
setTimeout(initTablePointerDrag, 50);

// === HTML5 DnD (kept for fallback — see reorderRowProps below) ===
function onRowDragStart(e, record) {}  /* unused, kept for reference */
function onRowDragOver(e, targetRecord) {} /* unused */
function onRowDrop(e, targetRecord) {} /* unused */

// ============ Pagination ============================================
function paginationFor(rows) {
  const size = props.pageSize > 0 ? props.pageSize : rows.length || 1;
  return {
    pageSize: size,
    showSizeChanger: false,
    hideOnSinglePage: true,
  };
}

// ============ Row props for reorder mode ================
function rowProps(record) { return {}; }
const displayColumns = computed(() => {
  if (reorderMode.value) return [...columns.value, { title: '操作', key: 'reorder-actions', width: 90 }];
  return columns.value;
});
function reorderRowProps(record) {
  const isDragged = draggedRowId.value === record.id;
  const isUltra = typeof document !== 'undefined' && document.querySelector('.inbounds-page.is-ultra') !== null;
  const darkBg = isUltra ? '#0c0e12' : '#252526';
  const defaultBg = props.isDarkTheme ? darkBg : '#fff';
  const bg = isDragged ? (props.isDarkTheme ? 'rgba(24,144,255,0.45)' : '#d6e9ff') : defaultBg;
  return {
    'data-row-key': record.id,
    // 保留事件处理器但 draggable=false 以阻止 HTML5 DnD
    draggable: false,
    onDragstart: (e) => { e.preventDefault(); /* no-op */ },
    onDragover: (e) => { e.preventDefault(); /* no-op */ },
    onDrop: (e) => { e.preventDefault(); /* no-op */ },
    onDragend: (e) => { e.preventDefault(); /* no-op */ },
    // Pointer Events via delegation (initTablePointerDrag)
    style: {
      cursor: 'grab',
      background: bg,
      outline: isDragged ? '2px dashed #1890ff' : 'none',
      outlineOffset: isDragged ? '-2px' : '0',
    },
  };
}

function moveRow(idx, dir) {
  const to = idx + dir;
  if (to < 0 || to >= reorderData.value.length) return;
  const arr = reorderData.value;
  [arr[idx], arr[to]] = [arr[to], arr[idx]];
}

// ============ Per-row enable switch =================================
async function onSwitchEnable(dbInbound, next) {
  const previous = dbInbound.enable;
  dbInbound.enable = next; // optimistic
  // Force shallowRef re-render so the switch shows the new state immediately.
  emit('toggle-enable');
  // Suppress the invalidate→refresh race: the backend broadcasts an
  // invalidate event after setEnable, but refresh() may fetch stale DB
  // state. Our optimistic update + API response are sufficient.
  if (window.__setSkipInvalidate) window.__setSkipInvalidate(1000);
  try {
    const msg = (await axios.post(`/panel/api/inbounds/setEnable/${dbInbound.id}`, { enable: next })).data;
    if (!msg?.success) {
      dbInbound.enable = previous;
      emit('toggle-enable');
      if (msg?.msg) {
        // Backend returns: "Port X confict with enabled inbounds: remark1,remark2"
        const conflictMatch = msg.msg.match(/confict with enabled inbounds: (.+)/);
        if (conflictMatch) {
          const names = conflictMatch[1];
          message.warning(t('subPortConflict', { port: dbInbound.port, names }));
        }
        return;
      }
    }
  } catch (_e) {
    dbInbound.enable = previous;
    emit('toggle-enable');
  }
}

// ============ Helpers shared with the templates =====================
// Whether to show the "Switch xray" / qrcode menu entry — same predicate
// as legacy: SS single-user inbounds and WireGuard inbounds expose
// inbound-wide QR codes.
function showQrCodeMenu(dbInbound) {
  if (dbInbound.isWireguard) return true;
  if (dbInbound.isSS) {
    try {
      return !dbInbound.toInbound().isSSMultiUser;
    } catch (_e) {
      return false;
    }
  }
  return false;
}
</script>

<template>
  <a-card hoverable>
    <template #title>
      <a-space direction="horizontal">
        <a-button type="primary" @click="emit('add-inbound')">
          <template #icon>
            <PlusOutlined />
          </template>
          <template v-if="!isMobile">{{ t('pages.inbounds.addInbound') }}</template>
        </a-button>
        <a-dropdown :trigger="['click']">
          <a-button type="primary">
            <template #icon>
              <MenuOutlined />
            </template>
            <template v-if="!isMobile">{{ t('pages.inbounds.generalActions') }}</template>
          </a-button>
          <template #overlay>
            <a-menu @click="(a) => emit('general-action', a.key)">
              <a-menu-item v-if="props.selectedIds.length >= 2" key="batchEdit">
                <EditOutlined /> {{ t('pages.inbounds.batchEditInbounds') }}
              </a-menu-item>
              <a-menu-item key="import">
                <ImportOutlined /> {{ t('pages.inbounds.importInbound') }}
              </a-menu-item>
              <a-menu-item key="export">
                <ExportOutlined /> {{ t('subExportInbound') }}
              </a-menu-item>
              <a-menu-item v-if="subEnable" key="subs">
                <ExportOutlined /> {{ t('subExportSub') }}
              </a-menu-item>
              <a-menu-item key="resetInbounds">
                <ReloadOutlined /> {{ t('pages.inbounds.resetAllTraffic') }}
              </a-menu-item>
              <a-menu-item key="resetClients">
                <FileDoneOutlined /> {{ t('pages.inbounds.resetAllClientTraffics') }}
              </a-menu-item>
              <a-menu-item key="delDepletedClients" class="danger-item">
                <RestOutlined /> {{ t('pages.inbounds.delDepletedClients') }}
              </a-menu-item>
              <a-menu-item v-if="props.selectedIds.length >= 2" key="batchDelInbounds" class="danger-item">
                <DeleteOutlined /> {{ t('pages.inbounds.batchDeleteInbounds') }}
              </a-menu-item>
              <a-menu-item v-if="totalSelectedClients >= 2" key="batchDelClients" class="danger-item">
                <DeleteOutlined /> {{ t('pages.inbounds.batchDeleteClients') }}
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </a-space>
    </template>

    <a-space direction="vertical" :style="{ width: '100%' }">
      <!-- Search / filter toolbar -->
      <div :class="isMobile ? 'filter-bar mobile' : 'filter-bar'">
        <template v-if="!reorderMode">
          <a-switch v-model:checked="enableFilter" @change="onToggleFilter">
            <template #checkedChildren>
              <SearchOutlined />
            </template>
            <template #unCheckedChildren>
              <FilterOutlined />
            </template>
          </a-switch>
          <a-input v-if="!enableFilter" v-model:value="searchKey" :placeholder="t('search')" autofocus
            :size="isMobile ? 'small' : 'middle'" :style="{ maxWidth: '300px' }" />
          <a-radio-group v-if="enableFilter" v-model:value="filterBy" button-style="solid"
            :size="isMobile ? 'small' : 'middle'">
            <a-radio-button value="">{{ t('none') }}</a-radio-button>
            <a-radio-button value="active">{{ t('subscription.active') }}</a-radio-button>
            <a-radio-button value="deactive">{{ t('disabled') }}</a-radio-button>
            <a-radio-button value="depleted">{{ t('depleted') }}</a-radio-button>
            <a-radio-button value="expiring">{{ t('depletingSoon') }}</a-radio-button>
            <a-radio-button value="online">{{ t('online') }}</a-radio-button>
          </a-radio-group>
          <a-select v-model:value="protocolFilter" allow-clear :placeholder="t('pages.inbounds.protocol')"
            :size="isMobile ? 'small' : 'middle'" :style="{ width: '150px' }">
            <a-select-option v-for="protocol in protocolOptions" :key="protocol" :value="protocol">
              {{ protocol }}
            </a-select-option>
          </a-select>
          <a-select v-if="hasActiveNode && nodeOptions.length > 0" v-model:value="nodeFilter" allow-clear
            :placeholder="t('pages.inbounds.node')" :size="isMobile ? 'small' : 'middle'" :style="{ width: '170px' }">
            <a-select-option v-for="node in nodeOptions" :key="node.value" :value="node.value">
              {{ node.label }}
            </a-select-option>
          </a-select>
          <a-button @click="enterReorder" :size="isMobile ? 'small' : 'middle'">
            <SortAscendingOutlined /> {{ t('pages.inbounds.sort') }}
          </a-button>
        </template>
        <template v-else>
          <a-button type="primary" @click="confirmReorder" :size="isMobile ? 'small' : 'middle'">
            <CheckOutlined /> {{ t('pages.inbounds.confirmSort') }}
          </a-button>
          <a-button @click="cancelReorder" :size="isMobile ? 'small' : 'middle'">
            <CloseOutlined /> {{ t('pages.inbounds.cancelSort') }}
          </a-button>
        </template>
      </div>

      <!-- ====================== Mobile: card list ======================= -->
      <div v-if="isMobile" class="inbound-cards">
        <div v-if="(reorderMode ? reorderData : visibleInbounds).length === 0" class="card-empty">—</div>

        <div v-for="(record, idx) in (reorderMode ? reorderData : sortedInbounds)" :key="record.id" class="inbound-card"
          :draggable="reorderMode ? true : false"
          @dragstart="reorderMode ? onCardDragStart($event, idx) : null"
          @dragover="reorderMode ? onCardDragOver($event, idx) : null"
          @drop="reorderMode ? onCardDrop($event, idx) : null">
          <!-- Header: checkbox + chevron (multi-user only) + row number + remark + info + enable + actions -->
          <div class="card-head" @click="record.isMultiUser() && toggleExpanded(record.id)">
            <a-checkbox class="card-check" :checked="props.selectedIds.includes(record.id)"
              @click.stop @change="(e) => { const s = new Set(props.selectedIds); if (e.target.checked) s.add(record.id); else s.delete(record.id); emit('update:selected-ids', Array.from(s)); }" />
            <RightOutlined v-if="record.isMultiUser()" class="card-expand"
              :class="{ 'is-expanded': isExpanded(record.id) }" />
            <span class="card-id">#{{ idx + 1 }}</span>
            <span class="tag-name">{{ record.remark }}</span>
            <div class="card-actions" @click.stop>
              <template v-if="reorderMode">
                <a-button size="small" :disabled="idx === 0" @click.stop="moveRow(idx, -1)">↑</a-button>
                <a-button size="small" :disabled="idx === reorderData.length - 1" @click.stop="moveRow(idx, 1)">↓</a-button>
              </template>
              <template v-if="!reorderMode">
                <a-tooltip :title="t('info')">
                  <InfoCircleOutlined class="row-action-trigger" @click="openStats(record, idx)" />
                </a-tooltip>
                <a-switch :key="'sw-' + record.id + '-' + record.enable" :checked="record.enable" size="small"
                  :class="(!record.enable && (props.portConflictMap[record.id]?.length || 0) > 0) ? 'conflict-switch' : ''"
                  @change="(next) => onSwitchEnable(record, next)" />
                <a-dropdown :trigger="['click']" placement="bottomRight">
                  <MoreOutlined class="row-action-trigger" @click.prevent />
                <template #overlay>
                  <a-menu @click="(a) => emit('row-action', { key: a.key, dbInbound: record })">
                    <a-menu-item key="edit">
                      <EditOutlined /> {{ t('edit') }}
                    </a-menu-item>
                    <a-menu-item v-if="showQrCodeMenu(record)" key="qrcode">
                      <QrcodeOutlined /> {{ t('qrCode') }}
                    </a-menu-item>
                    <template v-if="record.isMultiUser()">
                      <a-menu-item key="addClient">
                        <UserAddOutlined /> {{ t('pages.client.add') }}
                      </a-menu-item>
                      <a-menu-item key="addBulkClient">
                        <UsergroupAddOutlined /> {{ t('pages.client.bulk') }}
                      </a-menu-item>
                      <a-menu-item key="copyClients">
                        <CopyOutlined /> {{ t('pages.client.copyFromInbound') }}
                      </a-menu-item>
                      <a-menu-item key="resetClients">
                        <FileDoneOutlined /> {{ t('pages.inbounds.resetInboundClientTraffics') }}
                      </a-menu-item>
                      <a-menu-item key="export">
                        <ExportOutlined /> {{ t('subExportInbound') }}
                      </a-menu-item>
                      <a-menu-item v-if="subEnable" key="subs">
                        <ExportOutlined /> {{ t('subExportSub') }}
                      </a-menu-item>
                      <a-menu-item key="delDepletedClients" class="danger-item">
                        <RestOutlined /> {{ t('pages.inbounds.delDepletedClients') }}
                      </a-menu-item>
                    </template>
                    <template v-else>
                      <a-menu-item key="showInfo">
                        <InfoCircleOutlined /> {{ t('info') }}
                      </a-menu-item>
                    </template>
                    <a-menu-item key="clipboard">
                      <CopyOutlined /> {{ t('pages.inbounds.exportInbound') }}
                    </a-menu-item>
                    <a-menu-item key="resetTraffic">
                      <RetweetOutlined /> {{ t('pages.inbounds.resetTraffic') }}
                    </a-menu-item>
                    <a-menu-item key="clone">
                      <BlockOutlined /> {{ t('pages.inbounds.clone') }}
                    </a-menu-item>
                    <a-menu-item key="delete" class="danger-item">
                      <DeleteOutlined /> {{ t('delete') }}
                    </a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
              </template>
            </div>
          </div>

          <!-- Expanded client list (multi-user only) -->
          <div v-if="record.isMultiUser() && isExpanded(record.id)" class="card-clients">
            <ClientRowTable :key="'crt-' + record.id + '-' + (expandCounter[record.id] || 0)" :db-inbound="record" :is-mobile="true" :auto-select-first="!suppressAutoSelect.has(record.id)"
              :traffic-diff="trafficDiff" :expire-diff="expireDiff"
              :online-clients="onlineClients" :last-online-map="lastOnlineMap" :is-dark-theme="isDarkTheme"
              :page-size="pageSize" :total-client-count="clientCount[record.id]?.clients || 0"
              :stats-version="statsVersion"
              :selected-client-ids="props.selectedClientIds[record.id] || []"
              @update:selected-client-ids="(ids) => emit('update:selected-client-ids', { inboundId: record.id, ids })"
              @edit-client="(p) => emit('edit-client', p)" @qrcode-client="(p) => emit('qrcode-client', p)"
              @info-client="(p) => emit('info-client', p)"
              @reset-traffic-client="(p) => emit('reset-traffic-client', p)"
              @delete-client="(p) => emit('delete-client', p)"
              @delete-clients="(p) => emit('delete-clients', p)"
              @toggle-enable-client="(p) => emit('toggle-enable-client', p)" />
          </div>
        </div>
      </div>

      <!-- ====================== Mobile: info modal ====================== -->
      <a-modal v-if="isMobile" :open="!!statsRecord" :footer="null" :width="360" centered
        :title="statsRecord ? `#${statsIndex + 1} ${statsRecord.remark || ''}`.trim() : ''" @cancel="closeStats">
        <div v-if="statsRecord" class="card-stats">
          <div class="stat-row">
            <span class="stat-label">{{ t('pages.inbounds.protocol') }}</span>
            <a-tag color="purple">{{ statsRecord.protocol }}</a-tag>
            <template
              v-if="statsRecord.isVMess || statsRecord.isVLess || statsRecord.isTrojan || statsRecord.isSS || statsRecord.isHysteria">
              <a-tag color="green">{{ statsRecord.isHysteria ? 'UDP' : statsRecord.toInbound().stream.network }}</a-tag>
              <a-tag v-if="statsRecord.toInbound().stream.isTls" color="blue">TLS</a-tag>
              <a-tag v-if="statsRecord.toInbound().stream.isReality" color="blue">Reality</a-tag>
            </template>
          </div>
          <div class="stat-row">
            <span class="stat-label">{{ t('pages.inbounds.port') }}</span>
            <a-tag>{{ statsRecord.port }}</a-tag>
          </div>
          <div v-if="hasActiveNode" class="stat-row">
            <span class="stat-label">{{ t('pages.inbounds.node') }}</span>
            <a-tag v-if="statsRecord.nodeId == null" color="default">
              {{ t('pages.inbounds.localPanel') }}
            </a-tag>
            <a-tag v-else-if="nodesById.get(statsRecord.nodeId)"
              :color="nodesById.get(statsRecord.nodeId).status === 'online' ? 'blue' : 'red'">
              {{ nodesById.get(statsRecord.nodeId).name }}
            </a-tag>
            <a-tag v-else color="orange">#{{ statsRecord.nodeId }}</a-tag>
          </div>
          <div class="stat-row">
            <span class="stat-label">{{ t('pages.inbounds.traffic') }}</span>
            <a-tag :color="ColorUtils.usageColor(statsRecord.up + statsRecord.down, trafficDiff, statsRecord.total)">
              {{ SizeFormatter.sizeFormat(statsRecord.up + statsRecord.down) }} /
              <template v-if="statsRecord.total > 0">{{ SizeFormatter.sizeFormat(statsRecord.total) }}</template>
              <InfinityIcon v-else />
            </a-tag>
          </div>
          <div class="stat-row">
            <span class="stat-label">{{ t('pages.inbounds.allTimeTraffic') }}</span>
            <a-tag>{{ SizeFormatter.sizeFormat(statsRecord.allTime || 0) }}</a-tag>
          </div>
          <div v-if="clientCount[statsRecord.id]" class="stat-row">
            <span class="stat-label">{{ t('clients') }}</span>
            <a-tag color="green" class="client-count-tag">{{ clientCount[statsRecord.id].clients }}</a-tag>
            <a-tag v-if="clientCount[statsRecord.id].online.length" color="blue">
              {{ clientCount[statsRecord.id].online.length }} {{ t('online') }}
            </a-tag>
            <a-tag v-if="clientCount[statsRecord.id].depleted.length" color="red">
              {{ clientCount[statsRecord.id].depleted.length }} {{ t('depleted') }}
            </a-tag>
            <a-tag v-if="clientCount[statsRecord.id].expiring.length" color="orange">
              {{ clientCount[statsRecord.id].expiring.length }} {{ t('depletingSoon') }}
            </a-tag>
          </div>
          <div class="stat-row">
            <span class="stat-label">{{ t('pages.inbounds.expireDate') }}</span>
            <a-tag v-if="statsRecord.expiryTime > 0"
              :color="ColorUtils.usageColor(Date.now(), expireDiff, statsRecord._expiryTime)">
              {{ IntlUtil.formatRelativeTime(statsRecord.expiryTime) }}
            </a-tag>
            <a-tag v-else color="purple">
              <InfinityIcon />
            </a-tag>
          </div>
        </div>
      </a-modal>

      <!-- ====================== Desktop: a-table ======================== -->
      <div ref="tableWrapperRef" :class="{ 'reorder-active': reorderMode }" style="position:relative;margin-top:10px">
        <a-table :columns="displayColumns" :data-source="reorderMode ? reorderData : sortedInbounds"
          :row-key="(r) => r.id" :pagination="reorderMode ? false : paginationFor(sortedInbounds)"
          :scroll="{ x: scrollX, y: tableScrollY }" size="small" :expand-column-width="30"
          :row-class-name="(r) => (r.isMultiUser() ? '' : 'hide-expand-icon')" :custom-row="reorderMode ? reorderRowProps : rowProps"
          v-model:expandedRowKeys="expandedRowKeys" @expand="onExpand"
          :row-selection="reorderMode ? undefined : {
            selectedRowKeys: props.selectedIds,
            onChange: (keys) => emit('update:selected-ids', keys),
            columnWidth: 32,
          }"
          @change="onTableChange">
        <!-- Per-inbound client list, expanded by clicking the row's
             default expand chevron. Hidden via row-class-name for
             non-multi-user inbounds (matches legacy behavior). -->
        <template #expandedRowRender="{ record }">
          <ClientRowTable :key="'crt-' + record.id + '-' + (expandCounter[record.id] || 0)" v-if="record.isMultiUser()" :db-inbound="record" :is-mobile="isMobile" :auto-select-first="!suppressAutoSelect.has(record.id)"
            :traffic-diff="trafficDiff" :expire-diff="expireDiff" :online-clients="onlineClients"
            :last-online-map="lastOnlineMap" :is-dark-theme="isDarkTheme" :page-size="pageSize"
            :total-client-count="clientCount[record.id]?.clients || 0"
            :stats-version="statsVersion"
            :selected-client-ids="props.selectedClientIds[record.id] || []"
            @update:selected-client-ids="(ids) => emit('update:selected-client-ids', { inboundId: record.id, ids })"
            @edit-client="(p) => emit('edit-client', p)"
            @qrcode-client="(p) => emit('qrcode-client', p)" @info-client="(p) => emit('info-client', p)"
            @reset-traffic-client="(p) => emit('reset-traffic-client', p)"
            @delete-client="(p) => emit('delete-client', p)"
            @delete-clients="(p) => emit('delete-clients', p)"
            @toggle-enable-client="(p) => emit('toggle-enable-client', p)" />
        </template>

        <template #bodyCell="{ column, record, index }">
          <!-- Reorder mode: replace action column with ↑↓ buttons -->
          <template v-if="reorderMode && column.key === 'action'">
            <a-space>
              <a-button size="small" :disabled="index === 0" @click="moveRow(index, -1)">↑</a-button>
              <a-button size="small" :disabled="index === reorderData.length - 1" @click="moveRow(index, 1)">↓</a-button>
            </a-space>
          </template>
          <!-- Normal mode (or non-action columns): render as usual -->
          <template v-if="!reorderMode || column.key !== 'action'">
          <!-- ============== Row number (#) ============== -->
          <template v-if="column.key === 'rowNo'">
            {{ index + 1 }}
          </template>

          <!-- ============== Action dropdown ============== -->
          <template v-if="column.key === 'action'">
            <div class="action-buttons">
              <a-button type="text" size="small" @click.prevent="emit('row-action', {key: 'edit', dbInbound: record})">
                <template #icon>
                  <EditOutlined />
                </template>
              </a-button>

              <a-dropdown :trigger="['click']">
                <a-button type="text" size="small" @click.prevent>
                  <template #icon>
                    <MoreOutlined />
                  </template>
                </a-button>
                <template #overlay>
                  <a-menu @click="(a) => emit('row-action', { key: a.key, dbInbound: record })">
                    <a-menu-item v-if="showQrCodeMenu(record)" key="qrcode">
                      <QrcodeOutlined /> {{ t('qrCode') }}
                    </a-menu-item>
                    <template v-if="record.isMultiUser()">
                      <a-menu-item key="addClient">
                        <UserAddOutlined /> {{ t('pages.client.add') }}
                      </a-menu-item>
                      <a-menu-item key="addBulkClient">
                        <UsergroupAddOutlined /> {{ t('pages.client.bulk') }}
                      </a-menu-item>
                      <a-menu-item key="copyClients">
                        <CopyOutlined /> {{ t('pages.client.copyFromInbound') }}
                      </a-menu-item>
                      <a-menu-item key="resetClients">
                        <FileDoneOutlined /> {{ t('pages.inbounds.resetInboundClientTraffics') }}
                      </a-menu-item>
                      <a-menu-item key="export">
                        <ExportOutlined /> {{ t('subExportInbound') }}
                      </a-menu-item>
                      <a-menu-item v-if="subEnable" key="subs">
                        <ExportOutlined /> {{ t('subExportSub') }}
                      </a-menu-item>
                      <a-menu-item key="delDepletedClients" class="danger-item">
                        <RestOutlined /> {{ t('pages.inbounds.delDepletedClients') }}
                      </a-menu-item>
                    </template>
                    <template v-else>
                      <a-menu-item key="showInfo">
                        <InfoCircleOutlined /> {{ t('info') }}
                      </a-menu-item>
                    </template>
                    <a-menu-item key="clipboard">
                      <CopyOutlined /> {{ t('pages.inbounds.exportInbound') }}
                    </a-menu-item>
                    <a-menu-item key="resetTraffic">
                      <RetweetOutlined /> {{ t('pages.inbounds.resetTraffic') }}
                    </a-menu-item>
                    <a-menu-item key="clone">
                      <BlockOutlined /> {{ t('pages.inbounds.clone') }}
                    </a-menu-item>
                    <a-menu-item key="delete" class="danger-item">
                      <DeleteOutlined /> {{ t('delete') }}
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>
          </template>

          <!-- ============== Enable switch (desktop) ============== -->
          <template v-else-if="column.key === 'enable'">
            <a-switch :key="'sw-' + record.id + '-' + record.enable" :checked="record.enable"
              :class="(!record.enable && (props.portConflictMap[record.id]?.length || 0) > 0) ? 'conflict-switch' : ''"
              @change="(next) => onSwitchEnable(record, next)" />
          </template>

          <!-- ============== Node deployment tag ============== -->
          <template v-else-if="column.key === 'node'">
            <template v-if="record.nodeId == null">
              <a-tag color="default">{{ t('pages.inbounds.localPanel') }}</a-tag>
            </template>
            <template v-else-if="nodesById.get(record.nodeId)">
              <a-tag :color="nodesById.get(record.nodeId).status === 'online' ? 'blue' : 'red'">
                {{ nodesById.get(record.nodeId).name }}
              </a-tag>
            </template>
            <template v-else>
              <!-- Node row was deleted but inbound still references it. -->
              <a-tag color="orange">node #{{ record.nodeId }}</a-tag>
            </template>
          </template>

          <!-- ============== Port (with optional external port) ============== -->
          <template v-else-if="column.key === 'port'">
            {{ record.port }}<span v-if="record.externalPort > 0" style="color:#999;font-size:11px"> ({{ record.externalPort }})</span>
          </template>

          <!-- ============== Protocol tags ============== -->
          <template v-else-if="column.key === 'protocol'">
            <div class="protocol-tags">
              <a-tag color="purple">{{ record.protocol }}</a-tag>
              <template v-if="record.isVMess || record.isVLess || record.isTrojan || record.isSS || record.isHysteria">
                <a-tag color="green">{{ record.isHysteria ? 'UDP' : record.toInbound().stream.network }}</a-tag>
                <a-tag v-if="record.toInbound().stream.isTls" color="blue">TLS</a-tag>
                <a-tag v-if="record.toInbound().stream.isReality" color="blue">Reality</a-tag>
              </template>
            </div>
          </template>

          <!-- ============== Subscription count ============== -->
          <template v-else-if="column.key === 'subCount'">
            <a-tag v-if="props.subCountMap[record.id]" color="blue">{{ props.subCountMap[record.id] }}</a-tag>
            <span v-else style="color:#999">0</span>
          </template>

          <!-- ============== Clients tag + popovers ============== -->
          <template v-else-if="column.key === 'clients'">
            <template v-if="clientCount[record.id]">
              <a-tag color="green" class="client-count-tag" style="margin: 0; padding: 0 2px">{{ clientCount[record.id].clients }}</a-tag>
              <a-popover v-if="clientCount[record.id].deactive.length" :title="t('disabled')">
                <template #content>
                  <div class="client-email-list">
                    <div v-for="email in clientCount[record.id].deactive" :key="email">{{ email }}</div>
                  </div>
                </template>
                <a-tag class="client-count-tag" style="margin: 0; padding: 0 2px">{{ clientCount[record.id].deactive.length }}</a-tag>
              </a-popover>
              <a-popover v-if="clientCount[record.id].depleted.length" :title="t('depleted')">
                <template #content>
                  <div class="client-email-list">
                    <div v-for="email in clientCount[record.id].depleted" :key="email">{{ email }}</div>
                  </div>
                </template>
                <a-tag color="red" class="client-count-tag" style="margin: 0; padding: 0 2px">{{ clientCount[record.id].depleted.length
                }}</a-tag>
              </a-popover>
              <a-popover v-if="clientCount[record.id].expiring.length" :title="t('depletingSoon')">
                <template #content>
                  <div class="client-email-list">
                    <div v-for="email in clientCount[record.id].expiring" :key="email">{{ email }}</div>
                  </div>
                </template>
                <a-tag color="orange" class="client-count-tag" style="margin: 0; padding: 0 2px">{{ clientCount[record.id].expiring.length
                }}</a-tag>
              </a-popover>
              <a-popover v-if="clientCount[record.id].online.length" :title="t('online')">
                <template #content>
                  <div class="client-email-list">
                    <div v-for="email in clientCount[record.id].online" :key="email">{{ email }}</div>
                  </div>
                </template>
                <a-tag color="blue" class="client-count-tag" style="margin: 0; padding: 0 2px">{{ clientCount[record.id].online.length }}</a-tag>
              </a-popover>
            </template>
          </template>

          <!-- ============== Traffic ============== -->
          <template v-else-if="column.key === 'traffic'">
            <a-popover>
              <template #content>
                <table cellpadding="2">
                  <tbody>
                    <tr>
                      <td>↑ {{ SizeFormatter.sizeFormat(record.up) }}</td>
                      <td>↓ {{ SizeFormatter.sizeFormat(record.down) }}</td>
                    </tr>
                    <tr v-if="record.total > 0 && record.up + record.down < record.total">
                      <td>{{ t('remained') }}</td>
                      <td>{{ SizeFormatter.sizeFormat(record.total - record.up - record.down) }}</td>
                    </tr>
                  </tbody>
                </table>
              </template>
              <a-tag :color="ColorUtils.usageColor(record.up + record.down, trafficDiff, record.total)">
                {{ SizeFormatter.sizeFormat(record.up + record.down) }} /
                <template v-if="record.total > 0">{{ SizeFormatter.sizeFormat(record.total) }}</template>
                <InfinityIcon v-else />
              </a-tag>
            </a-popover>
          </template>

          <!-- ============== All-time inbound traffic ============== -->
          <template v-else-if="column.key === 'allTimeInbound'">
            <a-tag>{{ SizeFormatter.sizeFormat(record.allTime || 0) }}</a-tag>
          </template>

          <!-- ============== Expiry ============== -->
          <template v-else-if="column.key === 'expiryTime'">
            <a-popover v-if="record.expiryTime > 0">
              <template #content>{{ IntlUtil.formatDate(record.expiryTime, datepicker) }}</template>
              <a-tag :color="ColorUtils.usageColor(Date.now(), expireDiff, record._expiryTime)" style="min-width: 50px">
                {{ IntlUtil.formatRelativeTime(record.expiryTime) }}
              </a-tag>
            </a-popover>
            <a-tag v-else color="purple">
              <InfinityIcon />
            </a-tag>
          </template>
          </template> <!-- end !reorderMode || column.key !== 'action' -->
        </template>
      </a-table>
      </div>
    </a-space>
  </a-card>
</template>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-bar.mobile {
  display: block;
}

.filter-bar.mobile>* {
    margin-bottom: 4px;
}

.action-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.protocol-tags {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}

.client-count-tag {
  font-variant-numeric: tabular-nums;
}

.row-action-trigger {
  font-size: 20px;
  cursor: pointer;
}

.danger-item {
  color: #ff4d4f;
}

/* Hide the expand chevron on rows whose inbound has no client list
 * (HTTP/Mixed/Tunnel/WireGuard single-config). */
:deep(.hide-expand-icon .ant-table-row-expand-icon) {
  visibility: hidden;
}

:deep(.ant-table-row-expand-icon) {
  margin-inline-end: 2px;
  margin-inline-start: 0;
}

/* Tighten expand and selection cells so the checkbox and chevron sit
   closer together. AD-Vue cssinjs sets cell padding via the table
   component, and the small-size padding of 8px per side leaves a
   ~16px gap just from padding. */
:deep(td.ant-table-cell.ant-table-selection-column) {
  padding-right: 4px !important;
}
:deep(td.ant-table-cell.ant-table-row-expand-icon-cell) {
  padding-left: 4px !important;
  padding-right: 4px !important;
}
:deep(td.ant-table-cell.ant-table-row-expand-icon-cell + td.ant-table-cell) {
  padding-left: 4px !important;
}

/* Round the table's outer corners — AD-Vue gives .ant-table the radius
 * token, but the inner header strip and footer touch the edges, so clip
 * them here. */
:deep(.ant-table) {
  border-radius: 8px;
}

:deep(.ant-table-container) {
  border-radius: 8px;
}

:deep(.ant-table-thead > tr:first-child > *:first-child) {
  border-start-start-radius: 8px;
}

:deep(.ant-table-thead > tr:first-child > *:last-child) {
  border-start-end-radius: 8px;
}

:deep(.ant-table-tbody > tr:last-child > *:first-child) {
  border-end-start-radius: 8px;
}

:deep(.ant-table-tbody > tr:last-child > *:last-child) {
  border-end-end-radius: 8px;
}

/* ===== Mobile card list ===========================================
 * <768px renders inbounds as a vertical stack of cards via the
 * v-if="isMobile" branch above; the desktop <a-table> isn't mounted
 * so the legacy table-cell tightening rules went away. */
.inbound-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 4px;
}

.inbound-card {
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:global(body.dark) .inbound-card {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.1);
}

.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.card-id {
  font-size: 11px;
  opacity: 0.6;
}

.tag-name {
  font-weight: 600;
  flex: 1;
  min-width: 0;
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

.card-check {
  flex-shrink: 0;
}

.card-expand {
  font-size: 12px;
  opacity: 0.6;
  transition: transform 150ms ease;
  flex-shrink: 0;
}

.card-expand.is-expanded {
  transform: rotate(90deg);
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
  min-width: 96px;
  flex-shrink: 0;
}

.card-stats :deep(.ant-tag) {
  margin: 0;
}

.card-clients {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid rgba(128, 128, 128, 0.15);
}

.card-empty {
  text-align: center;
  opacity: 0.4;
  padding: 20px 0;
}

@media (max-width: 768px) {
  :deep(.ant-card-head) {
    padding: 0 12px;
    min-height: 44px;
  }

  :deep(.ant-card-head-title),
  :deep(.ant-card-extra) {
    padding: 8px 0;
  }

  :deep(.ant-card-body) {
    padding: 8px;
  }

  .filter-bar.mobile {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .filter-bar.mobile>* {
    margin-bottom: 0;
  }

  .row-action-trigger {
    font-size: 22px;
    padding: 4px;
  }
}

/* Reorder list dark mode */
:global(.is-dark) .reorder-row { background: #252526 !important; border-color: #333 !important; color: #e0e0e0; }
:global(.is-ultra) .reorder-row { background: #0c0e12 !important; border-color: #222 !important; color: #c0c0c0; }

/* Port-conflict disabled inbound switch — visually gray, still clickable */
.conflict-switch { opacity: 0.35; }

</style>
