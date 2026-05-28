import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Button,
  Checkbox,
  Dropdown,
  Modal,
  Pagination,
  Popover,
  Progress,
  Space,
  Switch,
  Tag,
  Tooltip,
  type MenuProps,
} from 'antd';
import {
  EditOutlined,
  InfoCircleOutlined,
  QrcodeOutlined,
  RetweetOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  SortAscendingOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';

import { HttpUtil, SizeFormatter, IntlUtil, ColorUtils } from '@/utils';
import InfinityIcon from '@/components/InfinityIcon';
import { useDatepicker } from '@/hooks/useDatepicker';
import './ClientRowTable.css';

interface ClientRowTableProps {
  dbInbound: any;
  isMobile?: boolean;
  trafficDiff: number;
  expireDiff: number;
  onlineClients: string[];
  lastOnlineMap: Record<string, number>;
  isDarkTheme?: boolean;
  pageSize: number;
  totalClientCount: number;
  statsVersion?: number;
  selectedClientIds?: string[];
  autoSelectFirst?: boolean;
  onEditClient?: (payload: { dbInbound: any; client: any }) => void;
  onQrcodeClient?: (payload: { dbInbound: any; client: any }) => void;
  onInfoClient?: (payload: { dbInbound: any; client: any }) => void;
  onResetTrafficClient?: (payload: { dbInbound: any; client: any }) => void;
  onDeleteClient?: (payload: { dbInbound: any; client: any; force: boolean }) => void;
  onDeleteClients?: (payload: { dbInbound: any; clients: any[] }) => void;
  onToggleEnableClient?: (payload: { dbInbound: any; client: any; next: boolean }) => void;
  onSelectedClientIdsChange?: (ids: string[]) => void;
  onReorderDone?: () => void;
}

function rowKey(client: any): string {
  return client.email || client.id || client.password || JSON.stringify(client);
}

export default function ClientRowTable({
  dbInbound,
  isMobile,
  trafficDiff,
  expireDiff,
  onlineClients,
  lastOnlineMap,
  isDarkTheme,
  pageSize,
  totalClientCount,
  statsVersion,
  selectedClientIds,
  autoSelectFirst,
  onEditClient,
  onQrcodeClient,
  onInfoClient,
  onResetTrafficClient,
  onDeleteClient,
  onDeleteClients,
  onToggleEnableClient,
  onSelectedClientIdsChange,
  onReorderDone,
}: ClientRowTableProps) {
  const { t } = useTranslation();
  const { datepicker } = useDatepicker();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const [currentPage, setCurrentPage] = useState(1);
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());
  const [statsClient, setStatsClient] = useState<any>(null);

  // Reorder mode
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderData, setReorderData] = useState<any[]>([]);
  const snapshotBeforeReorder = useRef<string[]>([]);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const dragKeyRef = useRef<string | null>(null);
  const dragStyle = useRef<HTMLStyleElement | null>(null);
  const dragPointerId = useRef(-1);
  const pointerDrag = useRef({ started: false, startY: 0 });

  const inbound = useMemo(() => dbInbound.toInbound(), [dbInbound]);
  const clients: any[] = useMemo(() => inbound?.clients || [], [inbound]);

  const paginatedClients = useMemo(() => {
    if (!pageSize || pageSize <= 0) return clients;
    const start = (currentPage - 1) * pageSize;
    return clients.slice(start, start + pageSize);
  }, [clients, currentPage, pageSize]);

  useEffect(() => {
    const total = clients.length;
    const size = pageSize > 0 ? pageSize : (total || 1);
    const maxPage = Math.max(1, Math.ceil(total / size));
    if (currentPage > maxPage) setCurrentPage(maxPage);
  }, [clients.length, pageSize, currentPage]);

  const statsMap = useMemo(() => {
    void statsVersion;
    const m = new Map<string, any>();
    for (const cs of (Array.isArray(dbInbound.clientStats) ? dbInbound.clientStats : [])) {
      m.set(cs.email, cs);
    }
    return m;
  }, [dbInbound.clientStats, statsVersion]);

  const statsFor = useCallback((email: string) => (email ? statsMap.get(email) : null), [statsMap]);
  const getUp = useCallback((email: string) => statsFor(email)?.up || 0, [statsFor]);
  const getDown = useCallback((email: string) => statsFor(email)?.down || 0, [statsFor]);
  const getSum = useCallback((email: string) => { const s = statsFor(email); return s ? s.up + s.down : 0; }, [statsFor]);
  const getRem = useCallback((email: string) => {
    const s = statsFor(email);
    if (!s) return 0;
    const r = s.total - s.up - s.down;
    return r > 0 ? r : 0;
  }, [statsFor]);
  const getAllTime = useCallback((email: string) => {
    const s = statsFor(email);
    if (!s) return 0;
    const current = (s.up || 0) + (s.down || 0);
    return s.allTime > current ? s.allTime : current;
  }, [statsFor]);
  const isClientDepleted = useCallback((email: string) => {
    const s = statsFor(email);
    if (!s) return false;
    const total = s.total ?? 0;
    const used = (s.up ?? 0) + (s.down ?? 0);
    if (total > 0 && used >= total) return true;
    const exp = s.expiryTime ?? 0;
    if (exp > 0 && Date.now() >= exp) return true;
    return false;
  }, [statsFor]);
  const isClientOnline = useCallback((email: string) => !!email && onlineClients.includes(email), [onlineClients]);
  const lastOnlineLabel = useCallback((email: string) => {
    const ts = lastOnlineMap[email];
    if (!ts) return '-';
    return IntlUtil.formatDate(ts, datepicker);
  }, [lastOnlineMap, datepicker]);

  const statsProgress = useCallback((email: string) => {
    const s = statsFor(email);
    if (!s) return 0;
    if (s.total === 0) return 100;
    return (100 * (s.down + s.up)) / s.total;
  }, [statsFor]);

  const expireProgress = useCallback((expTime: number, reset: number) => {
    const now = Date.now();
    const remainedSec = expTime < 0 ? -expTime / 1000 : (expTime - now) / 1000;
    const resetSec = reset * 86400;
    if (remainedSec >= resetSec) return 0;
    return 100 * (1 - remainedSec / resetSec);
  }, []);

  const clientStatsColor = useCallback((email: string) =>
    ColorUtils.clientUsageColor(statsFor(email), trafficDiff), [statsFor, trafficDiff]);

  const statsExpColor = useCallback((email: string) => {
    const PURPLE = '#722ed1', SUCCESS = '#52c41a', WARN = '#faad14', DANGER = '#ff4d4f';
    if (!email) return PURPLE;
    const s = statsFor(email);
    if (!s) return PURPLE;
    const a = ColorUtils.usageColor(s.down + s.up, trafficDiff, s.total);
    const b = ColorUtils.usageColor(Date.now(), expireDiff, s.expiryTime);
    if (a === 'red' || b === 'red') return DANGER;
    if (a === 'orange' || b === 'orange') return WARN;
    if (a === 'green' || b === 'green') return SUCCESS;
    return PURPLE;
  }, [statsFor, trafficDiff, expireDiff]);

  const isRemovable = (totalClientCount || clients.length) > 1;

  const totalGbDisplay = useCallback((client: any) => {
    if (!client.totalGB || client.totalGB <= 0) return '';
    return `${Math.round((client.totalGB / 1073741824) * 100) / 100} GB`;
  }, []);

  const isUnlimitedTotal = useCallback((client: any) => !client.totalGB || client.totalGB <= 0, []);

  const statusBadgeColor = useCallback((client: any) => {
    if (!client.enable) return isDarkTheme ? '#2c3950' : '#bcbcbc';
    return statsExpColor(client.email);
  }, [isDarkTheme, statsExpColor]);

  function getIntClientId(client: any): number {
    try {
      const raw = typeof dbInbound.settings === 'string'
        ? JSON.parse(dbInbound.settings)
        : (dbInbound.settings || {});
      const list = raw.clients || [];
      const email = client.email;
      if (email) {
        const found = list.find((c: any) => c.email === email);
        if (found?.clientId) return found.clientId;
      }
      const clientKey = client.id || client.password || client.auth;
      if (clientKey) {
        for (const c of list) {
          if (c.id === clientKey || c.password === clientKey || c.auth === clientKey) {
            if (c.clientId) return c.clientId;
          }
        }
      }
    } catch { /* ignore */ }
    return 0;
  }

  // === Reorder helpers ===
  function enterReorder() {
    const list = [...clients];
    snapshotBeforeReorder.current = list.map((c) => rowKey(c));
    setReorderData(list);
    setReorderMode(true);
    setCurrentPage(1);
  }

  function cancelReorder() {
    snapshotBeforeReorder.current = [];
    setReorderMode(false);
    setReorderData([]);
    removeDragStyle();
  }

  async function confirmReorder() {
    const emails = reorderData.map((c: any) => c.email).filter(Boolean);
    try {
      const res = await HttpUtil.post(
        `/panel/api/inbounds/${dbInbound.id}/clients/reorder`,
        { emails },
        { headers: { 'Content-Type': 'application/json' } },
      );
      if (!res?.success) throw new Error(res?.msg || 'reorder failed');
    } catch { return; }
    setReorderMode(false);
    setReorderData([]);
    snapshotBeforeReorder.current = [];
    removeDragStyle();
    onReorderDone?.();
  }

  function injectDragStyle() {
    if (dragStyle.current) return;
    dragStyle.current = document.createElement('style');
    dragStyle.current.textContent = '.client-list.reorder-active .client-row{background:transparent!important}.client-list.reorder-active .client-row:hover{background:transparent!important}.client-row.row-dragging{opacity:0.4;outline:2px dashed #1890ff;outline-offset:-2px}';
    document.head.appendChild(dragStyle.current);
  }

  function removeDragStyle() {
    if (dragStyle.current) { dragStyle.current.remove(); dragStyle.current = null; }
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

  function rowReorderByKey(fromKey: string, toKey: string) {
    if (!fromKey || !toKey || fromKey === toKey) return;
    setReorderData((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((c) => rowKey(c) === fromKey);
      const toIdx = arr.findIndex((c) => rowKey(c) === toKey);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
  }

  // Pointer Events drag for client reorder
  useEffect(() => {
    if (!reorderMode) return;
    const timer = setTimeout(() => {
      const list = document.querySelector('.client-list');
      if (!list || (list as any)._ptrInit) return;
      (list as any)._ptrInit = true;
      list.addEventListener('pointerdown', (e) => {
        if (!reorderMode) return;
        const row = (e.target as HTMLElement).closest('.client-row');
        if (!row) return;
        // Ignore clicks on interactive elements
        if ((e.target as HTMLElement).closest('button, .ant-switch, .ant-checkbox, .ant-dropdown, a')) return;
        const key = row.getAttribute('data-client-key');
        if (!key) return;
        e.preventDefault();
        dragPointerId.current = e.pointerId;
        pointerDrag.current = { started: false, startY: e.clientY };
        document.addEventListener('pointermove', onRowPointerMove);
        document.addEventListener('pointerup', onRowPointerUp);
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [reorderMode]);

  function onRowPointerMove(e: PointerEvent) {
    if (e.pointerId !== dragPointerId.current) return;
    e.preventDefault();
    if (!pointerDrag.current.started) {
      if (Math.abs(e.clientY - pointerDrag.current.startY) < 5) return;
      pointerDrag.current.started = true;
      injectDragStyle();
    }
    const rows = document.querySelectorAll('.client-row[data-client-key]');
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY < rect.bottom) {
        const rowKeyVal = row.getAttribute('data-client-key');
        if (rowKeyVal && rowKeyVal !== dragKeyRef.current) {
          if (dragKeyRef.current) {
            rowReorderByKey(dragKeyRef.current, rowKeyVal);
          }
          dragKeyRef.current = rowKeyVal;
          setDraggedKey(rowKeyVal);
        }
        break;
      }
    }
  }

  function onRowPointerUp() {
    document.removeEventListener('pointermove', onRowPointerMove);
    document.removeEventListener('pointerup', onRowPointerUp);
    dragKeyRef.current = null;
    setDraggedKey(null);
    setReorderData((prev) => [...prev]);
    (document.activeElement as HTMLElement)?.blur();
    window.getSelection()?.removeAllRanges();
    removeDragStyle();
    dragPointerId.current = -1;
    pointerDrag.current = { started: false, startY: 0 };
  }

  // Cleanup drag listeners on unmount
  useEffect(() => {
    return () => {
      removeDragStyle();
      document.removeEventListener('pointermove', onRowPointerMove);
      document.removeEventListener('pointerup', onRowPointerUp);
    };
  }, []);

  const confirmReset = useCallback((client: any) => {
    modalApi.confirm({
      title: `${t('pages.inbounds.resetTraffic')} — ${client.email}`,
      content: t('pages.inbounds.resetTrafficContent'),
      okText: t('reset'),
      cancelText: t('cancel'),
      onOk: () => onResetTrafficClient?.({ dbInbound, client }),
    });
  }, [modalApi, t, dbInbound, onResetTrafficClient]);

  const confirmDelete = useCallback(async (client: any) => {
    const email = client.email || '';
    let subRows = '';

    if (email) {
      try {
        const resp = await HttpUtil.get(
          `/panel/api/inbounds/checkClientSubscriptions?email=${encodeURIComponent(email)}`,
        );
        if (resp?.success) {
          const affected = resp.obj?.affected || [];
          const toBeDeleted = resp.obj?.toBeDeleted || [];
          const fmtSub = (s: any) => `${s.remark || s.subId} (${s.subId})`;
          if (affected.length > 0) {
            subRows += `${t('pages.inbounds.batch.subWillRemoveClient')}\n${affected.map(fmtSub).join(', ')}`;
          }
          if (toBeDeleted.length > 0) {
            if (subRows) subRows += '\n\n';
            subRows += `${t('pages.inbounds.batch.subWillDeleteClient')}\n${toBeDeleted.map(fmtSub).join(', ')}`;
          }
        }
      } catch { /* proceed without subscription info */ }
    }

    const force = subRows !== '';

    modalApi.confirm({
      title: `${t('pages.inbounds.deleteClient')} — ${client.email}`,
      content: subRows || t('pages.inbounds.deleteClientContent'),
      okText: t('delete'),
      okType: 'danger',
      cancelText: t('cancel'),
      onOk: () => onDeleteClient?.({ dbInbound, client, force }),
    });
  }, [modalApi, t, dbInbound, onDeleteClient]);

  // Selection state
  const emitSelection = useCallback(() => {
    onSelectedClientIdsChange?.(Array.from(localSelected));
  }, [localSelected, onSelectedClientIdsChange]);

  useEffect(() => {
    if (clients.length === 0) return;
    const valid = new Set(clients.map(rowKey));
    const next = new Set<string>();
    for (const k of localSelected) if (valid.has(k)) next.add(k);
    if (next.size !== localSelected.size) {
      setLocalSelected(next);
      // avoid stale closure
    }
    if (localSelected.size === 0 && autoSelectFirst) {
      const firstKey = rowKey(clients[0]);
      const s = new Set([firstKey]);
      setLocalSelected(s);
      onSelectedClientIdsChange?.(Array.from(s));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients]);

  // Emit whenever localSelected changes
  useEffect(() => {
    onSelectedClientIdsChange?.(Array.from(localSelected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSelected]);

  const allSelected = clients.length > 0 && clients.every((c) => localSelected.has(rowKey(c)));
  const selectedCount = localSelected.size;

  const toggleSelect = useCallback((client: any, next: boolean) => {
    const key = rowKey(client);
    setLocalSelected((prev) => {
      const s = new Set(prev);
      if (next) s.add(key); else s.delete(key);
      return s;
    });
  }, []);

  const selectAll = useCallback((next: boolean) => {
    if (next) {
      setLocalSelected(new Set(clients.map(rowKey)));
    } else {
      setLocalSelected(new Set());
    }
  }, [clients]);

  const clearSelection = useCallback(() => {
    setLocalSelected(new Set());
  }, []);

  const confirmBulkDelete = useCallback(() => {
    const picked = clients.filter((c) => localSelected.has(rowKey(c)));
    if (picked.length === 0) return;

    const total = clients.length;
    const keepLast = picked.length === total;
    const toDelete = keepLast ? picked.slice(0, -1) : picked;

    if (toDelete.length === 0) {
      modalApi.warning({
        title: t('pages.inbounds.deleteClient'),
        content: 'Inbound must keep at least one client — delete the inbound to remove all.',
        okText: t('confirm'),
      });
      return;
    }

    modalApi.confirm({
      title: `${t('pages.inbounds.deleteClient')} — ${toDelete.length}${keepLast ? ` / ${total}` : ''}`,
      content: keepLast
        ? 'Inbound must keep at least one client — the last selected will remain. Delete the inbound to remove all.'
        : t('pages.inbounds.deleteClientContent'),
      okText: t('delete'),
      okType: 'danger',
      cancelText: t('cancel'),
      onOk: () => {
        onDeleteClients?.({ dbInbound, clients: toDelete });
        clearSelection();
      },
    });
  }, [clients, localSelected, modalApi, t, dbInbound, onDeleteClients, clearSelection]);

  // Render desktop grid
  const renderDesktop = () => {
    const dataSource = reorderMode ? reorderData : paginatedClients;
    return (
    <div className={`client-list${isRemovable ? ' has-select' : ''}${reorderMode ? ' reorder-active' : ''}`}>
      {reorderMode && (
        <div className="reorder-toolbar">
          <Button type="primary" size="small" onClick={confirmReorder}>
            <CheckOutlined /> {t('pages.inbounds.confirmSort')}
          </Button>
          <Button size="small" onClick={cancelReorder}>
            <CloseOutlined /> {t('pages.inbounds.cancelSort')}
          </Button>
        </div>
      )}
      {!reorderMode && isRemovable && selectedCount > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{selectedCount} selected</span>
          <Button size="small" type="link" onClick={clearSelection}>{t('cancel')}</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={confirmBulkDelete}>{t('delete')}</Button>
        </div>
      )}

      <div className="client-row client-list-header">
        {!reorderMode && isRemovable && (
          <div className="cell cell-select">
            <Checkbox checked={allSelected} onChange={(e) => selectAll(e.target.checked)} />
          </div>
        )}
        <div className="cell cell-actions">{reorderMode ? t('pages.inbounds.sort') : t('pages.settings.actions')}</div>
        <div className="cell cell-enable">{t('enable')}</div>
        <div className="cell cell-online">{t('online')}</div>
        <div className="cell cell-client">{t('pages.inbounds.client')}</div>
        <div className="cell cell-traffic">{t('pages.inbounds.traffic')}</div>
        <div className="cell cell-remained">{t('remained')}</div>
        <div className="cell cell-alltime">{t('pages.inbounds.allTimeTraffic')}</div>
        <div className="cell cell-expiry">{t('pages.inbounds.expireDate')}</div>
      </div>

      {dataSource.map((client: any, idx: number) => (
        <div
          key={rowKey(client)}
          data-client-key={reorderMode ? rowKey(client) : undefined}
          className={`client-row${localSelected.has(rowKey(client)) ? ' is-selected' : ''}${reorderMode && draggedKey === rowKey(client) ? ' row-dragging' : ''}`}
        >
          {!reorderMode && isRemovable && (
            <div className="cell cell-select">
              <Checkbox
                checked={localSelected.has(rowKey(client))}
                onChange={(e) => toggleSelect(client, e.target.checked)}
              />
            </div>
          )}
          <div className="cell cell-actions">
            {reorderMode ? (
              <>
                <Button size="small" disabled={idx === 0} onClick={() => moveRow(idx, -1)}>{'↑'}</Button>
                <Button size="small" disabled={idx === dataSource.length - 1} onClick={() => moveRow(idx, 1)}>{'↓'}</Button>
              </>
            ) : (
              <>
                {dbInbound.hasLink() && (
                  <Tooltip title={t('qrCode')}>
                    <QrcodeOutlined className="row-icon" onClick={() => onQrcodeClient?.({ dbInbound, client })} />
                  </Tooltip>
                )}
                <Tooltip title={t('edit')}>
                  <EditOutlined className="row-icon" onClick={() => onEditClient?.({ dbInbound, client })} />
                </Tooltip>
                <Tooltip title={t('info')}>
                  <InfoCircleOutlined className="row-icon" onClick={() => onInfoClient?.({ dbInbound, client })} />
                </Tooltip>
                {client.email && (
                  <Tooltip title={t('pages.inbounds.resetTraffic')}>
                    <RetweetOutlined className="row-icon" onClick={() => confirmReset(client)} />
                  </Tooltip>
                )}
                {isRemovable && (
                  <Tooltip title={t('delete')}>
                    <DeleteOutlined className="row-icon danger" onClick={() => confirmDelete(client)} />
                  </Tooltip>
                )}
              </>
            )}
          </div>

          <div className="cell cell-enable">
            <Switch
              checked={client.enable}
              size="small"
              onChange={(next) => onToggleEnableClient?.({ dbInbound, client, next })}
            />
          </div>

          <div className="cell cell-online">
            <Popover content={`${t('lastOnline')}: ${lastOnlineLabel(client.email)}`}>
              {client.enable && isClientOnline(client.email) ? (
                <Tag color="green">{t('online')}</Tag>
              ) : (
                <Tag>{t('offline')}</Tag>
              )}
            </Popover>
          </div>

          <div className="cell cell-client">
            <Tooltip title={
              isClientDepleted(client.email) ? t('depleted')
                : !client.enable ? t('disabled')
                : isClientOnline(client.email) ? t('online')
                : t('offline')
            }>
              <Badge color={statusBadgeColor(client)} />
            </Tooltip>
            <div className="client-id-stack">
              <Tooltip title={client.email}>
                <span className="client-email">{client.email}</span>
              </Tooltip>
              {client.comment && client.comment.trim() && (
                <span className="client-comment">
                  {client.comment.length > 50 ? client.comment.substring(0, 47) + '…' : client.comment}
                </span>
              )}
            </div>
          </div>

          <div className="cell cell-traffic">
            <Popover content={client.email ? (
              <table cellPadding={2}>
                <tbody>
                  <tr>
                    <td>{'↑'} {SizeFormatter.sizeFormat(getUp(client.email))}</td>
                    <td>{'↓'} {SizeFormatter.sizeFormat(getDown(client.email))}</td>
                  </tr>
                  {client.totalGB > 0 && (
                    <tr>
                      <td>{t('remained')}</td>
                      <td>{SizeFormatter.sizeFormat(getRem(client.email))}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : null}>
              <div className="usage-bar">
                <span className="usage-text">{SizeFormatter.sizeFormat(getSum(client.email))}</span>
                {!client.enable ? (
                  <Progress
                    strokeColor={isDarkTheme ? 'rgb(72,84,105)' : '#bcbcbc'}
                    showInfo={false}
                    percent={statsProgress(client.email)}
                    size="small"
                  />
                ) : client.totalGB > 0 ? (
                  <Progress
                    strokeColor={clientStatsColor(client.email)}
                    showInfo={false}
                    status={isClientDepleted(client.email) ? 'exception' : undefined}
                    percent={statsProgress(client.email)}
                    size="small"
                  />
                ) : (
                  <Progress showInfo={false} percent={100} strokeColor="#722ed1" size="small" />
                )}
                <span className="usage-text">
                  {isUnlimitedTotal(client) ? <InfinityIcon /> : totalGbDisplay(client)}
                </span>
              </div>
            </Popover>
          </div>

          <div className="cell cell-remained">
            {isUnlimitedTotal(client) ? (
              <Tag color="purple" style={{ border: 'none' }} className="infinite-tag">
                <InfinityIcon />
              </Tag>
            ) : (
              <Tag color={isClientDepleted(client.email) ? 'red' : undefined}>
                {SizeFormatter.sizeFormat(getRem(client.email))}
              </Tag>
            )}
          </div>

          <div className="cell cell-alltime">
            <Tag>{SizeFormatter.sizeFormat(getAllTime(client.email))}</Tag>
          </div>

          <div className="cell cell-expiry">
            {client.expiryTime !== 0 && client.reset > 0 ? (
              <Popover content={
                <span>{client.expiryTime < 0 ? t('pages.client.delayedStart') : IntlUtil.formatDate(client.expiryTime, datepicker)}</span>
              }>
                <div className="usage-bar">
                  <span className="usage-text">{IntlUtil.formatRelativeTime(client.expiryTime)}</span>
                  <Progress
                    showInfo={false}
                    status={isClientDepleted(client.email) ? 'exception' : undefined}
                    percent={expireProgress(client.expiryTime, client.reset)}
                    size="small"
                  />
                  <span className="usage-text">{client.reset}d</span>
                </div>
              </Popover>
            ) : client.expiryTime !== 0 ? (
              <Popover content={
                <span>{client.expiryTime < 0 ? t('pages.client.delayedStart') : IntlUtil.formatDate(client.expiryTime, datepicker)}</span>
              }>
                <Tag
                  style={{ minWidth: 50, border: 'none' }}
                  color={ColorUtils.userExpiryColor(expireDiff, client, isDarkTheme)}
                >
                  {IntlUtil.formatRelativeTime(client.expiryTime)}
                </Tag>
              </Popover>
            ) : (
              <Tag
                color={ColorUtils.userExpiryColor(expireDiff, client, isDarkTheme)}
                style={{ border: 'none' }}
                className="infinite-tag"
              >
                <InfinityIcon />
              </Tag>
            )}
          </div>
        </div>
      ))}
    </div>
  );
  };

  const rowActionsMenu = useCallback((client: any): MenuProps['items'] => [
    ...(dbInbound.hasLink() ? [{ key: 'qrcode', icon: <QrcodeOutlined />, label: t('qrCode'), onClick: () => onQrcodeClient?.({ dbInbound, client }) }] : []),
    { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => onEditClient?.({ dbInbound, client }) },
    { key: 'info', icon: <InfoCircleOutlined />, label: t('info'), onClick: () => onInfoClient?.({ dbInbound, client }) },
    ...(client.email ? [{ key: 'reset', icon: <RetweetOutlined />, label: t('pages.inbounds.resetTraffic'), onClick: () => confirmReset(client) }] : []),
    ...(isRemovable ? [{ key: 'delete', icon: <DeleteOutlined />, danger: true, label: (<span className="danger-text">{t('delete')}</span>), onClick: () => confirmDelete(client) }] : []),
  ], [dbInbound, t, onQrcodeClient, onEditClient, onInfoClient, confirmReset, isRemovable, confirmDelete]);

  // Render mobile cards
  const renderMobile = () => (
    <div className="client-list is-mobile">
      {isRemovable && selectedCount > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{selectedCount} selected</span>
          <Button size="small" type="link" onClick={clearSelection}>{t('cancel')}</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={confirmBulkDelete}>{t('delete')}</Button>
        </div>
      )}

      {paginatedClients.map((client: any) => (
        <div key={rowKey(client)} className={`client-card${localSelected.has(rowKey(client)) ? ' is-selected' : ''}`}>
          <div className="client-card-head">
            {isRemovable && (
              <Checkbox
                checked={localSelected.has(rowKey(client))}
                onChange={(e) => toggleSelect(client, e.target.checked)}
              />
            )}
            <Tooltip title={
              isClientDepleted(client.email) ? t('depleted')
                : !client.enable ? t('disabled')
                : isClientOnline(client.email) ? t('online')
                : t('offline')
            }>
              <Badge color={statusBadgeColor(client)} />
            </Tooltip>
            <Tooltip title={client.email}>
              <span className="client-email">{client.email}</span>
            </Tooltip>
            <div className="client-card-actions">
              <Tooltip title={t('info')}>
                <InfoCircleOutlined className="row-icon" onClick={() => setStatsClient(client)} />
              </Tooltip>
              <Switch
                checked={client.enable}
                size="small"
                onChange={(next) => onToggleEnableClient?.({ dbInbound, client, next })}
              />
              <Dropdown trigger={['click']} placement="bottomRight" menu={{ items: rowActionsMenu(client) }}>
                <EllipsisOutlined className="row-icon" onClick={(e) => e.preventDefault()} />
              </Dropdown>
            </div>
          </div>
        </div>
      ))}

      <Modal
        open={!!statsClient}
        footer={null}
        width={360}
        centered
        title={statsClient ? statsClient.email || t('info') : ''}
        onCancel={() => setStatsClient(null)}
        destroyOnHidden
      >
        {statsClient && (
          <div className="client-card-foot">
            {statsClient.comment && statsClient.comment.trim() && (
              <div className="client-comment-line">{statsClient.comment}</div>
            )}
            <div className="stat-row">
              <span className="stat-label">{t('pages.inbounds.traffic')}</span>
              <Tag color={clientStatsColor(statsClient.email)}>
                {SizeFormatter.sizeFormat(getSum(statsClient.email))} /
                {isUnlimitedTotal(statsClient) ? <InfinityIcon /> : totalGbDisplay(statsClient)}
              </Tag>
            </div>
            <div className="stat-row">
              <span className="stat-label">{t('remained')}</span>
              {isUnlimitedTotal(statsClient) ? (
                <Tag color="purple" style={{ border: 'none' }} className="infinite-tag">
                  <InfinityIcon />
                </Tag>
              ) : (
                <Tag color={isClientDepleted(statsClient.email) ? 'red' : undefined}>
                  {SizeFormatter.sizeFormat(getRem(statsClient.email))}
                </Tag>
              )}
            </div>
            <div className="stat-row">
              <span className="stat-label">{t('pages.inbounds.allTimeTraffic')}</span>
              <Tag>{SizeFormatter.sizeFormat(getAllTime(statsClient.email))}</Tag>
            </div>
            <div className="stat-row">
              <span className="stat-label">{t('online')}</span>
              {statsClient.enable && isClientOnline(statsClient.email) ? (
                <Tag color="green">{t('online')}</Tag>
              ) : (
                <Tag>{t('offline')}</Tag>
              )}
            </div>
            <div className="stat-row">
              <span className="stat-label">{t('pages.inbounds.expireDate')}</span>
              {statsClient.expiryTime > 0 ? (
                <Tag color={ColorUtils.userExpiryColor(expireDiff, statsClient, isDarkTheme)}>
                  {IntlUtil.formatRelativeTime(statsClient.expiryTime)}
                </Tag>
              ) : statsClient.expiryTime < 0 ? (
                <Tag color="green">
                  {-statsClient.expiryTime / 86400000}d ({t('pages.client.delayedStart')})
                </Tag>
              ) : (
                <Tag color="purple"><InfinityIcon /></Tag>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );

  return (
    <>
      {modalContextHolder}
      {isMobile ? renderMobile() : renderDesktop()}
      {!reorderMode && pageSize > 0 && clients.length > pageSize && (
        <Pagination
          current={currentPage}
          pageSize={pageSize}
          total={clients.length}
          showSizeChanger={false}
          size="small"
          className="client-list-pagination"
          onChange={setCurrentPage}
        />
      )}
      {!isMobile && clients.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 16px' }}>
          <Button size="small" onClick={enterReorder}>
            <SortAscendingOutlined /> {t('pages.inbounds.sort')}
          </Button>
        </div>
      )}
    </>
  );
}
