import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Input,
  Modal,
  Popover,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  message,
  type TableColumnType,
  type MenuProps,
} from 'antd';
import {
  PlusOutlined,
  MenuOutlined,
  SearchOutlined,
  FilterOutlined,
  MoreOutlined,
  EditOutlined,
  QrcodeOutlined,
  CopyOutlined,
  ExportOutlined,
  ImportOutlined,
  ReloadOutlined,
  RetweetOutlined,
  BlockOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  SortAscendingOutlined,
  CheckOutlined,
  CloseOutlined,
  UserAddOutlined,
  UsergroupAddOutlined,
  FileDoneOutlined,
  RestOutlined,
  LinkOutlined,
} from '@ant-design/icons';

import { HttpUtil, ObjectUtil, SizeFormatter, IntlUtil, ColorUtils } from '@/utils';
import { DBInbound, coerceInboundJsonField } from '@/models/dbinbound.js';
import { Inbound } from '@/models/inbound.js';
import InfinityIcon from '@/components/InfinityIcon';
import { useDatepicker } from '@/hooks/useDatepicker';
import type { NodeRecord } from '@/hooks/useNodes';
import './InboundList.css';

type ProtocolFlags = {
  isVMess?: boolean;
  isVLess?: boolean;
  isTrojan?: boolean;
  isSS?: boolean;
  isHysteria?: boolean;
  isMixed?: boolean;
  isHTTP?: boolean;
  isWireguard?: boolean;
};

interface DBInboundRecord extends ProtocolFlags {
  id: number;
  enable: boolean;
  remark: string;
  port: number;
  protocol: string;
  up: number;
  down: number;
  total: number;
  expiryTime: number;
  _expiryTime: unknown;
  nodeId?: number | null;
  externalPort?: number | null;
  settings: string;
  clientStats: unknown;
  toInbound: () => {
    stream?: { network?: string; isTls?: boolean; isReality?: boolean; tls?: { settings?: { echConfigList?: string }; echServerKeys?: unknown }; reality?: { settings?: { mldsa65Verify?: boolean } } };
    isSSMultiUser?: boolean;
  };
  isMultiUser: () => boolean;
  hasLink: () => boolean;
  invalidateCache: () => void;
}

export interface ClientCountEntry {
  clients: number;
  active: string[];
  deactive: string[];
  depleted: string[];
  expiring: string[];
  online: string[];
}

export type RowAction =
  | 'edit'
  | 'showInfo'
  | 'qrcode'
  | 'export'
  | 'clipboard'
  | 'delete'
  | 'resetTraffic'
  | 'clone'
  | 'addClient'
  | 'addBulkClient'
  | 'copyClients'
  | 'resetClients'
  | 'delDepletedClients'
  | 'subs';

export type GeneralAction = 'import' | 'export' | 'exportSubs' | 'resetInbounds' | 'resetClients' | 'delDepletedClients' | 'batchEdit' | 'batchDelInbounds';

interface InboundListProps {
  dbInbounds: DBInboundRecord[];
  clientCount: Record<number, ClientCountEntry>;
  expireDiff: number;
  trafficDiff: number;
  pageSize: number;
  isMobile: boolean;
  isDarkTheme?: boolean;
  nodesById: Map<number, NodeRecord>;
  hasActiveNode: boolean;
  selectedIds?: number[];
  portConflictMap?: Record<number, number[]>;
  onAddInbound: () => void;
  onGeneralAction: (key: GeneralAction) => void;
  onRowAction: (action: { key: RowAction; dbInbound: DBInboundRecord }) => void;
  onRefresh?: () => void;
  onToggleEnable?: () => void;
  onUpdateSelectedIds?: (ids: number[]) => void;
}

type SortKey =
  | 'id'
  | 'enable'
  | 'remark'
  | 'port'
  | 'protocol'
  | 'traffic'
  | 'expiryTime'
  | 'node'
  | 'clients';

type SortOrder = 'ascend' | 'descend' | null;

function getInboundNetwork(r: DBInboundRecord): string {
  try {
    if (r.isHysteria) return 'udp';
    return r.toInbound().stream?.network || 'none';
  } catch { return 'none'; }
}

function getInboundSecurity(s: { isReality?: boolean; isTls?: boolean }) {
  if (s.isReality) return 0;
  if (s.isTls) return 1;
  return 2;
}

function getEchPq(s: { tls?: { settings?: { echConfigList?: string } } }) {
  const list = s.tls?.settings?.echConfigList || '';
  if (list.includes('ml-kem-768')) return 0;
  if (list.includes('x25519')) return 1;
  return 2;
}

const PROTO_ORDER = ['vless', 'hysteria2', 'hysteria', 'trojan', 'vmess', 'shadowsocks', 'http', 'tunnel', 'mixed', 'wireguard'];
const NET_ORDER = ['tcp', 'xhttp', 'grpc', 'httpupgrade', 'ws', 'kcp', 'http', 'udp', 'none'];

function multiLevelProtocolSort(a: DBInboundRecord, b: DBInboundRecord): number {
  // Level 1: protocol type
  const pa = PROTO_ORDER.indexOf(a.protocol);
  const pb = PROTO_ORDER.indexOf(b.protocol);
  if (pa !== pb) return pa - pb;

  let sa: any, sb: any;
  try {
    sa = a.toInbound().stream || {};
    sb = b.toInbound().stream || {};
  } catch {
    return 0;
  }

  // Level 2: network (transport)
  const na = NET_ORDER.indexOf(getInboundNetwork(a));
  const nb = NET_ORDER.indexOf(getInboundNetwork(b));
  if (na !== nb) return na - nb;

  // Level 3: security — reality > tls > none
  const sea = getInboundSecurity(sa);
  const seb = getInboundSecurity(sb);
  if (sea !== seb) return sea - seb;

  // Level 4: ECH PQ group — ml-kem-768 > x25519 > none
  const e4a = getEchPq(sa);
  const e4b = getEchPq(sb);
  if (e4a !== e4b) return e4a - e4b;

  // Level 5: MLDSA65 — has > doesn't have
  const mlA = !!(sa.reality?.settings?.mldsa65Verify);
  const mlB = !!(sb.reality?.settings?.mldsa65Verify);
  if (mlA !== mlB) return mlA ? -1 : 1;

  // Level 6: ECH server keys — has > doesn't have
  const echA = !!(sa.tls?.echServerKeys);
  const echB = !!(sb.tls?.echServerKeys);
  return echA === echB ? 0 : echA ? -1 : 1;
}

const SORT_FNS: Record<SortKey, (a: DBInboundRecord, b: DBInboundRecord, ctx: { nodesById: Map<number, NodeRecord>; clientCount: Record<number, ClientCountEntry> }) => number> = {
  id: (a, b) => a.id - b.id,
  enable: (a, b) => Number(a.enable) - Number(b.enable),
  remark: (a, b) => (a.remark || '').localeCompare(b.remark || ''),
  port: (a, b) => a.port - b.port,
  protocol: (a, b) => multiLevelProtocolSort(a, b),
  traffic: (a, b) => (a.up + a.down) - (b.up + b.down),
  expiryTime: (a, b) => (a.expiryTime || Infinity) - (b.expiryTime || Infinity),
  node: (a, b, ctx) => {
    const nameA = ctx.nodesById.get(a.nodeId ?? -1)?.name ?? (a.nodeId == null ? '￿' : `node #${a.nodeId}`);
    const nameB = ctx.nodesById.get(b.nodeId ?? -1)?.name ?? (b.nodeId == null ? '￿' : `node #${b.nodeId}`);
    return nameA.localeCompare(nameB);
  },
  clients: (a, b, ctx) => (ctx.clientCount[a.id]?.clients || 0) - (ctx.clientCount[b.id]?.clients || 0),
};

function showQrCodeMenu(dbInbound: DBInboundRecord): boolean {
  if (dbInbound.isWireguard) return true;
  if (dbInbound.isSS) {
    try {
      return !dbInbound.toInbound().isSSMultiUser;
    } catch { return false; }
  }
  return false;
}

function projectInbound(dbInbound: DBInboundRecord, predicate: (client: any) => boolean): DBInboundRecord {
  const next = new DBInbound(dbInbound);
  const settings = coerceInboundJsonField(dbInbound.settings);
  if (!Array.isArray(settings.clients)) return next;
  const filtered = settings.clients.filter(predicate);
  (next as any).settings = (Inbound as any).Settings.fromJson(dbInbound.protocol, { clients: filtered });
  next.invalidateCache();
  return next;
}

function buildRowActionsMenu({ record, isMobile, t }: { record: DBInboundRecord; isMobile?: boolean; t: (k: string) => string }): MenuProps['items'] {
  const items: MenuProps['items'] = [];
  if (isMobile) {
    items.push({ key: 'edit', icon: <EditOutlined />, label: t('edit') });
  }
  if (showQrCodeMenu(record)) {
    items.push({ key: 'qrcode', icon: <QrcodeOutlined />, label: t('qrCode') });
  }
  if (record.isMultiUser()) {
    items.push({ key: 'addClient', icon: <UserAddOutlined />, label: t('pages.clients.add') });
    items.push({ key: 'addBulkClient', icon: <UsergroupAddOutlined />, label: t('pages.clients.bulk') });
    items.push({ key: 'copyClients', icon: <CopyOutlined />, label: t('pages.clients.copyFromInbound') });
    items.push({ key: 'resetClients', icon: <FileDoneOutlined />, label: t('pages.inbounds.resetInboundClientTraffics') });
    items.push({ key: 'export', icon: <ExportOutlined />, label: t('pages.inbounds.export') });
    items.push({ key: 'subs', icon: <LinkOutlined />, label: t('pages.inbounds.exportSubsTitle') });
    items.push({ key: 'delDepletedClients', icon: <RestOutlined />, danger: true, label: t('pages.inbounds.delDepletedClients') });
  } else {
    items.push({ key: 'showInfo', icon: <InfoCircleOutlined />, label: t('info') });
  }
  items.push({ key: 'clipboard', icon: <CopyOutlined />, label: t('pages.inbounds.exportInbound') });
  items.push({ key: 'resetTraffic', icon: <RetweetOutlined />, label: t('pages.inbounds.resetTraffic') });
  items.push({ key: 'clone', icon: <BlockOutlined />, label: t('pages.inbounds.clone') });
  items.push({ key: 'delete', icon: <DeleteOutlined />, danger: true, label: t('delete') });
  return items;
}

export default function InboundList({
  dbInbounds,
  clientCount,
  expireDiff,
  trafficDiff,
  pageSize,
  isMobile,
  isDarkTheme,
  nodesById,
  hasActiveNode,
  selectedIds,
  portConflictMap,
  onAddInbound,
  onGeneralAction,
  onRowAction,
  onRefresh,
  onToggleEnable,
  onUpdateSelectedIds,
}: InboundListProps) {
  const { t } = useTranslation();
  const { datepicker } = useDatepicker();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const [statsRecord, setStatsRecord] = useState<DBInboundRecord | null>(null);
  const [statsIndex, setStatsIndex] = useState(0);

  const hasAnyRemark = useMemo(
    () => dbInbounds.some((i) => typeof i.remark === 'string' && i.remark.trim() !== ''),
    [dbInbounds],
  );

  const scrollX = useMemo(() => {
    let w = 32 + 30 + 30 + 60 + 55;
    if (hasAnyRemark) w += 80;
    if (hasActiveNode) w += 70;
    w += 55 + 150 + 45 + 60 + 75 + 60;
    return w;
  }, [hasAnyRemark, hasActiveNode]);

  // === Search / filter state ===
  const FILTER_STATE_KEY = 'inboundsFilterState';
  const savedFilterState = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(FILTER_STATE_KEY) || '{}'); } catch { return {}; }
  }, []);
  const [enableFilter, setEnableFilter] = useState(!!savedFilterState.enableFilter);
  const [searchKey, setSearchKey] = useState(savedFilterState.searchKey || '');
  const [filterBy, setFilterBy] = useState(savedFilterState.filterBy || '');
  const [protocolFilter, setProtocolFilter] = useState(savedFilterState.protocolFilter || undefined);
  const [nodeFilter, setNodeFilter] = useState(savedFilterState.nodeFilter || '');

  const filterStateObj = useMemo(() => ({
    enableFilter, searchKey, filterBy, protocolFilter, nodeFilter,
  }), [enableFilter, searchKey, filterBy, protocolFilter, nodeFilter]);

  useEffect(() => {
    localStorage.setItem(FILTER_STATE_KEY, JSON.stringify(filterStateObj));
  }, [filterStateObj]);

  // Reset sort when search/filter changes
  useEffect(() => {
    setSortKey(null);
    setSortOrder(null);
  }, [searchKey, filterBy]);

  function onToggleFilter() {
    if (enableFilter) setSearchKey('');
    else setFilterBy('');
  }

  const protocolOptions = useMemo(() => {
    const values = new Set(dbInbounds.map((i) => i.protocol).filter(Boolean));
    return [...values].sort();
  }, [dbInbounds]);

  const nodeOptions = useMemo(() => {
    const values = new Map<string, string>();
    if (dbInbounds.some((i) => i.nodeId == null)) {
      values.set('local', t('pages.inbounds.localPanel'));
    }
    for (const dbInbound of dbInbounds) {
      if (dbInbound.nodeId == null) continue;
      const node = nodesById.get(dbInbound.nodeId);
      values.set(String(dbInbound.nodeId), node?.name || `#${dbInbound.nodeId}`);
    }
    return [...values.entries()].map(([value, label]) => ({ value, label }));
  }, [dbInbounds, nodesById, t]);

  function applySecondaryFilters(rows: DBInboundRecord[]) {
    return rows.filter((dbInbound) => {
      if (protocolFilter && dbInbound.protocol !== protocolFilter) return false;
      if (nodeFilter) {
        const nodeValue = dbInbound.nodeId == null ? 'local' : String(dbInbound.nodeId);
        if (nodeValue !== nodeFilter) return false;
      }
      return true;
    });
  }

  const visibleInbounds = useMemo(() => {
    if (enableFilter) {
      if (ObjectUtil.isEmpty(filterBy)) return applySecondaryFilters([...dbInbounds]);
      const out: DBInboundRecord[] = [];
      for (const dbInbound of dbInbounds) {
        const c = clientCount[dbInbound.id];
        if (!c || !(c as any)[filterBy] || (c as any)[filterBy].length === 0) continue;
        const list = (c as any)[filterBy];
        out.push(projectInbound(dbInbound, (client) => list.includes(client.email)));
      }
      return applySecondaryFilters(out);
    }
    if (ObjectUtil.isEmpty(searchKey)) return applySecondaryFilters([...dbInbounds]);
    const out: DBInboundRecord[] = [];
    for (const dbInbound of dbInbounds) {
      if (!ObjectUtil.deepSearch(dbInbound, searchKey)) continue;
      out.push(projectInbound(dbInbound, (client) => ObjectUtil.deepSearch(client, searchKey)));
    }
    return applySecondaryFilters(out);
  }, [enableFilter, filterBy, searchKey, protocolFilter, nodeFilter, dbInbounds, clientCount]);

  const sortedInbounds = useMemo(() => {
    if (!sortKey || !sortOrder) return visibleInbounds;
    const fn = SORT_FNS[sortKey];
    if (!fn) return visibleInbounds;
    const ctx = { nodesById, clientCount };
    const sorted = [...visibleInbounds].sort((a, b) => fn(a, b, ctx));
    return sortOrder === 'descend' ? sorted.reverse() : sorted;
  }, [visibleInbounds, sortKey, sortOrder, nodesById, clientCount]);

  const onSwitchEnable = useCallback(async (dbInbound: DBInboundRecord, next: boolean) => {
    // Client-side guard: disabled inbounds with port conflicts cannot be enabled
    if (next && !dbInbound.enable) {
      const conflictIds = portConflictMap?.[dbInbound.id];
      if (conflictIds && conflictIds.length > 0) {
        const conflictInbounds = dbInbounds.filter((ib: any) => conflictIds.includes(ib.id));
        const names = conflictInbounds.map((ib: any) => ib.remark || `#${ib.id}`).join(', ');
        const { message } = await import('antd');
        message.warning(t('subPortConflict', { port: dbInbound.port, names }));
        return;
      }
    }
    const previous = dbInbound.enable;
    dbInbound.enable = next;
    onToggleEnable?.();
    try {
      const formData = new FormData();
      formData.append('enable', String(next));
      const msg = await HttpUtil.post(`/panel/api/inbounds/setEnable/${dbInbound.id}`, formData);
      if (!msg?.success) {
        dbInbound.enable = previous;
        onToggleEnable?.();
        if (msg?.msg) {
          const conflictMatch = (msg.msg as string).match(/confict with enabled inbounds: (.+)/);
          if (conflictMatch) {
            const { message } = await import('antd');
            message.warning(t('subPortConflict', { port: dbInbound.port, names: conflictMatch[1] }));
          }
        }
      }
    } catch {
      dbInbound.enable = previous;
      onToggleEnable?.();
    }
  }, [onToggleEnable, t, portConflictMap, dbInbounds]);

  // === Reorder mode ===
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderData, setReorderData] = useState<DBInboundRecord[]>([]);
  const snapshotBeforeReorder = useRef<number[]>([]);
  const [draggedRowId, setDraggedRowId] = useState<number | null>(null);
  const dragItemId = useRef<number | null>(null);
  const dragStyle = useRef<HTMLStyleElement | null>(null);
  const dragPointerId = useRef(-1);
  const pointerDrag = useRef({ started: false, startY: 0, _record: null as DBInboundRecord | null });

  function enterReorder() {
    let items = [...dbInbounds];
    if (sortKey && sortOrder && SORT_FNS[sortKey]) {
      const ctx = { nodesById, clientCount };
      items.sort((a, b) => SORT_FNS[sortKey!](a, b, ctx));
      if (sortOrder === 'descend') items.reverse();
    }
    snapshotBeforeReorder.current = items.map((r) => r.id);
    setReorderData(items);
    setReorderMode(true);
  }

  function cancelReorder() {
    if (snapshotBeforeReorder.current.length) {
      const byId = new Map(dbInbounds.map((r) => [r.id, r]));
      const restored = snapshotBeforeReorder.current.map((id) => byId.get(id)).filter(Boolean) as DBInboundRecord[];
      setReorderData(restored);
    }
    snapshotBeforeReorder.current = [];
    setReorderMode(false);
    setReorderData([]);
    removeDragStyle();
  }

  async function confirmReorder() {
    const ids = reorderData.map((r) => r.id);
    try {
      const res = await HttpUtil.post('/panel/api/inbounds/reorder', { ids }, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res?.success) throw new Error(res?.msg || 'reorder failed');
      message.success(t('pages.inbounds.reorderSuccess'));
    } catch { return; }
    setReorderMode(false);
    setReorderData([]);
    snapshotBeforeReorder.current = [];
    removeDragStyle();
    onRefresh?.();
  }

  function injectDragStyle() {
    if (dragStyle.current) return;
    dragStyle.current = document.createElement('style');
    dragStyle.current.textContent = '.reorder-active .ant-table-tbody .ant-table-row td{background:transparent!important}.reorder-active .ant-table-tbody .ant-table-row:hover td{background:transparent!important}';
    document.head.appendChild(dragStyle.current);
  }

  function removeDragStyle() {
    if (dragStyle.current) { dragStyle.current.remove(); dragStyle.current = null; }
  }

  function rowReorderById(fromId: number, toId: number) {
    if (!fromId || !toId || fromId === toId) return;
    setReorderData((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((r) => r.id === fromId);
      const toIdx = arr.findIndex((r) => r.id === toId);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
  }

  // Pointer Events drag init
  useEffect(() => {
    if (!reorderMode) return;
    const timer = setTimeout(() => {
      const table = document.querySelector('.ant-table');
      if (!table || (table as any)._ptrInit) return;
      (table as any)._ptrInit = true;
      table.addEventListener('pointerdown', (e) => {
        if (!reorderMode) return;
        const row = (e.target as HTMLElement).closest('.ant-table-row');
        if (!row) return;
        const rowId = Number(row.getAttribute('data-row-key'));
        if (!rowId) return;
        const rec = reorderData.find((r) => r.id === rowId);
        if (!rec) return;
        e.preventDefault();
        dragPointerId.current = e.pointerId;
        pointerDrag.current = { started: false, startY: e.clientY, _record: rec };
        document.addEventListener('pointermove', onRowPointerMove);
        document.addEventListener('pointerup', onRowPointerUp);
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [reorderMode, reorderData]);

  function onRowPointerMove(e: PointerEvent) {
    if (e.pointerId !== dragPointerId.current) return;
    e.preventDefault();
    if (!pointerDrag.current.started) {
      if (Math.abs(e.clientY - pointerDrag.current.startY) < 5) return;
      pointerDrag.current.started = true;
      const rec = pointerDrag.current._record;
      if (rec) { dragItemId.current = rec.id; setDraggedRowId(rec.id); injectDragStyle(); }
    }
    if (!dragItemId.current) return;
    const rows = document.querySelectorAll('.ant-table-row');
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY < rect.bottom) {
        const rowId = Number(row.getAttribute('data-row-key'));
        if (rowId && rowId !== dragItemId.current) {
          rowReorderById(dragItemId.current, rowId);
          setDraggedRowId(dragItemId.current);
        }
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
    dragItemId.current = null;
    setDraggedRowId(null);
    setReorderData((prev) => [...prev]);
    (document.activeElement as HTMLElement)?.blur();
    window.getSelection()?.removeAllRanges();
    document.querySelectorAll('.ant-table-row').forEach((r) => r.dispatchEvent(new MouseEvent('mouseleave')));
    removeDragStyle();
    dragPointerId.current = -1;
    pointerDrag.current = { started: false, startY: 0, _record: null };
  }

  function moveRow(idx: number, dir: number) {
    setReorderData((prev) => {
      const to = idx + dir;
      if (to < 0 || to >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[to]] = [arr[to], arr[idx]];
      return arr;
    });
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      removeDragStyle();
      document.removeEventListener('pointermove', onRowPointerMove);
      document.removeEventListener('pointerup', onRowPointerUp);
    };
  }, []);

  const sorterFor = useCallback((key: SortKey) => ({
    sorter: true as const,
    showSorterTooltip: false,
    sortOrder: sortKey === key ? sortOrder : null,
    sortDirections: ['ascend' as const, 'descend' as const],
  }), [sortKey, sortOrder]);

  const columns: TableColumnType<DBInboundRecord>[] = useMemo(() => {
    const cols: TableColumnType<DBInboundRecord>[] = [
      {
        title: '#',
        key: 'rowNo',
        align: 'center',
        width: 30,
        render: (_: unknown, _record: DBInboundRecord, index: number) => index + 1,
      },
      {
        title: t('pages.inbounds.operate'),
        key: 'action',
        align: 'center',
        width: 60,
        render: (_: unknown, record: DBInboundRecord) => (
          reorderMode ? (
            <Space>
              <Button size="small" disabled={reorderData.findIndex((r) => r.id === record.id) === 0} onClick={() => moveRow(reorderData.findIndex((r) => r.id === record.id), -1)}>{'↑'}</Button>
              <Button size="small" disabled={reorderData.findIndex((r) => r.id === record.id) === reorderData.length - 1} onClick={() => moveRow(reorderData.findIndex((r) => r.id === record.id), 1)}>{'↓'}</Button>
            </Space>
          ) : (
            <div className="action-buttons">
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onRowAction({ key: 'edit', dbInbound: record })} />
              <Dropdown
                trigger={['click']}
                menu={{
                  items: buildRowActionsMenu({ record, t }),
                  onClick: ({ key }) => onRowAction({ key: key as RowAction, dbInbound: record }),
                }}
              >
                <Button type="text" size="small" icon={<MoreOutlined />} />
              </Dropdown>
            </div>
          )
        ),
      },
      {
        title: t('pages.inbounds.enable'),
        key: 'enable',
        align: 'center',
        width: 55,
        ...sorterFor('enable'),
        render: (_: unknown, record: DBInboundRecord) => (
          <Switch
            checked={record.enable}
            onChange={(next) => onSwitchEnable(record, next)}
            className={!record.enable && (portConflictMap?.[record.id]?.length || 0) > 0 ? 'conflict-switch' : ''}
          />
        ),
      },
    ];

    if (hasAnyRemark) {
      cols.push({
        title: t('pages.inbounds.remark'),
        dataIndex: 'remark',
        key: 'remark',
        align: 'center',
        width: 80,
        ...sorterFor('remark'),
      });
    }

    if (hasActiveNode) {
      cols.push({
        title: t('pages.inbounds.node'),
        key: 'node',
        align: 'center',
        width: 70,
        ...sorterFor('node'),
        render: (_: unknown, record: DBInboundRecord) => {
          if (record.nodeId == null) {
            return <Tag color="default">{t('pages.inbounds.localPanel')}</Tag>;
          }
          const node = nodesById.get(record.nodeId);
          if (!node) {
            return <Tag color="orange">node #{record.nodeId}</Tag>;
          }
          return (
            <Tag color={node.status === 'online' ? 'blue' : 'red'}>{node.name}</Tag>
          );
        },
      });
    }

    cols.push(
      {
        title: t('pages.inbounds.port'),
        key: 'port',
        align: 'center',
        width: 55,
        ...sorterFor('port'),
        render: (_: unknown, record: DBInboundRecord) => (
          <>{record.port}{record.externalPort != null && record.externalPort > 0 && <span style={{ color: '#999', fontSize: 11 }}> ({record.externalPort})</span>}</>
        ),
      },
      {
        title: t('pages.inbounds.protocol'),
        key: 'protocol',
        align: 'center',
        width: 150,
        ...sorterFor('protocol'),
        render: (_: unknown, record: DBInboundRecord) => {
          const tags: ReactElement[] = [<Tag key="p" color="purple">{record.protocol}</Tag>];
          if (record.isVMess || record.isVLess || record.isTrojan || record.isSS || record.isHysteria) {
            const stream = record.toInbound().stream;
            tags.push(
              <Tag key="n" color="green">
                {record.isHysteria ? 'UDP' : stream?.network}
              </Tag>,
            );
            if (stream?.isTls) tags.push(<Tag key="tls" color="blue">TLS</Tag>);
            if (stream?.isReality) tags.push(<Tag key="reality" color="blue">Reality</Tag>);
          }
          return <div className="protocol-tags">{tags}</div>;
        },
      },
      {
        title: t('clients'),
        key: 'clients',
        align: 'center',
        width: 60,
        ...sorterFor('clients'),
        render: (_: unknown, record: DBInboundRecord) => {
          const cc = clientCount[record.id];
          if (!cc) return null;
          return (
            <>
              <Tag color="green" className="client-count-tag" style={{ margin: 0, padding: '0 2px' }}>
                {cc.clients}
              </Tag>
              {cc.deactive.length > 0 && (
                <Popover title={t('disabled')} content={(
                  <div className="client-email-list">{cc.deactive.map((e) => <div key={e}>{e}</div>)}</div>
                )}>
                  <Tag className="client-count-tag" style={{ margin: 0, padding: '0 2px' }}>{cc.deactive.length}</Tag>
                </Popover>
              )}
              {cc.depleted.length > 0 && (
                <Popover title={t('depleted')} content={(
                  <div className="client-email-list">{cc.depleted.map((e) => <div key={e}>{e}</div>)}</div>
                )}>
                  <Tag color="red" className="client-count-tag" style={{ margin: 0, padding: '0 2px' }}>{cc.depleted.length}</Tag>
                </Popover>
              )}
              {cc.expiring.length > 0 && (
                <Popover title={t('depletingSoon')} content={(
                  <div className="client-email-list">{cc.expiring.map((e) => <div key={e}>{e}</div>)}</div>
                )}>
                  <Tag color="orange" className="client-count-tag" style={{ margin: 0, padding: '0 2px' }}>{cc.expiring.length}</Tag>
                </Popover>
              )}
              {cc.online.length > 0 && (
                <Popover title={t('online')} content={(
                  <div className="client-email-list">{cc.online.map((e) => <div key={e}>{e}</div>)}</div>
                )}>
                  <Tag color="blue" className="client-count-tag" style={{ margin: 0, padding: '0 2px' }}>{cc.online.length}</Tag>
                </Popover>
              )}
            </>
          );
        },
      },
      {
        title: t('pages.inbounds.traffic'),
        key: 'traffic',
        align: 'center',
        width: 75,
        ...sorterFor('traffic'),
        render: (_: unknown, record: DBInboundRecord) => (
          <Popover content={(
            <table cellPadding={2}>
              <tbody>
                <tr>
                  <td>{'↑'} {SizeFormatter.sizeFormat(record.up)}</td>
                  <td>{'↓'} {SizeFormatter.sizeFormat(record.down)}</td>
                </tr>
                {record.total > 0 && record.up + record.down < record.total && (
                  <tr>
                    <td>{t('remained')}</td>
                    <td>{SizeFormatter.sizeFormat(record.total - record.up - record.down)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}>
            <Tag color={ColorUtils.usageColor(record.up + record.down, trafficDiff, record.total)}>
              {SizeFormatter.sizeFormat(record.up + record.down)} /
              {' '}
              {record.total > 0 ? SizeFormatter.sizeFormat(record.total) : <InfinityIcon />}
            </Tag>
          </Popover>
        ),
      },
      {
        title: t('pages.inbounds.expireDate'),
        key: 'expiryTime',
        align: 'center',
        width: 60,
        ...sorterFor('expiryTime'),
        render: (_: unknown, record: DBInboundRecord) => {
          if (record.expiryTime > 0) {
            return (
              <Popover content={IntlUtil.formatDate(record.expiryTime, datepicker)}>
                <Tag color={ColorUtils.usageColor(Date.now(), expireDiff, record._expiryTime)} style={{ minWidth: 50 }}>
                  {IntlUtil.formatRelativeTime(record.expiryTime)}
                </Tag>
              </Popover>
            );
          }
          return <Tag color="purple"><InfinityIcon /></Tag>;
        },
      },
    );

    return cols;
  }, [t, hasAnyRemark, hasActiveNode, nodesById, clientCount, expireDiff, trafficDiff, datepicker, onRowAction, onSwitchEnable, sorterFor, reorderMode, reorderData, portConflictMap]);

  const paginationFor = (rows: DBInboundRecord[]) => {
    const size = pageSize > 0 ? pageSize : rows.length || 1;
    return { pageSize: size, showSizeChanger: false, hideOnSinglePage: true };
  };

  const generalActionsMenu: MenuProps = {
    items: [
      ...((selectedIds || []).length >= 2 ? [{ key: 'batchEdit', icon: <EditOutlined />, label: t('pages.inbounds.batchEditInbounds') }] : []),
      { key: 'import', icon: <ImportOutlined />, label: t('pages.inbounds.importInbound') },
      { key: 'export', icon: <ExportOutlined />, label: t('pages.inbounds.export') },
      { key: 'exportSubs', icon: <LinkOutlined />, label: t('pages.inbounds.exportAllSubsTitle') },
      { key: 'resetInbounds', icon: <ReloadOutlined />, label: t('pages.inbounds.resetAllTraffic') },
      { key: 'resetClients', icon: <FileDoneOutlined />, label: t('pages.inbounds.resetAllClientTraffics') },
      { key: 'delDepletedClients', icon: <RestOutlined />, danger: true, label: t('pages.inbounds.delDepletedClients') },
      ...((selectedIds || []).length >= 2 ? [{ key: 'batchDelInbounds', icon: <DeleteOutlined />, danger: true, label: t('pages.inbounds.batchDeleteInbounds') }] : []),
    ],
    onClick: ({ key }) => onGeneralAction(key as GeneralAction),
  };

  return (
    <Card
      hoverable
      title={(
        <Space>
          <Button type="primary" onClick={onAddInbound} icon={<PlusOutlined />}>
            {!isMobile && t('pages.inbounds.addInbound')}
          </Button>
          <Dropdown trigger={['click']} menu={generalActionsMenu}>
            <Button type="primary" icon={<MenuOutlined />}>
              {!isMobile && t('pages.inbounds.generalActions')}
            </Button>
          </Dropdown>
        </Space>
      )}
    >
      <Space orientation="vertical" style={{ width: '100%' }}>
        {/* Filter bar */}
        <div className={isMobile ? 'filter-bar mobile' : 'filter-bar'}>
          {!reorderMode ? (
            <>
              <Switch
                checkedChildren={<SearchOutlined />}
                unCheckedChildren={<FilterOutlined />}
                checked={enableFilter}
                onChange={(v) => { setEnableFilter(v); onToggleFilter(); }}
              />
              {!enableFilter ? (
                <Input
                  value={searchKey}
                  onChange={(e) => setSearchKey(e.target.value)}
                  placeholder={t('search')}
                  size={isMobile ? 'small' : 'middle'}
                  style={{ maxWidth: 300 }}
                />
              ) : (
                <Radio.Group
                  value={filterBy}
                  optionType="button"
                  buttonStyle="solid"
                  size={isMobile ? 'small' : 'middle'}
                  onChange={(e) => setFilterBy(e.target.value)}
                >
                  <Radio.Button value="">{t('none')}</Radio.Button>
                  <Radio.Button value="active">{t('subscription.active')}</Radio.Button>
                  <Radio.Button value="deactive">{t('disabled')}</Radio.Button>
                  <Radio.Button value="depleted">{t('depleted')}</Radio.Button>
                  <Radio.Button value="expiring">{t('depletingSoon')}</Radio.Button>
                  <Radio.Button value="online">{t('online')}</Radio.Button>
                </Radio.Group>
              )}
              <Select
                value={protocolFilter}
                allowClear
                placeholder={t('pages.inbounds.protocol')}
                size={isMobile ? 'small' : 'middle'}
                style={{ width: 150 }}
                onChange={(v) => setProtocolFilter(v)}
                options={protocolOptions.map((p) => ({ value: p, label: p }))}
              />
              {hasActiveNode && nodeOptions.length > 0 && (
                <Select
                  value={nodeFilter}
                  allowClear
                  placeholder={t('pages.inbounds.node')}
                  size={isMobile ? 'small' : 'middle'}
                  style={{ width: 170 }}
                  onChange={(v) => setNodeFilter(v || '')}
                  options={nodeOptions}
                />
              )}
              <Button size={isMobile ? 'small' : 'middle'} onClick={enterReorder}>
                <SortAscendingOutlined /> {t('pages.inbounds.sort')}
              </Button>
            </>
          ) : (
            <>
              <Button type="primary" size={isMobile ? 'small' : 'middle'} onClick={confirmReorder}>
                <CheckOutlined /> {t('pages.inbounds.confirmSort')}
              </Button>
              <Button size={isMobile ? 'small' : 'middle'} onClick={cancelReorder}>
                <CloseOutlined /> {t('pages.inbounds.cancelSort')}
              </Button>
            </>
          )}
        </div>

        {isMobile ? (
          <div className="inbound-cards">
            {(reorderMode ? reorderData : sortedInbounds).length === 0 ? (
              <div className="card-empty">—</div>
            ) : (
              (reorderMode ? reorderData : sortedInbounds).map((record, idx) => (
                <div key={record.id} className="inbound-card">
                  <div className="card-head">
                    <Checkbox
                      className="card-check"
                      checked={(selectedIds || []).includes(record.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const s = new Set(selectedIds || []);
                        if (e.target.checked) s.add(record.id); else s.delete(record.id);
                        onUpdateSelectedIds?.(Array.from(s));
                      }}
                    />
                    <span className="card-id">#{idx + 1}</span>
                    <span className="tag-name">{record.remark}</span>
                    <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                      {reorderMode ? (
                        <>
                          <Button size="small" disabled={idx === 0} onClick={() => moveRow(idx, -1)}>{'↑'}</Button>
                          <Button size="small" disabled={idx === reorderData.length - 1} onClick={() => moveRow(idx, 1)}>{'↓'}</Button>
                        </>
                      ) : (
                        <>
                          <Tooltip title={t('info')}>
                            <InfoCircleOutlined
                              className="row-action-trigger"
                              onClick={() => { setStatsRecord(record); setStatsIndex(idx); }}
                            />
                          </Tooltip>
                          <Switch
                            checked={record.enable}
                            size="small"
                            className={(!record.enable && (portConflictMap?.[record.id]?.length || 0) > 0) ? 'conflict-switch' : ''}
                            onChange={(next) => onSwitchEnable(record, next)}
                          />
                          <Dropdown
                            trigger={['click']}
                            placement="bottomRight"
                            menu={{
                              items: buildRowActionsMenu({ record, isMobile: true, t }),
                              onClick: ({ key }) => onRowAction({ key: key as RowAction, dbInbound: record }),
                            }}
                          >
                            <MoreOutlined className="row-action-trigger" onClick={(e) => e.preventDefault()} />
                          </Dropdown>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className={reorderMode ? 'reorder-active' : ''} style={{ position: 'relative', marginTop: 10 }}>
            <Table
              columns={columns}
              dataSource={reorderMode ? reorderData : sortedInbounds}
              rowKey={(r) => r.id}
              locale={{ emptyText: <Empty description={t('noData')} /> }}
              pagination={reorderMode ? false : paginationFor(sortedInbounds)}
              scroll={{ x: scrollX }}
              size="small"
              onRow={reorderMode ? (record) => ({
                'data-row-key': record.id,
                style: {
                  cursor: 'grab',
                  background: draggedRowId === record.id ? (isDarkTheme ? 'rgba(24,144,255,0.45)' : '#d6e9ff') : undefined,
                  outline: draggedRowId === record.id ? '2px dashed #1890ff' : undefined,
                  outlineOffset: draggedRowId === record.id ? '-2px' : undefined,
                },
              }) : undefined}
              rowSelection={reorderMode ? undefined : {
                selectedRowKeys: selectedIds || [],
                onChange: (keys) => onUpdateSelectedIds?.(keys as number[]),
                columnWidth: 32,
              }}
              onChange={(_p, _f, sorter) => {
                if (reorderMode) return;
                const single = Array.isArray(sorter) ? sorter[0] : sorter;
                const colKey = (single?.columnKey || single?.field) as SortKey | undefined;
                setSortKey(colKey || null);
                setSortOrder((single?.order as SortOrder) || null);
              }}
            />
          </div>
        )}
      </Space>

      <Modal
        open={isMobile && !!statsRecord}
        footer={null}
        width={360}
        centered
        title={statsRecord ? `#${statsIndex + 1} ${statsRecord.remark || ''}`.trim() : ''}
        onCancel={() => setStatsRecord(null)}
        destroyOnHidden
      >
        {statsRecord && (
          <div className="card-stats">
            <div className="stat-row">
              <span className="stat-label">{t('pages.inbounds.protocol')}</span>
              <Tag color="purple">{statsRecord.protocol}</Tag>
              {(statsRecord.isVMess || statsRecord.isVLess || statsRecord.isTrojan || statsRecord.isSS || statsRecord.isHysteria) && (
                <>
                  <Tag color="green">
                    {statsRecord.isHysteria ? 'UDP' : statsRecord.toInbound().stream?.network}
                  </Tag>
                  {statsRecord.toInbound().stream?.isTls && <Tag color="blue">TLS</Tag>}
                  {statsRecord.toInbound().stream?.isReality && <Tag color="blue">Reality</Tag>}
                </>
              )}
            </div>
            <div className="stat-row">
              <span className="stat-label">{t('pages.inbounds.port')}</span>
              <Tag>{statsRecord.port}</Tag>
            </div>
            {hasActiveNode && (
              <div className="stat-row">
                <span className="stat-label">{t('pages.inbounds.node')}</span>
                {statsRecord.nodeId == null ? (
                  <Tag color="default">{t('pages.inbounds.localPanel')}</Tag>
                ) : nodesById.get(statsRecord.nodeId) ? (
                  <Tag color={nodesById.get(statsRecord.nodeId)!.status === 'online' ? 'blue' : 'red'}>
                    {nodesById.get(statsRecord.nodeId)!.name}
                  </Tag>
                ) : (
                  <Tag color="orange">#{statsRecord.nodeId}</Tag>
                )}
              </div>
            )}
            <div className="stat-row">
              <span className="stat-label">{t('pages.inbounds.traffic')}</span>
              <Tag color={ColorUtils.usageColor(statsRecord.up + statsRecord.down, trafficDiff, statsRecord.total)}>
                {SizeFormatter.sizeFormat(statsRecord.up + statsRecord.down)} /
                {' '}
                {statsRecord.total > 0 ? SizeFormatter.sizeFormat(statsRecord.total) : <InfinityIcon />}
              </Tag>
            </div>
            {clientCount[statsRecord.id] && (
              <div className="stat-row">
                <span className="stat-label">{t('clients')}</span>
                <Tag color="green" className="client-count-tag">{clientCount[statsRecord.id].clients}</Tag>
                {clientCount[statsRecord.id].online.length > 0 && (
                  <Tag color="blue">{clientCount[statsRecord.id].online.length} {t('online')}</Tag>
                )}
                {clientCount[statsRecord.id].depleted.length > 0 && (
                  <Tag color="red">{clientCount[statsRecord.id].depleted.length} {t('depleted')}</Tag>
                )}
                {clientCount[statsRecord.id].expiring.length > 0 && (
                  <Tag color="orange">{clientCount[statsRecord.id].expiring.length} {t('depletingSoon')}</Tag>
                )}
              </div>
            )}
            <div className="stat-row">
              <span className="stat-label">{t('pages.inbounds.expireDate')}</span>
              {statsRecord.expiryTime > 0 ? (
                <Tag color={ColorUtils.usageColor(Date.now(), expireDiff, statsRecord._expiryTime)}>
                  {IntlUtil.formatRelativeTime(statsRecord.expiryTime)}
                </Tag>
              ) : (
                <Tag color="purple"><InfinityIcon /></Tag>
              )}
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );

}
