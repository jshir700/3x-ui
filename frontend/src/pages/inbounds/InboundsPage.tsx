/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Col,
  ConfigProvider,
  Layout,
  Modal,
  Row,
  Space,
  Spin,
  Tag,
  Popover,
  message,
} from 'antd';
import {
  SwapOutlined,
  PieChartOutlined,
  BarsOutlined,
  TeamOutlined,
} from '@ant-design/icons';

import { setMessageInstance } from '@/utils/messageBus';
import { HttpUtil, SizeFormatter, RandomUtil, checkInboundPortConflict } from '@/utils';
import { Inbound } from '@/models/inbound.js';
import { coerceInboundJsonField } from '@/models/dbinbound.js';
import { useTheme } from '@/hooks/useTheme';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useNodes } from '@/hooks/useNodes';
import AppSidebar from '@/components/AppSidebar';
import CustomStatistic from '@/components/CustomStatistic';
import LazyMount from '@/components/LazyMount';
const TextModal = lazy(() => import('@/components/TextModal'));
const PromptModal = lazy(() => import('@/components/PromptModal'));

import { useInbounds } from './useInbounds';
import InboundList from './InboundList';
const InboundFormModal = lazy(() => import('./InboundFormModal'));
const InboundInfoModal = lazy(() => import('./InboundInfoModal'));
const QrCodeModal = lazy(() => import('./QrCodeModal'));
const ClientFormModal = lazy(() => import('./ClientFormModal'));
const ClientBulkModal = lazy(() => import('./ClientBulkModal'));
const CopyClientsModal = lazy(() => import('./CopyClientsModal'));
const BatchEditModal = lazy(() => import('./BatchEditModal'));
import '@/styles/page-cards.css';
import './InboundsPage.css';

type RowAction =
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
  | 'delDepletedClients';

type GeneralAction =
  | 'import'
  | 'export'
  | 'resetInbounds'
  | 'resetClients'
  | 'delDepletedClients'
  | 'batchEdit'
  | 'batchDelInbounds';

export default function InboundsPage() {
  const { t } = useTranslation();
  const { isDark, isUltra, antdThemeConfig } = useTheme();
  const { isMobile } = useMediaQuery();

  const {
    fetched,
    dbInbounds,
    clientCount,
    onlineClients,
    lastOnlineMap,
    statsVersion,
    totals,
    expireDiff,
    trafficDiff,
    pageSize,
    subSettings,
    tgBotEnable,
    ipLimitEnable,
    remarkModel,
    refresh,
    hydrateInbound,
    fetchDefaultSettings,
    applyTrafficEvent,
    applyClientStatsEvent,
    applyInvalidate,
    applyInboundsEvent,
  } = useInbounds();

  const [modal, modalContextHolder] = Modal.useModal();
  const [messageApi, messageContextHolder] = message.useMessage();
  useEffect(() => { setMessageInstance(messageApi); }, [messageApi]);

  const { nodes: nodesList } = useNodes();
  const nodesById = useMemo(() => {
    const map = new Map<number, ReturnType<typeof useNodes>['nodes'][number]>();
    for (const n of nodesList || []) map.set(n.id, n);
    return map;
  }, [nodesList]);

  const hasActiveNode = useMemo(
    () => (nodesList || []).some((n) => n.enable && n.status === 'online'),
    [nodesList],
  );
  const hasNodeAttachedInbound = useMemo(
    () => (dbInbounds as any[]).some((ib: any) => ib?.nodeId != null),
    [dbInbounds],
  );
  const showNodeInfo = hasNodeAttachedInbound || hasActiveNode;

  // Compute port conflict map: disabled inbounds that share a port with enabled ones
  const portConflictMap = useMemo(() => {
    const map: Record<number, number[]> = {};
    for (const ib of (dbInbounds as any[])) {
      if (ib.enable) continue;
      const result = checkInboundPortConflict(ib, dbInbounds as any[]);
      if (result.hasConflict) {
        map[ib.id] = result.conflictIds;
      }
    }
    return map;
  }, [dbInbounds]);

  useWebSocket({
    traffic: applyTrafficEvent,
    client_stats: applyClientStatsEvent,
    invalidate: applyInvalidate,
    inbounds: applyInboundsEvent,
  });

  useEffect(() => {
    fetchDefaultSettings().then(() => refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === Row selection state ===============================================
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Trigger a re-render after an enable-switch optimistic update.
  function onToggleEnable() {
    // Force re-render by spreading the array
    // The dbInbounds ref is updated in place by useInbounds
  }

  // === Enable-switch race guard ==========================================
  let skipNextInvalidate = false;
  (window as any).__setSkipInvalidate = (dur?: number) => {
    skipNextInvalidate = true;
    setTimeout(() => { skipNextInvalidate = false; }, dur || 500);
  };
  (window as any).__skipNextInvalidate = () => {
    if (skipNextInvalidate) { skipNextInvalidate = false; return true; }
    return false;
  };

  // === Modal state =======================================================
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [formDbInbound, setFormDbInbound] = useState<any>(null);

  const [infoOpen, setInfoOpen] = useState(false);
  const [infoDbInbound, setInfoDbInbound] = useState<any>(null);
  const [infoClientIndex, setInfoClientIndex] = useState(0);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrDbInbound, setQrDbInbound] = useState<any>(null);
  const [qrClient, setQrClient] = useState<any>(null);

  // Client modals
  const [clientOpen, setClientOpen] = useState(false);
  const [clientMode, setClientMode] = useState<'add' | 'edit'>('add');
  const [clientDbInbound, setClientDbInbound] = useState<any>(null);
  const [clientIndex, setClientIndex] = useState<number | null>(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDbInbound, setBulkDbInbound] = useState<any>(null);

  const [copyOpen, setCopyOpen] = useState(false);
  const [copyDbInbound, setCopyDbInbound] = useState<any>(null);

  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [batchEditInbounds, setBatchEditInbounds] = useState<any[]>([]);

  const [textOpen, setTextOpen] = useState(false);
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [textFileName, setTextFileName] = useState('');

  const [promptOpen, setPromptOpen] = useState(false);
  const [promptTitle, setPromptTitle] = useState('');
  const [promptOkText, setPromptOkText] = useState('OK');
  const [promptType, setPromptType] = useState<'textarea' | 'input'>('textarea');
  const [promptInitial, setPromptInitial] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptHandler, setPromptHandler] = useState<((value: string) => Promise<boolean | void> | boolean | void) | null>(null);

  // === Helpers ===========================================================
  const hostOverrideFor = useCallback((dbInbound: any) => {
    if (!dbInbound || dbInbound.nodeId == null) return '';
    return nodesById.get(dbInbound.nodeId)?.address || '';
  }, [nodesById]);

  const infoNodeAddress = useMemo(() => hostOverrideFor(infoDbInbound), [infoDbInbound, hostOverrideFor]);
  const qrNodeAddress = useMemo(() => hostOverrideFor(qrDbInbound), [qrDbInbound, hostOverrideFor]);

  function projectChildThroughMaster(child: any, master: any) {
    const projected = JSON.parse(JSON.stringify(child));
    projected.listen = master.listen;
    projected.port = master.port;
    const masterStream = master.toInbound().stream;
    const childInbound = child.toInbound();
    childInbound.stream.security = masterStream.security;
    childInbound.stream.tls = masterStream.tls;
    childInbound.stream.reality = masterStream.reality;
    childInbound.stream.externalProxy = masterStream.externalProxy;
    projected.streamSettings = childInbound.stream.toString();
    return new child.constructor(projected);
  }

  function checkFallback(dbInbound: any) {
    const parent = dbInbound?.fallbackParent;
    if (parent?.masterId) {
      const master = (dbInbounds as any[]).find((ib: any) => ib.id === parent.masterId);
      if (master) return projectChildThroughMaster(dbInbound, master);
    }
    if (!(dbInbound?.listen as string | undefined)?.startsWith?.('@')) return dbInbound;
    for (const candidate of dbInbounds as any[]) {
      if (candidate.id === dbInbound.id) continue;
      const parsed = candidate.toInbound();
      if (!parsed.isTcp) continue;
      if (!['trojan', 'vless'].includes(parsed.protocol)) continue;
      const fallbacks = parsed.settings.fallbacks || [];
      if (!fallbacks.find((f: { dest?: string }) => f.dest === dbInbound.listen)) continue;
      return projectChildThroughMaster(dbInbound, candidate);
    }
    return dbInbound;
  }

  function findClientIndex(dbInbound: any, client: any) {
    if (!client) return 0;
    const inbound = dbInbound.toInbound();
    const clients = inbound?.clients || [];
    const idx = clients.findIndex((c: any) => {
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

  function getClientId(protocol: string, client: any) {
    switch (protocol) {
      case 'trojan': return client.password;
      case 'shadowsocks': return client.email;
      case 'hysteria': return client.auth;
      default: return client.id;
    }
  }

  function getIntClientIdFromSettings(settingsStr: string, client: any) {
    try {
      const raw = typeof settingsStr === 'string' ? JSON.parse(settingsStr) : (settingsStr || {});
      const clients = raw.clients || [];
      const email = client.email;
      if (email) {
        const found = clients.find((c: any) => c.email === email);
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

  // === Text / prompt helpers =============================================
  const openText = useCallback((opts: { title: string; content: string; fileName?: string }) => {
    setTextTitle(opts.title);
    setTextContent(opts.content);
    setTextFileName(opts.fileName || '');
    setTextOpen(true);
  }, []);

  const openPrompt = useCallback((opts: {
    title: string;
    okText?: string;
    type?: 'textarea' | 'input';
    value?: string;
    confirm: (value: string) => Promise<boolean | void> | boolean | void;
  }) => {
    setPromptTitle(opts.title);
    setPromptOkText(opts.okText || 'OK');
    setPromptType(opts.type || 'textarea');
    setPromptInitial(opts.value || '');
    setPromptHandler(() => opts.confirm);
    setPromptOpen(true);
  }, []);

  const onPromptConfirm = useCallback(async (value: string) => {
    if (!promptHandler) {
      setPromptOpen(false);
      return;
    }
    setPromptLoading(true);
    try {
      const ok = await promptHandler(value);
      if (ok !== false) setPromptOpen(false);
    } finally {
      setPromptLoading(false);
    }
  }, [promptHandler]);

  // === Export helpers ====================================================
  const exportInboundLinks = useCallback((dbInbound: any) => {
    const projected = checkFallback(dbInbound);
    openText({
      title: t('pages.inbounds.exportLinksTitle'),
      content: projected.genInboundLinks(remarkModel, hostOverrideFor(dbInbound)),
      fileName: projected.remark || 'inbound',
    });
  }, [remarkModel, hostOverrideFor, openText, t]);

  const exportInboundClipboard = useCallback((dbInbound: any) => {
    openText({ title: t('pages.inbounds.inboundJsonTitle'), content: JSON.stringify(dbInbound, null, 2) });
  }, [openText, t]);

  const exportInboundSubLinks = useCallback(async (dbInbound: any) => {
    try {
      const [settingResp, subsResp] = await Promise.all([
        HttpUtil.get('/panel/setting/all'),
        HttpUtil.get(`/panel/api/inbounds/checkSubscriptions/${dbInbound.id}`),
      ]);
      let baseUrl = '';
      const s = settingResp?.obj;
      if (s) {
        const uri = s.subURI || '';
        const path = s.subPath || '/sub/';
        if (uri) {
          baseUrl = uri.endsWith('/') ? uri : uri + '/';
        } else if (s.subPortLocked) {
          const extPort = s.subExternalPort > 0 ? s.subExternalPort : (s.subPort || 2096);
          baseUrl = `${window.location.protocol}//${window.location.hostname}:${extPort}${path}`;
        } else {
          const port = s.subPort || 2096;
          baseUrl = `${window.location.protocol}//${window.location.hostname}:${port}${path}`;
        }
      }
      const subs = (subsResp?.success && Array.isArray(subsResp.obj)) ? subsResp.obj : [];
      const lines: string[] = [];
      for (const sub of subs) {
        const label = sub.title || sub.remark || sub.subId;
        lines.push(`${label}: ${baseUrl}${sub.subId}`);
      }
      openText({
        title: t('pages.inbounds.exportSubsTitle'),
        content: lines.length > 0 ? lines.join('\r\n') : t('pages.inbounds.noSubscriptionsFound'),
        fileName: dbInbound.remark || 'subscription-links',
      });
    } catch {
      openText({
        title: t('pages.inbounds.exportSubsTitle'),
        content: t('somethingWentWrong'),
      });
    }
  }, [openText, t]);

  const exportAllSubLinks = useCallback(async () => {
    try {
      const [settingResp] = await Promise.all([
        HttpUtil.get('/panel/setting/all'),
      ]);
      let baseUrl = '';
      const s = settingResp?.obj;
      if (s) {
        const uri = s.subURI || '';
        const path = s.subPath || '/sub/';
        if (uri) {
          baseUrl = uri.endsWith('/') ? uri : uri + '/';
        } else if (s.subPortLocked) {
          const extPort = s.subExternalPort > 0 ? s.subExternalPort : (s.subPort || 2096);
          baseUrl = `${window.location.protocol}//${window.location.hostname}:${extPort}${path}`;
        } else {
          const port = s.subPort || 2096;
          baseUrl = `${window.location.protocol}//${window.location.hostname}:${port}${path}`;
        }
      }
      const seen = new Set<string>();
      const lines: string[] = [];
      for (const ib of dbInbounds as any[]) {
        if (!selectedIds.includes(ib.id)) continue;
        try {
          const subsResp = await HttpUtil.get(`/panel/api/inbounds/checkSubscriptions/${ib.id}`);
          const subs = (subsResp?.success && Array.isArray(subsResp.obj)) ? subsResp.obj : [];
          for (const sub of subs) {
            if (seen.has(sub.subId)) continue;
            seen.add(sub.subId);
            const label = sub.title || sub.remark || sub.subId;
            lines.push(`${label}: ${baseUrl}${sub.subId}`);
          }
        } catch (_e) { /* skip */ }
      }
      openText({
        title: t('pages.inbounds.exportAllSubsTitle'),
        content: lines.length > 0 ? lines.join('\r\n') : t('pages.inbounds.noSubscriptionsFound'),
        fileName: t('subAllInbounds'),
      });
    } catch {
      openText({
        title: t('pages.inbounds.exportAllSubsTitle'),
        content: t('somethingWentWrong'),
      });
    }
  }, [dbInbounds, selectedIds, openText, t]);

  const exportAllLinks = useCallback(async () => {
    const out: string[] = [];
    for (const ib of dbInbounds as any[]) {
      if (!selectedIds.includes(ib.id)) continue;
      const projected = checkFallback(ib);
      const links = projected.genInboundLinks(remarkModel, hostOverrideFor(ib));
      if (links) out.push(links);
    }
    openText({ title: t('pages.inbounds.exportAllLinksTitle'), content: out.join('\r\n'), fileName: t('subAllInbounds') });
  }, [dbInbounds, selectedIds, remarkModel, hostOverrideFor, openText, t]);

  const importInbound = useCallback(() => {
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
  }, [openPrompt, refresh, t]);

  // === Inbound CRUD ======================================================
  const onAddInbound = useCallback(() => {
    setFormMode('add');
    setFormDbInbound(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((dbInbound: any) => {
    setFormMode('edit');
    setFormDbInbound(dbInbound);
    setFormOpen(true);
  }, []);

  const confirmDelete = useCallback(async (dbInbound: any) => {
    let onlyThisInbound: any[] = [];
    let multiInbound: any[] = [];
    let subsWillDelete: any[] = [];

    try {
      const clientsResp = await HttpUtil.get(`/panel/api/inbounds/checkClients/${dbInbound.id}`);
      if (clientsResp?.success) {
        onlyThisInbound = clientsResp.obj?.onlyThisInbound || [];
        multiInbound = clientsResp.obj?.multiInbound || [];
      }
    } catch (_e) { /* proceed */ }

    try {
      const subsResp = await HttpUtil.get(`/panel/api/inbounds/checkSubscriptions/${dbInbound.id}`);
      if (subsResp?.success && Array.isArray(subsResp.obj)) {
        subsWillDelete = subsResp.obj.filter((s: any) => s.onlyOne);
      }
    } catch (_e) { /* proceed */ }

    const hasAny = onlyThisInbound.length > 0 || multiInbound.length > 0 || subsWillDelete.length > 0;
    const fmtSub = (s: any) => `${s.title || s.remark || s.subId} (${s.remark || s.subId})`;
    const fmtClient = (c: any) => c.comment ? `${c.email} (${c.comment})` : c.email;

    const content = (
      <div>
        <div>{t('pages.inbounds.deleteInboundText', { remark: dbInbound.remark, protocol: dbInbound.protocol, port: dbInbound.port })}</div>
        {subsWillDelete.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div>{t('pages.inbounds.deleteSubWillBeRemoved')}</div>
            {subsWillDelete.map((s: any) => <div key={s.id}>  • {fmtSub(s)}</div>)}
          </div>
        )}
        {onlyThisInbound.length > 0 && (
          <div style={{ marginTop: (subsWillDelete.length > 0 ? 4 : 12) }}>
            <div>{t('pages.inbounds.deleteClientWillBeRemoved')}</div>
            {onlyThisInbound.map((c: any) => <div key={c.email}>  • {fmtClient(c)}</div>)}
          </div>
        )}
        {multiInbound.length > 0 && (
          <div style={{ marginTop: (onlyThisInbound.length > 0 || subsWillDelete.length > 0 ? 4 : 12) }}>
            <div>{t('pages.inbounds.deleteClientWillBeDetached')}</div>
            {multiInbound.map((c: any) => <div key={c.email}>  • {fmtClient(c)}</div>)}
          </div>
        )}
      </div>
    );

    modal.confirm({
      title: t('pages.inbounds.deleteInboundTitle'),
      content,
      okText: t('delete'),
      okType: 'danger',
      cancelText: t('cancel'),
      onOk: async () => {
        const endpoint = hasAny
          ? `/panel/api/inbounds/forceDel/${dbInbound.id}`
          : `/panel/api/inbounds/del/${dbInbound.id}`;
        const msg = await HttpUtil.post(endpoint);
        if (msg?.success) await refresh();
      },
    });
  }, [modal, refresh, t]);

  const confirmResetTraffic = useCallback((dbInbound: any) => {
    modal.confirm({
      title: t('pages.inbounds.resetConfirmTitle', { remark: dbInbound.remark }),
      content: t('pages.inbounds.resetConfirmContent'),
      okText: t('reset'),
      cancelText: t('cancel'),
      onOk: async () => {
        const msg = await HttpUtil.post(`/panel/api/inbounds/${dbInbound.id}/resetTraffic`);
        if (msg?.success) await refresh();
      },
    });
  }, [modal, refresh, t]);

  const confirmClone = useCallback((dbInbound: any) => {
    modal.confirm({
      title: t('pages.inbounds.cloneConfirmTitle', { remark: dbInbound.remark }),
      content: t('pages.inbounds.cloneConfirmContent'),
      okText: t('pages.inbounds.clone'),
      cancelText: t('cancel'),
      onOk: async () => {
        const baseInbound = dbInbound.toInbound();
        let clonedSettings: string;
        try {
          const raw = coerceInboundJsonField(dbInbound.settings);
          raw.clients = [];
          clonedSettings = JSON.stringify(raw);
        } catch {
          clonedSettings = (Inbound as any).Settings.getSettings(baseInbound.protocol).toString();
        }
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
          settings: clonedSettings,
          streamSettings: baseInbound.stream.toString(),
          sniffing: baseInbound.sniffing.toString(),
        };
        const msg = await HttpUtil.post('/panel/api/inbounds/add', data);
        if (msg?.success) await refresh();
      },
    });
  }, [modal, refresh, t]);

  function confirmDelDepleted(inboundId: number) {
    modal.confirm({
      title: t('pages.inbounds.delDepletedClientsTitle'),
      content: t('pages.inbounds.delDepletedClientsContent'),
      okText: t('delete'),
      okType: 'danger',
      cancelText: t('cancel'),
      onOk: async () => {
        const msg = await HttpUtil.post(`/panel/api/inbounds/delDepletedClients/${inboundId}`);
        if (msg?.success) await refresh();
      },
    });
  }

  // === Client handlers ===================================================
  const onEditClient = useCallback(({ dbInbound, client }: { dbInbound: any; client: any }) => {
    setClientMode('edit');
    setClientDbInbound(dbInbound);
    setClientIndex(findClientIndex(dbInbound, client));
    setClientOpen(true);
  }, []);

  const onQrcodeClient = useCallback(({ dbInbound, client }: { dbInbound: any; client: any }) => {
    setQrDbInbound(checkFallback(dbInbound));
    setQrClient(client || null);
    setQrOpen(true);
  }, []);

  const onInfoClient = useCallback(({ dbInbound, client }: { dbInbound: any; client: any }) => {
    setInfoDbInbound(checkFallback(dbInbound));
    setInfoClientIndex(findClientIndex(dbInbound, client));
    setInfoOpen(true);
  }, []);

  const onResetTrafficClient = useCallback(async ({ dbInbound, client }: { dbInbound: any; client: any }) => {
    const msg = await HttpUtil.post(
      `/panel/api/inbounds/${dbInbound.id}/resetClientTraffic/${client.email}`,
    );
    if (msg?.success) await refresh();
  }, [refresh]);

  const onDeleteClient = useCallback(async ({ dbInbound, client, force }: { dbInbound: any; client: any; force: boolean }) => {
    const clientId = getClientId(dbInbound.protocol, client);
    const endpoint = force
      ? `/panel/api/inbounds/${dbInbound.id}/forceDelClient/${clientId}`
      : `/panel/api/inbounds/${dbInbound.id}/delClient/${clientId}`;
    const msg = await HttpUtil.post(endpoint);
    if (msg?.success) await refresh();
  }, [refresh]);

  const onDeleteClients = useCallback(async ({ dbInbound, clients }: { dbInbound: any; clients: any[] }) => {
    for (const client of clients) {
      const clientId = getClientId(dbInbound.protocol, client);
      await HttpUtil.post(`/panel/api/inbounds/${dbInbound.id}/delClient/${clientId}`);
    }
    await refresh();
  }, [refresh]);

  const onToggleEnableClient = useCallback(async ({ dbInbound, client, next }: { dbInbound: any; client: any; next: boolean }) => {
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
  }, [refresh]);

  // === Batch operations ==================================================
  const onBatchDeleteInbounds = useCallback(async () => {
    const ids = selectedIds;
    if (ids.length < 2) return;
    const fmtSub = (s: any) => `${s.title || s.remark || s.subId} (${s.remark || s.subId})`;
    const fmtClient = (c: any) => c.comment ? `${c.email} (${c.comment})` : c.email;

    type InboundCheckResult = {
      onlyThisInbound: any[];
      multiInbound: any[];
      subsWillDelete: any[];
    };
    const checkResults: Record<number, InboundCheckResult> = {};

    for (const id of ids) {
      let onlyThisInbound: any[] = [];
      let multiInbound: any[] = [];
      let subsWillDelete: any[] = [];
      try {
        const clientsResp = await HttpUtil.get(`/panel/api/inbounds/checkClients/${id}`);
        if (clientsResp?.success) {
          onlyThisInbound = clientsResp.obj?.onlyThisInbound || [];
          multiInbound = clientsResp.obj?.multiInbound || [];
        }
      } catch (_e) { /* skip */ }
      try {
        const subsResp = await HttpUtil.get(`/panel/api/inbounds/checkSubscriptions/${id}`);
        if (subsResp?.success && Array.isArray(subsResp.obj)) {
          subsWillDelete = subsResp.obj.filter((s: any) => s.onlyOne);
        }
      } catch (_e) { /* skip */ }
      if (onlyThisInbound.length > 0 || multiInbound.length > 0 || subsWillDelete.length > 0) {
        checkResults[id] = { onlyThisInbound, multiInbound, subsWillDelete };
      }
    }

    const content = (
      <div>
        <div>{t('pages.inbounds.batch.deleteInboundsText', { count: ids.length })}</div>
        {ids.map((id) => {
          const dbInbound = (dbInbounds as any[]).find((ib: any) => ib.id === id);
          if (!dbInbound) return null;
          const r = checkResults[id];
          return (
            <div key={id} style={{ marginTop: 12 }}>
              <div>━━━ {dbInbound.remark} ({dbInbound.protocol}:{dbInbound.port}) ━━━</div>
              {r && (
                <div>
                  {r.subsWillDelete.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <div>{t('pages.inbounds.deleteSubWillBeRemoved')}</div>
                      {r.subsWillDelete.map((s: any) => <div key={s.id}>  • {fmtSub(s)}</div>)}
                    </div>
                  )}
                  {r.onlyThisInbound.length > 0 && (
                    <div style={{ marginTop: (r.subsWillDelete.length > 0 ? 4 : 4) }}>
                      <div>{t('pages.inbounds.deleteClientWillBeRemoved')}</div>
                      {r.onlyThisInbound.map((c: any) => <div key={c.email}>  • {fmtClient(c)}</div>)}
                    </div>
                  )}
                  {r.multiInbound.length > 0 && (
                    <div style={{ marginTop: (r.onlyThisInbound.length > 0 || r.subsWillDelete.length > 0 ? 4 : 4) }}>
                      <div>{t('pages.inbounds.deleteClientWillBeDetached')}</div>
                      {r.multiInbound.map((c: any) => <div key={c.email}>  • {fmtClient(c)}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div style={{ marginTop: 12 }}>{t('irreversibleWarning')}</div>
      </div>
    );

    modal.confirm({
      title: t('pages.inbounds.batch.deleteInboundsBulkTitle'),
      content,
      okText: t('delete'),
      okType: 'danger',
      cancelText: t('cancel'),
      onOk: async () => {
        for (const id of ids) {
          const hasSubs = !!checkResults[id];
          const endpoint = hasSubs
            ? `/panel/api/inbounds/forceDel/${id}`
            : `/panel/api/inbounds/del/${id}`;
          await HttpUtil.post(endpoint);
        }
        await refresh();
      },
    });
  }, [selectedIds, dbInbounds, modal, refresh, t]);

  const onBatchEditInbounds = useCallback(() => {
    const ids = selectedIds;
    if (ids.length < 2) return;
    const inbounds = ids
      .map((id) => (dbInbounds as any[]).find((ib: any) => ib.id === id))
      .filter(Boolean);
    setBatchEditInbounds(inbounds);
    setBatchEditOpen(true);
  }, [selectedIds, dbInbounds]);

  // === Row action ========================================================
  const onRowAction = useCallback(async ({ key, dbInbound }: { key: RowAction; dbInbound: any }) => {
    const hydratingKeys: RowAction[] = ['edit', 'showInfo', 'qrcode', 'export', 'subs', 'clipboard', 'clone', 'addClient', 'addBulkClient', 'copyClients'];
    let target = dbInbound;
    if (hydratingKeys.includes(key)) {
      const hydrated = await hydrateInbound(dbInbound.id);
      if (hydrated) target = hydrated;
    }
    switch (key) {
      case 'edit':
        openEdit(target);
        break;
      case 'addClient':
        setClientMode('add');
        setClientDbInbound(target);
        setClientIndex(null);
        setClientOpen(true);
        break;
      case 'addBulkClient':
        setBulkDbInbound(target);
        setBulkOpen(true);
        break;
      case 'showInfo':
        setInfoDbInbound(checkFallback(target));
        setInfoClientIndex(findClientIndex(target, null));
        setInfoOpen(true);
        break;
      case 'qrcode':
        setQrDbInbound(checkFallback(target));
        setQrClient(null);
        setQrOpen(true);
        break;
      case 'export':
        exportInboundLinks(target);
        break;
      case 'clipboard':
        exportInboundClipboard(target);
        break;
      case 'copyClients':
        setCopyDbInbound(target);
        setCopyOpen(true);
        break;
      case 'delete':
        confirmDelete(target);
        break;
      case 'resetTraffic':
        confirmResetTraffic(target);
        break;
      case 'clone':
        confirmClone(target);
        break;
      case 'resetClients':
        modal.confirm({
          title: t('pages.clients.resetAllTrafficsTitle'),
          okText: t('reset'),
          cancelText: t('cancel'),
          onOk: async () => {
            const msg = await HttpUtil.post(`/panel/api/inbounds/resetAllClientTraffics/${dbInbound.id}`);
            if (msg?.success) await refresh();
          },
        });
        break;
      case 'delDepletedClients':
        confirmDelDepleted(dbInbound.id);
        break;
      case 'subs':
        exportInboundSubLinks(target);
        break;
      default:
        messageApi.info(`Action "${key}" — coming in a later 5f subphase`);
    }
  }, [hydrateInbound, openEdit, checkFallback, findClientIndex, exportInboundLinks, exportInboundClipboard, exportInboundSubLinks, confirmDelete, confirmResetTraffic, confirmClone, modal, refresh, t, messageApi]);

  // === General action =====================================================
  const onGeneralAction = useCallback((key: GeneralAction) => {
    switch (key) {
      case 'batchEdit':
        onBatchEditInbounds();
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
      case 'exportSubs':
        exportAllSubLinks();
        break;
      case 'resetInbounds':
        modal.confirm({
          title: t('pages.inbounds.resetAllTrafficTitle'),
          content: t('pages.inbounds.resetAllTrafficContent'),
          okText: t('reset'),
          cancelText: t('cancel'),
          onOk: async () => {
            const msg = await HttpUtil.post('/panel/api/inbounds/resetAllTraffics');
            if (msg?.success) await refresh();
          },
        });
        break;
      case 'resetClients':
        modal.confirm({
          title: t('pages.inbounds.resetAllClientTrafficTitle'),
          content: t('pages.inbounds.resetAllClientTrafficContent'),
          okText: t('reset'),
          cancelText: t('cancel'),
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
        messageApi.info(`General action "${key}" — coming in a later 5f subphase`);
    }
  }, [onBatchEditInbounds, onBatchDeleteInbounds, importInbound, exportAllLinks, modal, refresh, t, messageApi]);

  const basePath = (typeof window !== 'undefined' && (window as any).X_UI_BASE_PATH) || '';
  const requestUri = typeof window !== 'undefined' ? window.location.pathname : '';

  return (
    <ConfigProvider theme={antdThemeConfig}>
      {messageContextHolder}
      {modalContextHolder}
      <Layout className={`inbounds-page${isDark ? ' is-dark' : ''}${isUltra ? ' is-ultra' : ''}`}>
        <AppSidebar basePath={basePath} requestUri={requestUri} />

        <Layout className="content-shell">
          <Layout.Content id="content-layout" className="content-area">
            <Spin spinning={!fetched} delay={200} description="Loading…" size="large">
              {!fetched ? (
                <div className="loading-spacer" />
              ) : (
                <Row gutter={[isMobile ? 8 : 16, 12]}>
                  <Col span={24}>
                    <Card size="small" hoverable className="summary-card">
                      <Row gutter={[16, 12]}>
                        <Col xs={12} sm={12} md={6}>
                          <CustomStatistic
                            title={t('pages.inbounds.totalDownUp')}
                            value={`${SizeFormatter.sizeFormat(totals.up)} / ${SizeFormatter.sizeFormat(totals.down)}`}
                            prefix={<SwapOutlined />}
                          />
                        </Col>
                        <Col xs={12} sm={12} md={6}>
                          <CustomStatistic
                            title={t('pages.inbounds.totalUsage')}
                            value={SizeFormatter.sizeFormat(totals.up + totals.down)}
                            prefix={<PieChartOutlined />}
                          />
                        </Col>
                        <Col xs={12} sm={12} md={6}>
                          <CustomStatistic
                            title={t('pages.inbounds.inboundCount')}
                            value={String(dbInbounds.length)}
                            prefix={<BarsOutlined />}
                          />
                        </Col>
                        <Col xs={24} sm={24} md={6}>
                          <CustomStatistic
                            title={t('clients')}
                            value=" "
                            prefix={(
                              <Space direction="horizontal">
                                <TeamOutlined />
                                <Tag color="green">{totals.clients}</Tag>
                                {totals.deactive.length > 0 && (
                                  <Popover title={t('disabled')} content={(
                                    <div className="client-email-list">
                                      {totals.deactive.map((e: string) => <div key={e}>{e}</div>)}
                                    </div>
                                  )}>
                                    <Tag>{totals.deactive.length}</Tag>
                                  </Popover>
                                )}
                                {totals.depleted.length > 0 && (
                                  <Popover title={t('depleted')} content={(
                                    <div className="client-email-list">
                                      {totals.depleted.map((e: string) => <div key={e}>{e}</div>)}
                                    </div>
                                  )}>
                                    <Tag color="red">{totals.depleted.length}</Tag>
                                  </Popover>
                                )}
                                {totals.expiring.length > 0 && (
                                  <Popover title={t('depletingSoon')} content={(
                                    <div className="client-email-list">
                                      {totals.expiring.map((e: string) => <div key={e}>{e}</div>)}
                                    </div>
                                  )}>
                                    <Tag color="orange">{totals.expiring.length}</Tag>
                                  </Popover>
                                )}
                                {totals.online.length > 0 && (
                                  <Popover title={t('online')} content={(
                                    <div className="client-email-list">
                                      {totals.online.map((e: string) => <div key={e}>{e}</div>)}
                                    </div>
                                  )}>
                                    <Tag color="blue">{totals.online.length}</Tag>
                                  </Popover>
                                )}
                              </Space>
                            )}
                          />
                        </Col>
                      </Row>
                    </Card>
                  </Col>

                  <Col span={24}>
                    <InboundList
                      dbInbounds={dbInbounds as any}
                      clientCount={clientCount}
                      expireDiff={expireDiff}
                      trafficDiff={trafficDiff}
                      pageSize={pageSize}
                      isMobile={isMobile}
                      isDarkTheme={isDark}
                      nodesById={nodesById}
                      hasActiveNode={showNodeInfo}
                      selectedIds={selectedIds}
                      portConflictMap={portConflictMap}
                      onAddInbound={onAddInbound}
                      onGeneralAction={onGeneralAction}
                      onRowAction={onRowAction}
                      onRefresh={refresh}
                      onToggleEnable={onToggleEnable}
                      onUpdateSelectedIds={setSelectedIds}
                    />
                  </Col>
                </Row>
              )}
            </Spin>
          </Layout.Content>
        </Layout>

        <LazyMount when={formOpen}>
          <InboundFormModal
            open={formOpen}
            onClose={() => setFormOpen(false)}
            onSaved={refresh}
            mode={formMode}
            dbInbound={formDbInbound}
            dbInbounds={dbInbounds as any[]}
            availableNodes={nodesList}
          />
        </LazyMount>
        <LazyMount when={infoOpen}>
          <InboundInfoModal
            open={infoOpen}
            onClose={() => setInfoOpen(false)}
            dbInbound={infoDbInbound}
            clientIndex={infoClientIndex}
            remarkModel={remarkModel}
            expireDiff={expireDiff}
            trafficDiff={trafficDiff}
            ipLimitEnable={ipLimitEnable}
            tgBotEnable={tgBotEnable}
            subSettings={subSettings}
            lastOnlineMap={lastOnlineMap}
            nodeAddress={infoNodeAddress}
          />
        </LazyMount>
        <LazyMount when={qrOpen}>
          <QrCodeModal
            open={qrOpen}
            onClose={() => setQrOpen(false)}
            dbInbound={qrDbInbound}
            client={qrClient}
            remarkModel={remarkModel}
            nodeAddress={qrNodeAddress}
            subSettings={subSettings}
          />
        </LazyMount>

        {/* Client modals */}
        <LazyMount when={clientOpen}>
          <ClientFormModal
            open={clientOpen}
            onClose={() => setClientOpen(false)}
            mode={clientMode}
            dbInbound={clientDbInbound}
            clientIndex={clientIndex}
            subEnable={subSettings.enable}
            tgBotEnable={tgBotEnable}
            ipLimitEnable={ipLimitEnable}
            trafficDiff={trafficDiff}
            onSaved={refresh}
          />
        </LazyMount>
        <LazyMount when={bulkOpen}>
          <ClientBulkModal
            open={bulkOpen}
            onClose={() => setBulkOpen(false)}
            dbInbound={bulkDbInbound}
            subEnable={subSettings.enable}
            tgBotEnable={tgBotEnable}
            ipLimitEnable={ipLimitEnable}
            onSaved={refresh}
          />
        </LazyMount>
        <LazyMount when={copyOpen}>
          <CopyClientsModal
            open={copyOpen}
            onClose={() => setCopyOpen(false)}
            dbInbound={copyDbInbound}
            dbInbounds={dbInbounds as any[]}
            onSaved={refresh}
          />
        </LazyMount>
        <LazyMount when={batchEditOpen}>
          <BatchEditModal
            open={batchEditOpen}
            onClose={() => setBatchEditOpen(false)}
            inbounds={batchEditInbounds}
            onDone={refresh}
          />
        </LazyMount>

        <LazyMount when={textOpen}>
          <TextModal
            open={textOpen}
            onClose={() => setTextOpen(false)}
            title={textTitle}
            content={textContent}
            fileName={textFileName}
          />
        </LazyMount>
        <LazyMount when={promptOpen}>
          <PromptModal
            open={promptOpen}
            onClose={() => setPromptOpen(false)}
            title={promptTitle}
            okText={promptOkText}
            type={promptType}
            initialValue={promptInitial}
            loading={promptLoading}
            onConfirm={onPromptConfirm}
          />
        </LazyMount>
      </Layout>
    </ConfigProvider>
  );
}
