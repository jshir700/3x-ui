import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Switch,
  Tag,
  Tooltip,
} from 'antd';
import {
  SyncOutlined,
  RetweetOutlined,
  DeleteOutlined,
} from '@ant-design/icons';

import DateTimePicker from '@/components/DateTimePicker';
import { HttpUtil, RandomUtil, SizeFormatter, ColorUtils } from '@/utils';
import { Inbound } from '@/models/inbound.js';
import { Protocols, USERS_SECURITY, TLS_FLOW_CONTROL } from '@/schemas/primitives';
import type { Dayjs } from 'dayjs';

const SECURITY_OPTIONS = Object.values(USERS_SECURITY) as string[];
const FLOW_OPTIONS = Object.values(TLS_FLOW_CONTROL) as string[];

interface ClientFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  dbInbound: any;
  clientIndex?: number | null;
  subEnable?: boolean;
  tgBotEnable?: boolean;
  ipLimitEnable?: boolean;
  trafficDiff?: number;
  onSaved: () => void;
}

function getClientId(proto: string, c: any): string {
  switch (proto) {
    case Protocols.TROJAN: return c.password;
    case Protocols.SHADOWSOCKS: return c.email;
    case Protocols.HYSTERIA: return c.auth;
    default: return c.id;
  }
}

function makeNewClient(proto: string, parsed: any): any {
  switch (proto) {
    case Protocols.VMESS: return new Inbound.VmessSettings.VMESS();
    case Protocols.VLESS: return new Inbound.VLESSSettings.VLESS();
    case Protocols.TROJAN: return new Inbound.TrojanSettings.Trojan();
    case Protocols.SHADOWSOCKS: {
      const method = parsed.settings.method;
      return new Inbound.ShadowsocksSettings.Shadowsocks(method, RandomUtil.randomShadowsocksPassword(method));
    }
    case Protocols.HYSTERIA: return new Inbound.HysteriaSettings.Hysteria();
    default: return null;
  }
}

export default function ClientFormModal({
  open,
  onClose,
  mode,
  dbInbound,
  clientIndex,
  subEnable = false,
  tgBotEnable = false,
  ipLimitEnable = false,
  trafficDiff = 0,
  onSaved,
}: ClientFormModalProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [inbound, setInbound] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [oldClientId, setOldClientId] = useState('');
  const [clientStats, setClientStats] = useState<any>(null);
  const [delayedStart, setDelayedStart] = useState(false);
  const [clientIpsText, setClientIpsText] = useState('');
  const [allSubscriptions, setAllSubscriptions] = useState<any[]>([]);
  const [subscriptionIds, setSubscriptionIds] = useState<number[]>([]);
  const initializedRef = useRef(false);

  const protocol = inbound?.protocol;
  const isVmessOrVless = protocol === Protocols.VMESS || protocol === Protocols.VLESS;
  const isTrojanOrSS = protocol === Protocols.TROJAN || protocol === Protocols.SHADOWSOCKS;

  useEffect(() => {
    if (!open || !dbInbound) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    const parsed = Inbound.fromJson(dbInbound.toInbound().toJson());
    setInbound(parsed);

    if (mode === 'edit') {
      const idx = clientIndex ?? 0;
      const c = parsed.clients[idx];
      setClient(c ? { ...c } : null);
      if (c && c.expiryTime < 0) setDelayedStart(true);
      setOldClientId(c ? getClientId(parsed.protocol, c) : '');
    } else {
      const c = makeNewClient(parsed.protocol, parsed);
      if (c) parsed.clients.push(c);
      setClient(parsed.clients[parsed.clients.length - 1]);
      setOldClientId('');
    }

    const stats = (dbInbound.clientStats || []).find(
      (s: any) => s.email === (mode === 'edit' ? parsed.clients[clientIndex ?? 0]?.email : c?.email),
    ) || null;
    setClientStats(stats);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) initializedRef.current = false;
  }, [open]);

  // Fetch subscriptions for dropdown
  useEffect(() => {
    if (!open) return;
    (async () => {
      const msg = await HttpUtil.get('/panel/api/subscription/list') as { success?: boolean; obj?: any[] };
      if (msg?.success && Array.isArray(msg.obj)) setAllSubscriptions(msg.obj);
    })();
  }, [open]);

  // Load existing subscriptionIds when editing
  useEffect(() => {
    if (!open || mode !== 'edit' || !client?.email || allSubscriptions.length === 0) return;
    (async () => {
      const msg = await HttpUtil.get(
        `/panel/api/inbounds/checkClientSubscriptions?email=${encodeURIComponent(client.email)}`,
      ) as { success?: boolean; obj?: { affected: { id: number }[]; toBeDeleted: { id: number }[] } };
      if (msg?.success && msg.obj) {
        const ids = new Set<number>();
        for (const s of (msg.obj.affected || [])) ids.add(s.id);
        for (const s of (msg.obj.toBeDeleted || [])) ids.add(s.id);
        setSubscriptionIds([...ids]);
      }
    })();
  }, [open, mode, client?.email, allSubscriptions.length]);

  const NOW = useMemo(() => Date.now(), []);

  const subscriptionOptions = useMemo(
    () => (allSubscriptions || []).map((s: any) => {
      let tag = '';
      if (!s.enable) tag = t('disabled');
      else if (s.expiryTime && s.expiryTime > 0 && NOW > s.expiryTime) tag = t('expired');
      const label = `${s.remark || s.subId} (${s.subId})${tag ? ` (${tag})` : ''}`;
      return { label, value: s.id };
    }),
    [allSubscriptions, t, NOW],
  );

  const handleClose = useCallback(() => {
    setClient(null);
    setInbound(null);
    setClientIpsText('');
    setSubscriptionIds([]);
    onClose();
  }, [onClose]);

  const randomEmail = useCallback(() => {
    setClient((prev: any) => prev ? { ...prev, email: RandomUtil.randomLowerAndNum(9) } : prev);
  }, []);

  const randomId = useCallback(() => {
    setClient((prev: any) => prev ? { ...prev, id: RandomUtil.randomUUID() } : prev);
  }, []);

  const randomPassword = useCallback(() => {
    if (!client || !inbound) return;
    if (inbound.protocol === Protocols.SHADOWSOCKS) {
      setClient({ ...client, password: RandomUtil.randomShadowsocksPassword(inbound.settings.method) });
    } else {
      setClient({ ...client, password: RandomUtil.randomSeq(10) });
    }
  }, [client, inbound]);

  const randomAuth = useCallback(() => {
    setClient((prev: any) => prev ? { ...prev, auth: RandomUtil.randomSeq(10) } : prev);
  }, []);

  const randomSubId = useCallback(() => {
    setClient((prev: any) => prev ? { ...prev, subId: RandomUtil.randomLowerAndNum(16) } : prev);
  }, []);

  const subIdWeak = useMemo(() => {
    const v = client?.subId;
    if (!v) return false;
    return v.length < 8;
  }, [client?.subId]);

  const isExpired = useMemo(() => {
    if (mode !== 'edit' || !client) return false;
    return client.expiryTime > 0 && client.expiryTime < Date.now();
  }, [mode, client]);

  const isTrafficExhausted = useMemo(() => {
    if (!clientStats || clientStats.total <= 0) return false;
    return clientStats.up + clientStats.down >= clientStats.total;
  }, [clientStats]);

  const totalGB = useMemo(() => {
    if (!client?.totalGB) return 0;
    return Math.round((client.totalGB / SizeFormatter.ONE_GB) * 100) / 100;
  }, [client?.totalGB]);

  const setTotalGB = useCallback((gb: number | null) => {
    setClient((prev: any) => prev ? { ...prev, totalGB: Math.round((gb || 0) * SizeFormatter.ONE_GB) } : prev);
  }, []);

  const expiryDate: Dayjs | null = useMemo(() => {
    return client?.expiryTime > 0 ? dayjs(client.expiryTime) : null;
  }, [client?.expiryTime]);

  const setExpiryDate = useCallback((next: Dayjs | null) => {
    setClient((prev: any) => prev ? { ...prev, expiryTime: next ? next.valueOf() : 0 } : prev);
  }, []);

  const delayedExpireDays = useMemo(() => {
    if (!client || client.expiryTime >= 0) return 0;
    return client.expiryTime / -86400000;
  }, [client]);

  const setDelayedExpireDays = useCallback((days: number | null) => {
    setClient((prev: any) => prev ? { ...prev, expiryTime: -86400000 * (days || 0) } : prev);
  }, []);

  const loadClientIps = useCallback(async () => {
    if (!client?.email) return;
    const msg = await HttpUtil.post(`/panel/api/inbounds/clientIps/${client.email}`);
    let ips = msg?.obj;
    if (typeof ips === 'string' && ips.startsWith('[') && ips.endsWith(']')) {
      try {
        const parsed = JSON.parse(ips) as string[];
        ips = Array.isArray(parsed) ? parsed.join('\n') : ips;
      } catch { /* leave raw */ }
    }
    setClientIpsText(ips || '');
  }, [client?.email]);

  const clearClientIps = useCallback(async () => {
    if (!client?.email) return;
    const msg = await HttpUtil.post(`/panel/api/inbounds/clearClientIps/${client.email}`);
    if (msg?.success) setClientIpsText('');
  }, [client?.email]);

  const resetClientTraffic = useCallback(async () => {
    if (!clientStats || !client?.email) return;
    const msg = await HttpUtil.post(
      `/panel/api/inbounds/${dbInbound.id}/resetClientTraffic/${client.email}`,
    );
    if (msg?.success) {
      setClientStats((prev: any) => prev ? { ...prev, up: 0, down: 0 } : prev);
      message.success(t('pages.inbounds.resetTrafficSuccess'));
    }
  }, [clientStats, client?.email, dbInbound?.id, t]);

  const submit = useCallback(async () => {
    if (!client || !inbound) return;
    setSaving(true);
    try {
      const payload = {
        id: dbInbound.id,
        settings: `{"clients": [${client.toString(false)}]}`,
      };
      const url = mode === 'edit'
        ? `/panel/api/inbounds/updateClient/${oldClientId}`
        : '/panel/api/inbounds/addClient';
      const msg = await HttpUtil.post(url, payload);
      if (msg?.success) {
        // Sync subscription associations
        if (client.email) {
          await HttpUtil.post(`/panel/api/clients/update/${encodeURIComponent(client.email)}`, {
            subscriptionIds: subscriptionIds || [],
          });
        }
        onSaved();
        handleClose();
      }
    } finally {
      setSaving(false);
    }
  }, [client, inbound, dbInbound, mode, oldClientId, subscriptionIds, onSaved, handleClose]);

  const title = mode === 'edit' ? t('pages.client.edit') : t('pages.client.add');

  return (
    <Modal
      open={open}
      title={title}
      okText={mode === 'edit' ? t('pages.client.submitEdit') : t('pages.client.submitAdd')}
      cancelText={t('close')}
      confirmLoading={saving}
      maskClosable={false}
      onOk={submit}
      onCancel={handleClose}
      destroyOnHidden
    >
      {mode === 'edit' && (isExpired || isTrafficExhausted) && (
        <Tag color="red" style={{ display: 'block', marginBottom: 10, textAlign: 'center' }}>
          {t('depleted')}
        </Tag>
      )}

      {client && inbound && (
        <Form layout="horizontal" colon={false} labelCol={{ sm: { span: 8 } }} wrapperCol={{ sm: { span: 14 } }}>
          <Form.Item label={t('enable')}>
            <Switch checked={client.enable} onChange={(v) => setClient({ ...client, enable: v })} />
          </Form.Item>

          <Form.Item label={<>{t('pages.inbounds.email')} <SyncOutlined style={{ marginLeft: 4, cursor: 'pointer', color: '#1890ff' }} onClick={randomEmail} /></>}>
            <Input value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} />
          </Form.Item>

          {isTrojanOrSS && (
            <Form.Item label={<>{t('password')} <SyncOutlined style={{ marginLeft: 4, cursor: 'pointer', color: '#1890ff' }} onClick={randomPassword} /></>}>
              <Input value={client.password} onChange={(e) => setClient({ ...client, password: e.target.value })} />
            </Form.Item>
          )}

          {protocol === Protocols.HYSTERIA && (
            <Form.Item label={<>{t('password')} <SyncOutlined style={{ marginLeft: 4, cursor: 'pointer', color: '#1890ff' }} onClick={randomAuth} /></>}>
              <Input value={client.auth} onChange={(e) => setClient({ ...client, auth: e.target.value })} />
            </Form.Item>
          )}

          {isVmessOrVless && (
            <Form.Item label={<>ID <SyncOutlined style={{ marginLeft: 4, cursor: 'pointer', color: '#1890ff' }} onClick={randomId} /></>}>
              <Input value={client.id} onChange={(e) => setClient({ ...client, id: e.target.value })} />
            </Form.Item>
          )}

          {protocol === Protocols.VMESS && (
            <Form.Item label={t('security')}>
              <Select value={client.security} onChange={(v) => setClient({ ...client, security: v })} options={SECURITY_OPTIONS.map((k) => ({ value: k, label: k }))} />
            </Form.Item>
          )}

          {client.email && subEnable && (
            <Form.Item label={<>{t('subscription.title')} <SyncOutlined style={{ marginLeft: 4, cursor: 'pointer', color: '#1890ff' }} onClick={randomSubId} /></>}>
              <Input value={client.subId} status={subIdWeak ? 'warning' : undefined} onChange={(e) => setClient({ ...client, subId: e.target.value })} />
              {subIdWeak && (
                <div style={{ color: '#faad14', fontSize: 12, marginTop: 4 }}>
                  {t('subIdTooShort', 'Subscription ID is too short and may be guessable')}
                </div>
              )}
            </Form.Item>
          )}

          {client.email && tgBotEnable && (
            <Form.Item label="Telegram ID">
              <InputNumber value={client.tgId} min={0} style={{ width: '50%' }} onChange={(v) => setClient({ ...client, tgId: v })} />
            </Form.Item>
          )}

          {client.email && (
            <Form.Item label={t('comment')}>
              <Input value={client.comment} onChange={(e) => setClient({ ...client, comment: e.target.value })} />
            </Form.Item>
          )}

          {ipLimitEnable && (
            <Form.Item label={t('pages.inbounds.IPLimit')}>
              <InputNumber value={client.limitIp} min={0} onChange={(v) => setClient({ ...client, limitIp: v })} />
            </Form.Item>
          )}

          {ipLimitEnable && client.limitIp > 0 && client.email && mode === 'edit' && (
            <Form.Item label={t('pages.inbounds.IPLimitlog')}>
              <Input.TextArea value={clientIpsText} readOnly placeholder={t('pages.inbounds.IPLimitlogDesc')} autoSize={{ minRows: 3, maxRows: 8 }} onClick={loadClientIps} />
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={clearClientIps}>
                {t('pages.inbounds.IPLimitlogclear')}
              </Button>
            </Form.Item>
          )}

          {inbound.canEnableTlsFlow?.() && (
            <Form.Item label="Flow">
              <Select value={client.flow || ''} onChange={(v) => setClient({ ...client, flow: v })} options={[{ value: '', label: t('none') }, ...FLOW_OPTIONS.map((k) => ({ value: k, label: k }))]} />
            </Form.Item>
          )}

          {protocol === Protocols.VLESS && (
            <Form.Item label="Reverse tag">
              <Input value={client.reverseTag || ''} placeholder="Optional reverse tag" onChange={(e) => setClient({ ...client, reverseTag: e.target.value })} />
            </Form.Item>
          )}

          <Form.Item label={t('subscription.title')}>
            <Select
              mode="multiple"
              value={subscriptionIds}
              onChange={(v) => setSubscriptionIds(v)}
              options={subscriptionOptions}
              showSearch
              placeholder={t('clients.subSelectHint')}
              filterOption={(input, option) => ((option?.label as string) || '').toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>

          <Form.Item label={<Tooltip title={t('pages.inbounds.meansNoLimit')}>{t('pages.inbounds.totalFlow')}</Tooltip>}>
            <InputNumber value={totalGB} min={0} step={0.1} onChange={setTotalGB} />
          </Form.Item>

          {mode === 'edit' && clientStats && (
            <Form.Item label={t('usage')}>
              <Tag color={ColorUtils.clientUsageColor(clientStats, trafficDiff)}>
                {SizeFormatter.sizeFormat(clientStats.up)} / {SizeFormatter.sizeFormat(clientStats.down)} ({SizeFormatter.sizeFormat(clientStats.up + clientStats.down)})
              </Tag>
              {client.email && (
                <Tooltip title={t('pages.inbounds.resetTraffic')}>
                  <RetweetOutlined style={{ marginLeft: 4, cursor: 'pointer', color: '#1890ff' }} onClick={resetClientTraffic} />
                </Tooltip>
              )}
            </Form.Item>
          )}

          <Form.Item label={t('pages.client.delayedStart')}>
            <Switch checked={delayedStart} onChange={(v) => { setDelayedStart(v); if (v) setClient({ ...client, expiryTime: 0 }); }} />
          </Form.Item>

          {delayedStart ? (
            <Form.Item label={t('pages.client.expireDays')}>
              <InputNumber value={delayedExpireDays} min={0} onChange={setDelayedExpireDays} />
            </Form.Item>
          ) : (
            <Form.Item label={<Tooltip title={t('pages.inbounds.leaveBlankToNeverExpire')}>{t('pages.inbounds.expireDate')}</Tooltip>}>
              <DateTimePicker value={expiryDate} onChange={setExpiryDate} showTime style={{ width: '100%' }} />
              {mode === 'edit' && isExpired && <Tag color="red" style={{ marginTop: 4 }}>{t('depleted')}</Tag>}
            </Form.Item>
          )}

          {client.expiryTime !== 0 && (
            <Form.Item label={<Tooltip title={t('pages.client.renewDesc')}>{t('pages.client.renew')}</Tooltip>}>
              <InputNumber value={client.reset} min={0} onChange={(v) => setClient({ ...client, reset: v })} />
            </Form.Item>
          )}
        </Form>
      )}
    </Modal>
  );
}
