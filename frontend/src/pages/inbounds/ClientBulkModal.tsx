import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
  Tooltip,
} from 'antd';
import { SyncOutlined } from '@ant-design/icons';

import DateTimePicker from '@/components/DateTimePicker';
import { HttpUtil, RandomUtil, SizeFormatter } from '@/utils';
import { Inbound } from '@/models/inbound.js';
import { Protocols, USERS_SECURITY, TLS_FLOW_CONTROL } from '@/schemas/primitives';
import type { Dayjs } from 'dayjs';

const SECURITY_OPTIONS = Object.values(USERS_SECURITY) as string[];
const FLOW_OPTIONS = Object.values(TLS_FLOW_CONTROL) as string[];

interface ClientBulkModalProps {
  open: boolean;
  onClose: () => void;
  dbInbound: any;
  subEnable?: boolean;
  tgBotEnable?: boolean;
  ipLimitEnable?: boolean;
  onSaved: () => void;
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

export default function ClientBulkModal({
  open,
  onClose,
  dbInbound,
  subEnable = false,
  tgBotEnable = false,
  ipLimitEnable = false,
  onSaved,
}: ClientBulkModalProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [inbound, setInbound] = useState<any>(null);
  const [delayedStart, setDelayedStart] = useState(false);
  const initializedRef = useRef(false);

  const [emailMethod, setEmailMethod] = useState(0);
  const [firstNum, setFirstNum] = useState(1);
  const [lastNum, setLastNum] = useState(1);
  const [emailPrefix, setEmailPrefix] = useState('');
  const [emailPostfix, setEmailPostfix] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [security, setSecurity] = useState(USERS_SECURITY.AUTO);
  const [flow, setFlow] = useState(TLS_FLOW_CONTROL.VISION);
  const [subId, setSubId] = useState('');
  const [tgId, setTgId] = useState(0);
  const [comment, setComment] = useState('');
  const [limitIp, setLimitIp] = useState(0);
  const [totalGB, setTotalGB] = useState(0);
  const [expiryTime, setExpiryTime] = useState(0);
  const [reset, setReset] = useState(0);

  const protocol = inbound?.protocol;
  const isVMess = protocol === Protocols.VMESS;

  const resetForm = useCallback(() => {
    setEmailMethod(0);
    setFirstNum(1);
    setLastNum(1);
    setEmailPrefix('');
    setEmailPostfix('');
    setQuantity(1);
    setSecurity(USERS_SECURITY.AUTO);
    setFlow('');
    setSubId('');
    setTgId(0);
    setComment('');
    setLimitIp(0);
    setTotalGB(0);
    setExpiryTime(0);
    setReset(0);
    setDelayedStart(false);
  }, []);

  useEffect(() => {
    if (!open || !dbInbound) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    const parsed = Inbound.fromJson(dbInbound.toInbound().toJson());
    setInbound(parsed);
    resetForm();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) initializedRef.current = false;
  }, [open]);

  const handleClose = useCallback(() => {
    setInbound(null);
    onClose();
  }, [onClose]);

  const totalGBDisplay = useMemo(() => {
    if (!totalGB) return 0;
    return Math.round((totalGB / SizeFormatter.ONE_GB) * 100) / 100;
  }, [totalGB]);

  const setTotalGBFromDisplay = useCallback((gb: number | null) => {
    setTotalGB(Math.round((gb || 0) * SizeFormatter.ONE_GB));
  }, []);

  const expiryDate: Dayjs | null = useMemo(() => {
    return expiryTime > 0 ? dayjs(expiryTime) : null;
  }, [expiryTime]);

  const setExpiryDate = useCallback((next: Dayjs | null) => {
    setExpiryTime(next ? next.valueOf() : 0);
  }, []);

  const delayedExpireDays = useMemo(() => {
    if (expiryTime >= 0) return 0;
    return expiryTime / -86400000;
  }, [expiryTime]);

  const setDelayedExpireDays = useCallback((days: number | null) => {
    setExpiryTime(-86400000 * (days || 0));
  }, []);

  const randomSubId = useCallback(() => {
    setSubId(RandomUtil.randomLowerAndNum(16));
  }, []);

  const buildClients = useCallback((): any[] => {
    if (!inbound) return [];
    const out: any[] = [];
    let start: number, end: number;
    if (emailMethod > 1) {
      start = firstNum;
      end = lastNum + 1;
    } else {
      start = 0;
      end = quantity;
    }
    const prefix = emailMethod > 0 && emailPrefix.length > 0 ? emailPrefix : '';
    const useNum = emailMethod > 1;
    const postfix = emailMethod > 2 && emailPostfix.length > 0 ? emailPostfix : '';

    for (let i = start; i < end; i++) {
      const c = makeNewClient(inbound.protocol, inbound);
      if (!c) continue;
      if (emailMethod === 4) c.email = '';
      c.email += useNum ? prefix + String(i) + postfix : prefix + postfix;

      if (subId.length > 0) c.subId = subId;
      c.tgId = tgId;
      if (comment.length > 0) c.comment = comment;
      c.security = security;
      c.limitIp = limitIp;
      c.totalGB = totalGB;
      c.expiryTime = expiryTime;
      if (inbound.canEnableTlsFlow?.()) c.flow = flow;
      c.reset = reset;
      out.push(c);
    }
    return out;
  }, [inbound, emailMethod, firstNum, lastNum, emailPrefix, emailPostfix, quantity, subId, tgId, comment, security, limitIp, totalGB, expiryTime, flow, reset]);

  const submit = useCallback(async () => {
    const clients = buildClients();
    if (clients.length === 0) return;

    setSaving(true);
    try {
      const payload = {
        id: dbInbound.id,
        settings: `{"clients": [${clients.map((c: any) => c.toString(false)).join(',')}]}`,
      };
      const msg = await HttpUtil.post('/panel/api/inbounds/addClient', payload);
      if (msg?.success) {
        onSaved();
        handleClose();
      }
    } finally {
      setSaving(false);
    }
  }, [buildClients, dbInbound?.id, onSaved, handleClose]);

  return (
    <Modal
      open={open}
      title={t('pages.client.bulk')}
      okText={t('create')}
      cancelText={t('close')}
      confirmLoading={saving}
      maskClosable={false}
      onOk={submit}
      onCancel={handleClose}
      destroyOnHidden
    >
      {inbound && (
        <Form layout="horizontal" colon={false} labelCol={{ sm: { span: 8 } }} wrapperCol={{ sm: { span: 14 } }}>
          <Form.Item label={t('pages.client.method')}>
            <Select value={emailMethod} onChange={(v) => setEmailMethod(v)}>
              <Select.Option value={0}>Random</Select.Option>
              <Select.Option value={1}>Random + Prefix</Select.Option>
              <Select.Option value={2}>Random + Prefix + Num</Select.Option>
              <Select.Option value={3}>Random + Prefix + Num + Postfix</Select.Option>
              <Select.Option value={4}>Prefix + Num + Postfix</Select.Option>
            </Select>
          </Form.Item>

          {emailMethod > 1 && (
            <Form.Item label={t('pages.client.first')}>
              <InputNumber value={firstNum} min={1} onChange={(v) => setFirstNum(v ?? 1)} />
            </Form.Item>
          )}
          {emailMethod > 1 && (
            <Form.Item label={t('pages.client.last')}>
              <InputNumber value={lastNum} min={firstNum} onChange={(v) => setLastNum(v ?? firstNum)} />
            </Form.Item>
          )}
          {emailMethod > 0 && (
            <Form.Item label={t('pages.client.prefix')}>
              <Input value={emailPrefix} onChange={(e) => setEmailPrefix(e.target.value)} />
            </Form.Item>
          )}
          {emailMethod > 2 && (
            <Form.Item label={t('pages.client.postfix')}>
              <Input value={emailPostfix} onChange={(e) => setEmailPostfix(e.target.value)} />
            </Form.Item>
          )}
          {emailMethod < 2 && (
            <Form.Item label={t('pages.client.clientCount')}>
              <InputNumber value={quantity} min={1} max={500} onChange={(v) => setQuantity(v ?? 1)} />
            </Form.Item>
          )}

          {isVMess && (
            <Form.Item label={t('security')}>
              <Select value={security} onChange={(v) => setSecurity(v)} options={SECURITY_OPTIONS.map((k) => ({ value: k, label: k }))} />
            </Form.Item>
          )}

          {inbound.canEnableTlsFlow?.() && (
            <Form.Item label="Flow">
              <Select value={flow} onChange={(v) => setFlow(v)} options={[{ value: '', label: t('none') }, ...FLOW_OPTIONS.map((k) => ({ value: k, label: k }))]} />
            </Form.Item>
          )}

          {subEnable && (
            <Form.Item label={<>{t('subscription.title')} <SyncOutlined style={{ marginLeft: 4, cursor: 'pointer', color: '#1890ff' }} onClick={randomSubId} /></>}>
              <Input value={subId} onChange={(e) => setSubId(e.target.value)} />
            </Form.Item>
          )}

          {tgBotEnable && (
            <Form.Item label="Telegram ID">
              <InputNumber value={tgId} min={0} style={{ width: '50%' }} onChange={(v) => setTgId(v ?? 0)} />
            </Form.Item>
          )}

          <Form.Item label={t('comment')}>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} />
          </Form.Item>

          {ipLimitEnable && (
            <Form.Item label={t('pages.inbounds.IPLimit')}>
              <InputNumber value={limitIp} min={0} onChange={(v) => setLimitIp(v ?? 0)} />
            </Form.Item>
          )}

          <Form.Item label={<Tooltip title={t('pages.inbounds.meansNoLimit')}>{t('pages.inbounds.totalFlow')}</Tooltip>}>
            <InputNumber value={totalGBDisplay} min={0} step={0.1} onChange={setTotalGBFromDisplay} />
          </Form.Item>

          <Form.Item label={t('pages.client.delayedStart')}>
            <Switch checked={delayedStart} onChange={(v) => { setDelayedStart(v); if (v) setExpiryTime(0); }} />
          </Form.Item>

          {delayedStart ? (
            <Form.Item label={t('pages.client.expireDays')}>
              <InputNumber value={delayedExpireDays} min={0} onChange={setDelayedExpireDays} />
            </Form.Item>
          ) : (
            <Form.Item label={<Tooltip title={t('pages.inbounds.leaveBlankToNeverExpire')}>{t('pages.inbounds.expireDate')}</Tooltip>}>
              <DateTimePicker value={expiryDate} onChange={setExpiryDate} showTime style={{ width: '100%' }} />
            </Form.Item>
          )}

          {expiryTime !== 0 && (
            <Form.Item label={<Tooltip title={t('pages.client.renewDesc')}>{t('pages.client.renew')}</Tooltip>}>
              <InputNumber value={reset} min={0} onChange={(v) => setReset(v ?? 0)} />
            </Form.Item>
          )}
        </Form>
      )}
    </Modal>
  );
}
