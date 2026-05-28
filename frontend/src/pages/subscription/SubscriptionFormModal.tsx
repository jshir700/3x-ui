import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  Button,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Radio,
  Row,
  Select,
  Switch,
  Tabs,
} from 'antd';
import { CaretUpOutlined, CaretDownOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';

import { HttpUtil } from '@/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useTheme } from '@/hooks/useTheme';
import DateTimePicker from '@/components/DateTimePicker';

interface FlatClientItem {
  key: string;
  label: string;
  inboundKeys: number[];
  enable: boolean;
  active: boolean;
}

interface SubscriptionFormModalProps {
  open: boolean;
  mode: 'add' | 'edit';
  subscription?: any;
  save: (payload: Record<string, unknown>) => Promise<{ success: boolean; msg?: string }>;
  onOpenChange: (open: boolean) => void;
  subPortLocked?: boolean;
  subExternalPort?: number;
}

const SUB_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateSubId(): string {
  let id = '';
  for (let i = 0; i < 16; i++) id += SUB_ID_CHARS[Math.floor(Math.random() * SUB_ID_CHARS.length)];
  return id;
}

function generatePassword(): string {
  let pwd = '';
  for (let i = 0; i < 16; i++) pwd += SUB_ID_CHARS[Math.floor(Math.random() * SUB_ID_CHARS.length)];
  return pwd;
}

function clientEmailKey(email: string) { return `client-${email}`; }

function extractInboundClients(ib: any): { email: string; enable: boolean; expiryTime: number }[] {
  const clients: { email: string; enable: boolean; expiryTime: number }[] = [];
  try {
    const settings = typeof ib.settings === 'string' ? JSON.parse(ib.settings) : (ib.settings || {});
    for (const c of (settings.clients || [])) {
      const email: string = c.email || '';
      if (!email) continue;
      clients.push({ email, enable: c.enable !== false, expiryTime: c.expiryTime || 0 });
    }
  } catch { /* ignore */ }
  return clients;
}

function flatClientList(list: any[]): FlatClientItem[] {
  const now = Date.now();
  const map = new Map<string, FlatClientItem>();

  for (const ib of list) {
    const inboundActive = ib.enable && (ib.expiryTime <= 0 || now < ib.expiryTime);
    for (const c of (ib.clients || [])) {
      const email: string = c.email || '';
      if (!email) continue;
      const clientActive = inboundActive && c.enable && (c.expiryTime <= 0 || now < c.expiryTime);

      let item = map.get(email);
      if (!item) {
        item = {
          key: clientEmailKey(email),
          label: email,
          inboundKeys: [],
          enable: c.enable,
          active: clientActive,
        };
        map.set(email, item);
      }
      if (!item.inboundKeys.includes(ib.key)) {
        item.inboundKeys.push(ib.key);
      }
      item.enable = item.enable || c.enable;
      item.active = item.active || clientActive;
    }
  }

  return Array.from(map.values());
}

export default function SubscriptionFormModal({
  open,
  mode,
  subscription,
  save,
  onOpenChange,
  subPortLocked,
  subExternalPort,
}: SubscriptionFormModalProps) {
  const { t } = useTranslation();
  const { isDark, isUltra } = useTheme();
  const themeColors = useMemo(() => ({
    clientNameActive: isUltra ? '#d0d0d0' : isDark ? '#e8e8e8' : '#333',
    clientNameInactive: '#ff4d4f',
    rowBg: isUltra ? '#1a1a1e' : isDark ? '#2a2b30' : '#fafafa',
    rowBorder: isDark ? 'rgba(255,255,255,0.12)' : '#e8e8e8',
    dragHighlight: isDark ? '#1a3350' : '#d6e9ff',
    containerBorder: isDark ? 'rgba(255,255,255,0.12)' : '#e8e8e8',
  }), [isDark, isUltra]);
  const [activeTabKey, setActiveTabKey] = useState('general');
  const [allInbounds, setAllInbounds] = useState<any[]>([]);
  const [selectedClients, setSelectedClients] = useState<FlatClientItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const initializedRef = useRef(false);
  const { isMobile } = useMediaQuery();

  // Drag-and-drop state (native Pointer Events, ported from Vue)
  const dragState = useRef({ started: false, startY: 0, targetIdx: -1, pointerId: -1 });
  const dragIdx = useRef<number | null>(null);
  const [draggedIdx, setDraggedIdx] = useState(-1);
  const selectedListRef = useRef<HTMLDivElement>(null);
  const dragArrayRef = useRef<FlatClientItem[] | null>(null);

  // Form fields
  const [subId, setSubId] = useState('');
  const [remark, setRemark] = useState('');
  const [enable, setEnable] = useState(true);
  const [format, setFormat] = useState('base64');
  const [password, setPassword] = useState('');
  const [expiryEnabled, setExpiryEnabled] = useState(false);
  const [expiryTime, setExpiryTime] = useState(0);
  const [expiryDate, setExpiryDate] = useState<Dayjs | null>(null);
  const [showInfo, setShowInfo] = useState(true);
  const [emailInRemark, setEmailInRemark] = useState(false);
  const [title, setTitle] = useState('');
  const [supportUrl, setSupportUrl] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [announce, setAnnounce] = useState('');
  const [updateInterval, setUpdateInterval] = useState(12);
  const [syncWithInboundOrder, setSyncWithInboundOrder] = useState(false);
  const [autoIncludeAllEnabled, setAutoIncludeAllEnabled] = useState(false);
  const [userAgentEnabled, setUserAgentEnabled] = useState(false);
  const [userAgentValues, setUserAgentValues] = useState<string[]>([]);

  const handlePointerDown = useCallback((e: React.PointerEvent, index: number) => {
    if (syncWithInboundOrder || isMobile) return;
    e.preventDefault();
    const ptrId = e.pointerId;
    dragState.current = { started: false, startY: e.clientY, targetIdx: index, pointerId: ptrId };
    const arr = [...selectedClients];
    dragArrayRef.current = arr;
    dragIdx.current = index;

    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== ptrId) return;
      ev.preventDefault();
      if (!dragState.current.started) {
        if (Math.abs(ev.clientY - dragState.current.startY) < 5) return;
        dragState.current.started = true;
        setDraggedIdx(dragState.current.targetIdx);
      }
      if (dragIdx.current === null || !dragArrayRef.current) return;
      const container = selectedListRef.current;
      if (!container) return;
      const items = container.querySelectorAll('[data-client-key]');
      for (const itemEl of items) {
        const rect = (itemEl as HTMLElement).getBoundingClientRect();
        if (ev.clientY >= rect.top && ev.clientY < rect.bottom) {
          const key = itemEl.getAttribute('data-client-key');
          const idx = dragArrayRef.current.findIndex((i) => i.key === key);
          if (idx >= 0 && idx !== dragIdx.current) {
            const it = dragArrayRef.current.splice(dragIdx.current, 1)[0];
            dragArrayRef.current.splice(idx, 0, it);
            dragIdx.current = idx;
            setDraggedIdx(idx);
            setSelectedClients([...dragArrayRef.current]);
          }
          break;
        }
      }
    }

    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      setDraggedIdx(-1);
      dragIdx.current = null;
      dragArrayRef.current = null;
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [syncWithInboundOrder, isMobile, selectedClients]);

  const resetForm = useCallback(() => {
    setSubId(generateSubId());
    setRemark('');
    setEnable(true);
    setFormat('base64');
    setPassword('');
    setExpiryEnabled(false);
    setExpiryTime(Date.now() + 86400000);
    setExpiryDate(null);
    setShowInfo(true);
    setEmailInRemark(false);
    setTitle('');
    setSupportUrl('');
    setProfileUrl('');
    setAnnounce('');
    setUpdateInterval(12);
    setSyncWithInboundOrder(false);
    setAutoIncludeAllEnabled(false);
    setUserAgentEnabled(false);
    setUserAgentValues([]);
    setSearchQuery('');
  }, []);

  const subLinkHint = useMemo(() => {
    if (!subId) return '';
    const host = window.location.hostname;
    const subPort = subPortLocked
      ? (subExternalPort || 2096)
      : 2096;
    return `${window.location.protocol}//${host}:${subPort}/sub/${subId}`;
  }, [subId, subPortLocked, subExternalPort]);

  const filteredAvailable = useMemo(() => {
    const selectedKeys = new Set(selectedClients.map((i) => i.key));
    const q = searchQuery.toLowerCase();
    const flat = flatClientList(allInbounds);
    return flat.filter((i) => !selectedKeys.has(i.key)).filter((i) => {
      if (!q) return true;
      return (i.label || '').toLowerCase().includes(q);
    });
  }, [allInbounds, selectedClients, searchQuery]);

  const loadInbounds = useCallback(async () => {
    const msg = await HttpUtil.get('/panel/api/inbounds/list');
    if (msg?.success && Array.isArray(msg.obj)) {
      const data = msg.obj.map((ib: any) => ({
        key: ib.id,
        title: `${ib.protocol} (${ib.port})`,
        remark: ib.remark || ib.tag,
        enable: ib.enable,
        expiryTime: ib.expiryTime || 0,
        clients: extractInboundClients(ib),
      }));
      setAllInbounds(data);
      return data;
    }
    return [];
  }, []);

  const sortByInboundOrder = useCallback(async () => {
    const msg = await HttpUtil.get('/panel/api/inbounds/list');
    if (!msg?.success || !Array.isArray(msg.obj)) return;
    const orderMap = new Map<number, number>();
    msg.obj.forEach((ib: any, idx: number) => orderMap.set(ib.id, idx));
    setSelectedClients((prev) => {
      const sorted = [...prev].sort((a, b) => {
        const minA = Math.min(...a.inboundKeys.map((k) => orderMap.has(k) ? orderMap.get(k)! : 999999));
        const minB = Math.min(...b.inboundKeys.map((k) => orderMap.has(k) ? orderMap.get(k)! : 999999));
        if (minA !== minB) return minA - minB;
        return a.label.localeCompare(b.label);
      });
      return sorted;
    });
  }, []);

  const syncClientsWithAutoInclude = useCallback(() => {
    const flat = flatClientList(allInbounds);
    setSelectedClients((prev) => {
      const currentKeys = new Set(prev.map((i) => i.key));
      const newItems = flat.filter((fi) => fi.active && !currentKeys.has(fi.key));
      if (newItems.length === 0) return prev;
      return [...prev, ...newItems];
    });
  }, [allInbounds]);

  // Initialize on open
  useEffect(() => {
    if (!open) { initializedRef.current = false; return; }
    if (initializedRef.current) return;
    initializedRef.current = true;
    setActiveTabKey('general');

    (async () => {
      const data = await loadInbounds();

      if (mode === 'edit' && subscription) {
        const et = subscription.expiryTime || 0;
        setSubId(subscription.subId || '');
        setRemark(subscription.remark || '');
        setEnable(subscription.enable !== false);
        setFormat(subscription.format || 'base64');
        setPassword(subscription.password || '');
        setExpiryEnabled(et > 0);
        setExpiryTime(et > 0 ? et : Date.now() + 86400000);
        setExpiryDate(et > 0 ? dayjs(et) : null);
        setShowInfo(subscription.showInfo !== false);
        setEmailInRemark(!!subscription.emailInRemark);
        setTitle(subscription.title || '');
        setSupportUrl(subscription.supportUrl || '');
        setProfileUrl(subscription.profileUrl || '');
        setAnnounce(subscription.announce || '');
        setUpdateInterval(subscription.updateInterval || 12);
        setSyncWithInboundOrder(!!subscription.syncWithInboundOrder);
        setAutoIncludeAllEnabled(!!subscription.autoIncludeAllEnabled);
        setUserAgentEnabled(!!subscription.userAgentEnabled);
        setUserAgentValues((subscription.userAgentValues || '').split(',').filter(Boolean));

        // clientEmails is comma-separated emails
        const refEmails = new Set((subscription.clientEmails || '').split(',').map((s: string) => s.trim()).filter(Boolean));
        const flat = flatClientList(data);
        setSelectedClients(flat.filter((fi) => refEmails.has(fi.label)));
      } else {
        resetForm();
        // Check for preselection
        const preselect = (window as any).__subPreselectIds;
        if (preselect && Array.isArray(preselect) && preselect.length > 0) {
          const preselectEmails = new Set<string>();
          const inboundEmailMap = new Map<number, Set<string>>();
          for (const ib of data) {
            const emails = new Set<string>();
            for (const c of (ib.clients || [])) {
              emails.add(c.email);
            }
            inboundEmailMap.set(ib.key, emails);
          }
          for (const item of preselect) {
            if (typeof item === 'number') {
              const emails = inboundEmailMap.get(item);
              if (emails) for (const e of emails) preselectEmails.add(e);
            } else if (typeof item === 'string') {
              if (item.includes('@')) {
                preselectEmails.add(item);
              } else {
                // Legacy "inboundId:clientId" — look up email
                const [ibKeyStr] = item.split(':');
                const ibKey = Number(ibKeyStr);
                const emails = inboundEmailMap.get(ibKey);
                if (emails) for (const e of emails) preselectEmails.add(e);
              }
            }
          }
          const flat = flatClientList(data);
          setSelectedClients(flat.filter((fi) => preselectEmails.has(fi.label)));
          (window as any).__subPreselectIds = null;
        } else {
          if (preselect && Array.isArray(preselect)) {
            (window as any).__subPreselectIds = null;
          }
          setSelectedClients([]);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-include watch
  useEffect(() => {
    if (autoIncludeAllEnabled) syncClientsWithAutoInclude();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoIncludeAllEnabled]);

  useEffect(() => {
    if (syncWithInboundOrder) { sortByInboundOrder(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncWithInboundOrder]);

  const addItem = useCallback((item: FlatClientItem) => {
    if (autoIncludeAllEnabled) return;
    setSelectedClients((prev) => {
      if (prev.find((i) => i.key === item.key)) return prev;
      return [...prev, { ...item }];
    });
  }, [autoIncludeAllEnabled]);

  const removeItem = useCallback((index: number) => {
    setSelectedClients((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  }, []);

  const addAll = useCallback(() => {
    const flat = flatClientList(allInbounds);
    const currentKeys = new Set(selectedClients.map((i) => i.key));
    const toAdd = flat.filter((fi) => !currentKeys.has(fi.key));
    if (toAdd.length === 0) return;
    setSelectedClients((prev) => [...prev, ...toAdd]);
  }, [allInbounds, selectedClients]);

  const removeAll = useCallback(() => { setSelectedClients([]); }, []);

  const moveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setSelectedClients((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((index: number) => {
    setSelectedClients((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const onSubmit = useCallback(async () => {
    if (!autoIncludeAllEnabled && selectedClients.length === 0) {
      setActiveTabKey('clients');
      message.warning(t('clients.subSelectHint'));
      return;
    }
    if (userAgentEnabled && userAgentValues.length === 0) {
      message.warning(t('subUaValuesRequired'));
      return;
    }
    setSubmitting(true);
    try {
      let emails: string[];
      if (autoIncludeAllEnabled) {
        emails = [];
      } else if (syncWithInboundOrder) {
        const ibMsg = await HttpUtil.get('/panel/api/inbounds/list') as { success?: boolean; obj?: any[] };
        if (ibMsg?.success && Array.isArray(ibMsg.obj)) {
          const orderMap = new Map<number, number>();
          ibMsg.obj.forEach((ib: any, idx: number) => orderMap.set(ib.id, idx));
          const sorted = [...selectedClients].sort((a, b) => {
            const minA = Math.min(...a.inboundKeys.map((k) => orderMap.get(k) ?? 999999));
            const minB = Math.min(...b.inboundKeys.map((k) => orderMap.get(k) ?? 999999));
            if (minA !== minB) return minA - minB;
            return a.label.localeCompare(b.label);
          });
          emails = sorted.map((item) => item.label);
        } else {
          emails = selectedClients.map((item) => item.label);
        }
      } else {
        emails = selectedClients.map((item) => item.label);
      }
      const payload: Record<string, unknown> = {
        subId: subId || undefined,
        remark, enable, format,
        password,
        expiryTime: expiryEnabled ? Number(expiryTime) : 0,
        showInfo, emailInRemark,
        title, supportUrl, profileUrl, announce,
        updateInterval,
        syncWithInboundOrder,
        autoIncludeAllEnabled,
        userAgentEnabled,
        userAgentValues: userAgentValues.join(','),
        clientEmails: emails.join(','),
      };
      const msg = await save(payload);
      if (msg?.success) onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedClients, userAgentEnabled, userAgentValues, subId,
    remark, enable, format, password, expiryEnabled, expiryTime,
    showInfo, emailInRemark, title, supportUrl, profileUrl, announce,
    updateInterval, syncWithInboundOrder, autoIncludeAllEnabled,
    save, onOpenChange, t,
  ]);

  const onExpiryToggle = useCallback((v: boolean) => {
    setExpiryEnabled(v);
    if (v) {
      const now = dayjs();
      setExpiryDate(now);
      setExpiryTime(now.valueOf());
    } else {
      setExpiryDate(null);
      setExpiryTime(0);
    }
  }, []);

  const tabItems = [
    {
      key: 'general',
      label: t('subGeneral'),
      children: (
        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={t('subTitle')}>
                <Input value={title} placeholder={t('subTitlePlaceholder')} onChange={(e) => setTitle(e.target.value)} />
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{t('subTitleHint')}</div>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('subRemark')}>
                <Input value={remark} placeholder={t('subRemarkPlaceholder')} onChange={(e) => setRemark(e.target.value)} />
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{t('subRemarkHint')}</div>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={t('subId')}>
                <Input value={subId} placeholder={t('subIdPlaceholder')} onChange={(e) => setSubId(e.target.value)} />
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{subLinkHint}</div>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('subEnable')}>
                <Switch checked={enable} onChange={(v) => setEnable(v)} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={t('subFormatLabel')}>
                <Radio.Group value={format} onChange={(e) => setFormat(e.target.value)} optionType="button" buttonStyle="solid">
                  <Radio.Button value="text">{t('subFormatText')}</Radio.Button>
                  <Radio.Button value="base64">{t('subFormatBase64')}</Radio.Button>
                  <Radio.Button value="json">{t('subFormatJson')}</Radio.Button>
                  <Radio.Button value="clash">{t('subFormatClash')}</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('subUpdateInterval')}>
                <InputNumber value={updateInterval} min={1} style={{ width: 80 }} onChange={(v) => setUpdateInterval(v ?? 12)} />
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{t('subUpdateIntervalHint')}</div>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item label={t('subPasswordLabel')}>
                <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <Input.Password value={password} placeholder={t('subPasswordPlaceholder')} style={{ flex: 1 }} onChange={(e) => setPassword(e.target.value)} />
                  <Button onClick={() => setPassword(generatePassword())}>{t('subRandom')}</Button>
                </div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{t('subPasswordHint')}</div>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('subExpiryLabel')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}>
                  <Switch checked={expiryEnabled} onChange={onExpiryToggle} />
                  {!expiryEnabled ? (
                    <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{t('subNeverExpire')}</span>
                  ) : (
                    <DateTimePicker
                      value={expiryDate}
                      onChange={(d) => {
                        setExpiryDate(d);
                        if (d) setExpiryTime(d.valueOf());
                        else setExpiryTime(0);
                      }}
                    />
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{t('subExpiryHint')}</div>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item label={t('subUaFilter')}>
                <Switch checked={userAgentEnabled} onChange={(v) => setUserAgentEnabled(v)} />
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{t('subUaFilterHint')}</div>
              </Form.Item>
            </Col>
            <Col span={12}>
              {userAgentEnabled && (
                <Form.Item
                  label={t('subUaValues')}
                  validateStatus={userAgentEnabled && userAgentValues.length === 0 ? 'error' : ''}
                  help={userAgentEnabled && userAgentValues.length === 0 ? t('subUaValuesRequired') : ''}
                >
                  <Select
                    mode="tags"
                    value={userAgentValues}
                    placeholder={t('subUaValuesRequired')}
                    style={{ width: '100%' }}
                    onChange={(v) => setUserAgentValues(v)}
                  />
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{t('subUaValuesHint')}</div>
                </Form.Item>
              )}
            </Col>
          </Row>
        </Form>
      ),
    },
    {
      key: 'clients',
      label: t('subSelectClients'),
      children: (
        <div>
          <Form layout="vertical">
            <Row gutter={16} style={{ marginBottom: 12 }}>
              <Col xs={24} sm={12}>
                <Form.Item label={t('subAutoIncludeAll')}>
                  <Switch checked={autoIncludeAllEnabled} onChange={(v) => setAutoIncludeAllEnabled(v)} />
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{t('subAutoIncludeHint')}</div>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label={t('subSyncOrder')}>
                  <Switch checked={syncWithInboundOrder} onChange={(v) => setSyncWithInboundOrder(v)} />
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{t('subSyncOrderHint')}</div>
                </Form.Item>
              </Col>
            </Row>
          </Form>
          <div style={{ textAlign: 'center', margin: '4px 0 2px' }}>
            <span style={{ fontSize: 12, color: '#999' }}>{t('subDisabledClientHint')}</span>
          </div>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <div style={{ border: '1px solid #e8e8e8', borderRadius: 4, padding: 8, minHeight: 240, maxHeight: 380, display: 'flex', flexDirection: 'column' }}>
                <Input value={searchQuery} placeholder={t('subSearchPlaceholder')} style={{ marginBottom: 8 }} onChange={(e) => setSearchQuery(e.target.value)} />
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {filteredAvailable.map((item) => (
                    <div
                      key={item.key}
                      onClick={() => addItem(item)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 8px', borderRadius: 3, marginBottom: 2,
                        cursor: autoIncludeAllEnabled ? 'not-allowed' : 'pointer',
                        fontSize: 13, opacity: autoIncludeAllEnabled ? 0.5 : (item.active ? 1 : 0.75),
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <span style={{
                          fontWeight: 500, fontSize: 13,
                          color: item.active ? themeColors.clientNameActive : themeColors.clientNameInactive,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {item.label}
                        </span>
                        <span style={{ fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.inboundKeys.length} {t('subInbounds')}
                        </span>
                      </div>
                      {!autoIncludeAllEnabled && (
                        <span style={{ marginLeft: 'auto', color: item.active ? '#1890ff' : '#ff4d4f', fontWeight: 'bold', fontSize: 16 }}>+</span>
                      )}
                    </div>
                  ))}
                  {filteredAvailable.length === 0 && (
                    <div style={{ color: '#bbb', textAlign: 'center', padding: '40px 0', fontSize: 13 }}>{t('subNoAvailable')}</div>
                  )}
                </div>
                <Button
                  size="small"
                  type="dashed"
                  onClick={addAll}
                  disabled={filteredAvailable.length === 0 || autoIncludeAllEnabled}
                  style={{ marginTop: 4 }}
                >
                  {t('subAddAll')}
                </Button>
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ border: `1px solid ${themeColors.containerBorder}`, borderRadius: 4, padding: 8, minHeight: 240, maxHeight: 380, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ fontWeight: 500 }}>{t('subSelected')} {selectedClients.length} {t('subItems')}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {!syncWithInboundOrder && (
                      <Button size="small" onClick={sortByInboundOrder} disabled={selectedClients.length < 2}>
                        {t('subSortByOrder')}
                      </Button>
                    )}
                    <Button size="small" danger onClick={removeAll} disabled={selectedClients.length === 0 || autoIncludeAllEnabled}>
                      {t('subClearAll')}
                    </Button>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }} ref={selectedListRef}>
                  {selectedClients.map((item, index) => (
                    <div
                      key={item.key}
                      data-client-key={item.key}
                      onPointerDown={(e) => handlePointerDown(e, index)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 8px', borderRadius: 3, marginBottom: 2,
                        border: index === draggedIdx ? '2px dashed #1890ff' : `1px solid ${themeColors.rowBorder}`,
                        background: index === draggedIdx ? themeColors.dragHighlight : themeColors.rowBg,
                        fontSize: 13,
                        opacity: item.active ? 1 : 0.75,
                      }}
                    >
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 20, height: 20, borderRadius: '50%',
                        background: item.active ? '#1890ff' : '#ff4d4f', color: '#fff',
                        fontSize: 11, fontWeight: 600, flexShrink: 0,
                      }}>
                        {index + 1}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <span style={{
                          fontWeight: 500, fontSize: 13,
                          color: item.active ? themeColors.clientNameActive : themeColors.clientNameInactive,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {item.label}
                        </span>
                        <span style={{ fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.inboundKeys.length} {t('subInbounds')}
                        </span>
                      </div>
                      {!syncWithInboundOrder && (
                        <span style={{ cursor: 'grab', color: '#bbb', fontSize: 14, marginLeft: 'auto', userSelect: 'none', touchAction: 'none' }}>⠿</span>
                      )}
                      {!syncWithInboundOrder && (
                        <Button size="small" disabled={index === 0} onClick={() => moveUp(index)} icon={<CaretUpOutlined />} />
                      )}
                      {!syncWithInboundOrder && (
                        <Button size="small" disabled={index === selectedClients.length - 1} onClick={() => moveDown(index)} icon={<CaretDownOutlined />} />
                      )}
                      {!autoIncludeAllEnabled && (
                        <Button size="small" danger type="link" onClick={() => removeItem(index)}>✕</Button>
                      )}
                    </div>
                  ))}
                  {selectedClients.length === 0 && (
                    <div style={{ color: '#bbb', textAlign: 'center', padding: '40px 0', fontSize: 13 }}>{t('clients.subSelectHint')}</div>
                  )}
                </div>
              </div>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: 'info',
      label: t('subInfo'),
      children: (
        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={t('subShowInfo')}>
                <Switch checked={showInfo} onChange={(v) => setShowInfo(v)} />
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{t('subShowInfoHint')}</div>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('subEmailInRemark')}>
                <Switch checked={emailInRemark} onChange={(v) => setEmailInRemark(v)} />
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{t('subEmailInRemarkHint')}</div>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={t('subSupportUrl')}>
                <Input value={supportUrl} placeholder={t('subUrlPlaceholder')} onChange={(e) => setSupportUrl(e.target.value)} />
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{t('subSupportUrlHint')}</div>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('subProfileUrl')}>
                <Input value={profileUrl} placeholder={t('subUrlPlaceholder')} onChange={(e) => setProfileUrl(e.target.value)} />
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{t('subProfileUrlHint')}</div>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label={t('subAnnounce')}>
            <Input.TextArea value={announce} rows={3} placeholder={t('subAnnouncePlaceholder')} onChange={(e) => setAnnounce(e.target.value)} />
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      title={mode === 'edit' ? t('subEditTitle') : t('subCreateTitle')}
      confirmLoading={submitting}
      okText={t('subSave')}
      cancelText={t('subCancel')}
      maskClosable={false}
      width={820}
      onOk={onSubmit}
      onCancel={() => { if (!submitting) onOpenChange(false); }}
      destroyOnHidden
    >
      <Tabs activeKey={activeTabKey} onChange={(k) => setActiveTabKey(k)} items={tabItems} />
    </Modal>
  );
}
