import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Spin,
  Switch,
  Tabs,
  message,
} from 'antd';
import type { NodeRecord } from '@/api/queries/useNodesQuery';
import { HttpUtil, LanguageManager } from '@/utils';
import './NodeFormModal.css';

type Mode = 'add' | 'edit';

interface ApiMsg<T = unknown> {
  success?: boolean;
  msg?: string;
  obj?: T;
}

interface RemoteSettings {
  tgLang?: string;
  timeLocation?: string;
  xrayAutoUpdate?: boolean;
  xrayUpdateCron?: string;
  tgBotEnable?: boolean;
  tgBotToken?: string;
  hasTgBotToken?: boolean;
  tgBotChatId?: string;
  tgRunTime?: string;
  tgBotBackup?: boolean;
  tgBotLoginNotify?: boolean;
  tgCpu?: number;
}

interface NodeFormModalProps {
  open: boolean;
  mode: Mode;
  node: NodeRecord | null;
  testConnection: (payload: Partial<NodeRecord>) => Promise<ApiMsg<{
    status: string;
    latencyMs?: number;
    xrayVersion?: string;
    error?: string;
  }>>;
  save: (payload: Partial<NodeRecord>) => Promise<ApiMsg>;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  id: number;
  name: string;
  remark: string;
  scheme: 'http' | 'https';
  address: string;
  port: number;
  basePath: string;
  apiToken: string;
  enable: boolean;
  allowPrivateAddress: boolean;
}

function defaultForm(): FormState {
  return {
    id: 0,
    name: '',
    remark: '',
    scheme: 'https',
    address: '',
    port: 2053,
    basePath: '/',
    apiToken: '',
    enable: true,
    allowPrivateAddress: false,
  };
}

// Timezone utilities
function getTimezones(): string[] {
  try {
    return (Intl as any).supportedValuesOf('timeZone');
  } catch {
    return [
      'UTC', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Singapore',
      'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
    ];
  }
}

function getTzOffsetMinutes(tz: string): number {
  try {
    const now = Date.now();
    const utcDate = new Date(new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).format(now));
    const tzDate = new Date(new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).format(now));
    return (tzDate.getTime() - utcDate.getTime()) / 60000;
  } catch {
    return 0;
  }
}

function formatTzOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const totalHours = Math.abs(minutes) / 60;
  if (totalHours % 1 === 0) return `${sign}${Math.floor(totalHours)}`;
  return `${sign}${totalHours.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`;
}

function getMachineTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'Asia/Shanghai';
  }
}

export default function NodeFormModal({
  open,
  mode,
  node,
  testConnection,
  save,
  onOpenChange,
}: NodeFormModalProps) {
  const { t } = useTranslation();
  const [messageApi, messageContextHolder] = message.useMessage();

  const [form, setForm] = useState<FormState>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: string;
    latencyMs?: number;
    xrayVersion?: string;
    error?: string;
  } | null>(null);

  // Remote settings state
  const [activeTabKey, setActiveTabKey] = useState('basic');
  const [remoteSettings, setRemoteSettings] = useState<RemoteSettings | null>(null);
  const [remoteSettingsLoading, setRemoteSettingsLoading] = useState(false);
  const [remoteSettingsError, setRemoteSettingsError] = useState('');

  const isEdit = mode === 'edit';

  useEffect(() => {
    if (!open) return;
    const base = defaultForm();
    const next: FormState = mode === 'edit' && node
      ? {
        ...base,
        ...(node as unknown as Partial<FormState>),
        id: node.id,
        scheme: (node.scheme as 'http' | 'https') || base.scheme,
      }
      : base;

    setForm(next);
    setTestResult(null);
    setActiveTabKey('basic');
    setRemoteSettingsError('');
    setRemoteSettings(null);

    // Fetch remote settings in edit mode
    if (mode === 'edit' && node?.id) {
      setRemoteSettingsLoading(true);
      (async () => {
        try {
          const msg = await HttpUtil.post(`/panel/api/nodes/fetchSettings/${node.id}`) as { success?: boolean; obj?: RemoteSettings; msg?: string };
          if (msg?.success && msg.obj) {
            setRemoteSettings(msg.obj);
          } else {
            setRemoteSettingsError(msg?.msg || 'Unknown error');
          }
        } catch (e: any) {
          setRemoteSettingsError(e.message || 'Connection error');
        } finally {
          setRemoteSettingsLoading(false);
        }
      })();
    }
  }, [open, mode, node]);

  const title = useMemo(
    () => (mode === 'edit' ? t('pages.nodes.editNode') : t('pages.nodes.addNode')),
    [mode, t],
  );

  // Timezone list computed once
  const tzList = useMemo(() => {
    const zones = getTimezones();
    return zones
      .map(z => {
        const offsetMin = getTzOffsetMinutes(z);
        return {
          label: `${z.replace(/_/g, ' ')} (UTC${formatTzOffset(offsetMin)})`,
          value: z,
          offsetMin,
        };
      })
      .sort((a, b) => a.offsetMin - b.offsetMin || a.value.localeCompare(b.value));
  }, []);

  function buildPayload(): Partial<NodeRecord> {
    return {
      id: form.id || 0,
      name: form.name?.trim() || '',
      remark: form.remark?.trim() || '',
      scheme: form.scheme || 'https',
      address: form.address?.trim() || '',
      port: Number(form.port) || 0,
      basePath: form.basePath?.trim() || '/',
      apiToken: form.apiToken?.trim() || '',
      enable: !!form.enable,
      allowPrivateAddress: !!form.allowPrivateAddress,
    };
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateRemote(key: keyof RemoteSettings, value: unknown) {
    setRemoteSettings((prev) => prev ? { ...prev, [key]: value } : null);
  }

  async function onTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const payload = buildPayload();
      if (!payload.address || !payload.port) {
        messageApi.error(t('pages.nodes.toasts.fillRequired'));
        return;
      }
      const msg = await testConnection(payload);
      if (msg?.success && msg.obj) {
        setTestResult(msg.obj);
      } else {
        setTestResult({ status: 'offline', error: msg?.msg || 'unknown error' });
      }
    } finally {
      setTesting(false);
    }
  }

  async function onSave() {
    const payload = buildPayload();
    if (!payload.name || !payload.address || !payload.port) {
      messageApi.error(t('pages.nodes.toasts.fillRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const msg = await save(payload);
      if (msg?.success) {
        // Push remote settings if in edit mode
        if (isEdit && remoteSettings && node?.id) {
          try {
            await HttpUtil.post(`/panel/api/nodes/pushSettings/${node.id}`, remoteSettings, {
              headers: { 'Content-Type': 'application/json' },
            });
          } catch { /* settings push is best-effort */ }
        }
        onOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    if (!submitting) onOpenChange(false);
  }

  const tabItems = useMemo(() => [
    {
      key: 'basic',
      label: t('pages.nodes.tabBasic'),
      children: (
        <Form layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label={t('pages.nodes.name')} required>
                <Input
                  value={form.name}
                  placeholder={t('pages.nodes.namePlaceholder')}
                  onChange={(e) => update('name', e.target.value)}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={t('pages.nodes.remark')}>
                <Input value={form.remark} onChange={(e) => update('remark', e.target.value)} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item label={t('pages.nodes.scheme')}>
                <Select
                  value={form.scheme}
                  onChange={(v) => update('scheme', v)}
                  options={[
                    { value: 'https', label: 'https' },
                    { value: 'http', label: 'http' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={t('pages.nodes.address')} required>
                <Input
                  value={form.address}
                  placeholder={t('pages.nodes.addressPlaceholder')}
                  onChange={(e) => update('address', e.target.value)}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label={t('pages.nodes.port')} required>
                <InputNumber
                  value={form.port}
                  min={1}
                  max={65535}
                  style={{ width: '100%' }}
                  onChange={(v) => update('port', Number(v) || 0)}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label={t('pages.nodes.basePath')}>
                <Input
                  value={form.basePath}
                  placeholder="/"
                  onChange={(e) => update('basePath', e.target.value)}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={t('pages.nodes.enable')}>
                <Switch checked={form.enable} onChange={(v) => update('enable', v)} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label={t('pages.nodes.allowPrivateAddress')}>
            <Switch
              checked={form.allowPrivateAddress}
              onChange={(v) => update('allowPrivateAddress', v)}
            />
            <div className="hint">{t('pages.nodes.allowPrivateAddressHint')}</div>
          </Form.Item>

          <Form.Item label={t('pages.nodes.apiToken')} required>
            <Input.Password
              value={form.apiToken}
              placeholder={t('pages.nodes.apiTokenPlaceholder')}
              onChange={(e) => update('apiToken', e.target.value)}
            />
            <div className="hint">{t('pages.nodes.apiTokenHint')}</div>
          </Form.Item>

          <div className="test-row">
            <Button type="default" loading={testing} onClick={onTest}>
              {t('pages.nodes.testConnection')}
            </Button>
            {testResult && (
              <div className="test-result">
                {testResult.status === 'online' ? (
                  <Alert
                    type="success"
                    showIcon
                    message={t('pages.nodes.connectionOk', { ms: testResult.latencyMs })}
                    description={testResult.xrayVersion ? `Xray ${testResult.xrayVersion}` : undefined}
                  />
                ) : (
                  <Alert
                    type="error"
                    showIcon
                    message={t('pages.nodes.connectionFailed')}
                    description={testResult.error}
                  />
                )}
              </div>
            )}
          </div>
        </Form>
      ),
    },
    ...(isEdit ? [
      {
        key: 'panel',
        label: t('pages.nodes.tabPanel'),
        children: (
          <>
            {remoteSettingsLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : remoteSettingsError ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#ff4d4f' }}>{remoteSettingsError}</div>
            ) : (
              <Form layout="vertical">
                <Form.Item label={t('pages.nodes.remoteLang')}>
                  <Select
                    value={remoteSettings?.tgLang}
                    style={{ width: '100%' }}
                    onChange={(v) => updateRemote('tgLang', v)}
                    options={LanguageManager.supportedLanguages.map((l: any) => ({
                      value: l.value,
                      label: `${l.icon}  ${l.name}`,
                    }))}
                  />
                </Form.Item>

                <Form.Item label={t('pages.nodes.remoteTimezone')}>
                  <Select
                    value={remoteSettings?.timeLocation}
                    showSearch
                    style={{ width: '100%' }}
                    filterOption={(input, option) =>
                      (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                    onChange={(v) => updateRemote('timeLocation', v)}
                    options={tzList}
                  />
                </Form.Item>
              </Form>
            )}
          </>
        ),
      },
      {
        key: 'xray',
        label: t('pages.nodes.tabXray'),
        children: (
          <>
            {remoteSettingsLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : remoteSettingsError ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#ff4d4f' }}>{remoteSettingsError}</div>
            ) : (
              <Form layout="vertical">
                <Form.Item label={t('pages.nodes.remoteXrayAutoUpdate')}>
                  <Switch
                    checked={!!remoteSettings?.xrayAutoUpdate}
                    onChange={(v) => updateRemote('xrayAutoUpdate', v)}
                  />
                  <div className="hint">{t('pages.nodes.remoteXrayAutoUpdateHint')}</div>
                </Form.Item>

                <Form.Item label={t('pages.nodes.remoteXrayUpdateCron')}>
                  <Input
                    value={remoteSettings?.xrayUpdateCron || ''}
                    disabled={!remoteSettings?.xrayAutoUpdate}
                    placeholder="0 30 2 * * *"
                    onChange={(e) => updateRemote('xrayUpdateCron', e.target.value)}
                  />
                  <div className="hint">
                    {t('pages.nodes.remoteCronHint', { tz: remoteSettings?.timeLocation || 'Local' })}
                  </div>
                </Form.Item>
              </Form>
            )}
          </>
        ),
      },
      {
        key: 'telegram',
        label: t('pages.nodes.tabTelegram'),
        children: (
          <>
            {remoteSettingsLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : remoteSettingsError ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#ff4d4f' }}>{remoteSettingsError}</div>
            ) : (
              <Form layout="vertical">
                <Form.Item label={t('pages.nodes.remoteTgEnable')}>
                  <Switch
                    checked={!!remoteSettings?.tgBotEnable}
                    onChange={(v) => updateRemote('tgBotEnable', v)}
                  />
                </Form.Item>

                <Form.Item label={t('pages.nodes.remoteTgToken')}>
                  <Input.Password
                    value={remoteSettings?.tgBotToken || ''}
                    placeholder={remoteSettings?.hasTgBotToken ? t('pages.nodes.remoteTgTokenConfigured') : ''}
                    onChange={(e) => updateRemote('tgBotToken', e.target.value)}
                  />
                </Form.Item>

                <Form.Item label={t('pages.nodes.remoteTgChatId')}>
                  <Input
                    value={remoteSettings?.tgBotChatId || ''}
                    onChange={(e) => updateRemote('tgBotChatId', e.target.value)}
                  />
                </Form.Item>

                <Form.Item label={t('pages.nodes.remoteTgLang')}>
                  <Select
                    value={remoteSettings?.tgLang}
                    style={{ width: '100%' }}
                    onChange={(v) => updateRemote('tgLang', v)}
                    options={LanguageManager.supportedLanguages.map((l: any) => ({
                      value: l.value,
                      label: `${l.icon}  ${l.name}`,
                    }))}
                  />
                </Form.Item>

                <Form.Item label={t('pages.nodes.remoteTgRunTime')}>
                  <Input
                    value={remoteSettings?.tgRunTime || ''}
                    placeholder="@daily"
                    onChange={(e) => updateRemote('tgRunTime', e.target.value)}
                  />
                  <div className="hint">{t('pages.nodes.remoteTgRunTimeHint')}</div>
                </Form.Item>

                <Form.Item label={t('pages.nodes.remoteTgBackup')}>
                  <Switch
                    checked={!!remoteSettings?.tgBotBackup}
                    onChange={(v) => updateRemote('tgBotBackup', v)}
                  />
                </Form.Item>

                <Form.Item label={t('pages.nodes.remoteTgLoginNotify')}>
                  <Switch
                    checked={!!remoteSettings?.tgBotLoginNotify}
                    onChange={(v) => updateRemote('tgBotLoginNotify', v)}
                  />
                </Form.Item>

                <Form.Item label={t('pages.nodes.remoteTgCpu')}>
                  <InputNumber
                    value={remoteSettings?.tgCpu}
                    min={0}
                    max={100}
                    style={{ width: '100%' }}
                    onChange={(v) => updateRemote('tgCpu', Number(v) || 0)}
                  />
                  <div className="hint">{t('pages.nodes.remoteTgCpuHint')}</div>
                </Form.Item>
              </Form>
            )}
          </>
        ),
      },
    ] : []),
  ], [t, form, isEdit, remoteSettings, remoteSettingsLoading, remoteSettingsError, testing, testResult, tzList]);

  return (
    <>
      {messageContextHolder}
      <Modal
        open={open}
        title={title}
        confirmLoading={submitting}
        okText={t('save')}
        cancelText={t('cancel')}
        maskClosable={false}
        width="720px"
        onOk={onSave}
        onCancel={close}
      >
        <Tabs activeKey={activeTabKey} onChange={setActiveTabKey} items={tabItems} />
      </Modal>
    </>
  );
}
