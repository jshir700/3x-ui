import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Alert,
  Button,
  Card,
  Col,
  ConfigProvider,
  Layout,
  message,
  Modal,
  Popconfirm,
  Popover,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';

import { ColorUtils, HttpUtil, IntlUtil, SizeFormatter } from '@/utils';
import InfinityIcon from '@/components/InfinityIcon';
import { useTheme } from '@/hooks/useTheme';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import AppSidebar from '@/components/AppSidebar';
import CustomStatistic from '@/components/CustomStatistic';
import { useSubscription } from './useSubscription';
import SubscriptionFormModal from './SubscriptionFormModal';
import { setMessageInstance } from '@/utils/messageBus';
import '@/styles/page-cards.css';
import './SubscriptionPage.css';

const { Text } = Typography;

interface AllSetting {
  subEnable?: boolean;
  subPort?: number;
  subURI?: string;
  subPath?: string;
  datepicker?: string;
  subPortLocked?: boolean;
  subExternalPort?: number;
}

const basePath = window.X_UI_BASE_PATH || '';
const requestUri = window.location.pathname;

export default function SubscriptionAdminPage() {
  const { t, i18n } = useTranslation();
  const { isDark, isUltra, antdThemeConfig } = useTheme();
  const { isMobile } = useMediaQuery();
  const [modal, modalContextHolder] = Modal.useModal();
  const [messageApi, messageContextHolder] = message.useMessage();

  useEffect(() => { setMessageInstance(messageApi); }, [messageApi]);

  const {
    subscriptions,
    loading,
    fetched,
    fetchAll,
    create,
    update,
    remove,
    setEnable,
  } = useSubscription();

  const [allInbounds, setAllInbounds] = useState<any[]>([]);
  const [allSetting, setAllSetting] = useState<AllSetting>({});
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [formSub, setFormSub] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load all settings (for sub port, etc.)
  useEffect(() => {
    (async () => {
      const msg = await HttpUtil.post('/panel/setting/all') as { success?: boolean; obj?: AllSetting };
      if (msg?.success) setAllSetting(msg.obj || {});
    })();
  }, []);

  // Load inbounds for counts
  useEffect(() => {
    if (!fetched) return;
    (async () => {
      const msg = await HttpUtil.get('/panel/api/inbounds/list') as { success?: boolean; obj?: any[] };
      if (msg?.success) setAllInbounds(msg.obj || []);
    })();
  }, [fetched, refreshKey]);

  // Auto-disable expired subscriptions
  const autoDisabledRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!subscriptions.length) return;
    const now = Date.now();
    const toDisable: number[] = [];
    for (const sub of subscriptions) {
      if (sub.enable && sub.expiryTime > 0 && now > sub.expiryTime && !autoDisabledRef.current.has(sub.id)) {
        toDisable.push(sub.id);
        autoDisabledRef.current.add(sub.id);
      }
    }
    if (toDisable.length > 0) {
      Promise.all(toDisable.map((id) => setEnable(id, false))).then(() => fetchAll());
    }
  }, [subscriptions, setEnable, fetchAll]);

  const [shakingId, setShakingId] = useState<number | null>(null);

  const subDisabled = !allSetting.subEnable;

  // Form handlers
  function onAdd() {
    setFormMode('add');
    setFormSub(null);
    setFormOpen(true);
  }

  function onEdit(sub: any) {
    setFormMode('edit');
    setFormSub({ ...sub });
    setFormOpen(true);
  }

  async function onSave(payload: Record<string, unknown>) {
    let msg: { success?: boolean; msg?: string } | undefined;
    if (formMode === 'edit' && formSub?.id) {
      msg = await update(formSub.id, payload) as { success?: boolean; msg?: string };
    } else {
      msg = await create(payload) as { success?: boolean; msg?: string };
    }
    if (msg?.success) { await fetchAll(); setRefreshKey((k) => k + 1); }
    return msg || { success: false };
  }

  function onDelete(sub: any) {
    modal.confirm({
      title: t('subDeleteTitle'),
      content: t('subDeleteConfirm', { remark: sub.remark || sub.subId }),
      okText: t('subOk'),
      okButtonProps: { danger: true },
      cancelText: t('subCancel'),
      onOk: async () => {
        const msg = await remove(sub.id);
        if (msg?.success) {
          messageApi.success(t('subDeleted'));
          setRefreshKey((k) => k + 1);
        }
      },
    });
  }

  async function onToggleEnable(sub: any, next: boolean) {
    if (next && sub.expiryTime > 0 && Date.now() > sub.expiryTime) {
      setShakingId(sub.id);
      setTimeout(() => setShakingId(null), 500);
      messageApi.warning(t('subExpiredWarning'));
      return;
    }
    const msg = await setEnable(sub.id, next) as { success?: boolean };
    if (msg?.success) {
      messageApi.success(next ? t('subEnabledMsg') : t('subDisabledMsg'));
      await fetchAll();
      setRefreshKey((k) => k + 1);
    }
  }

  function onCopyLink(sub: any) {
    const uri = allSetting.subURI;
    const path = allSetting.subPath || '/sub/';
    let baseUrl: string;
    if (uri) {
      baseUrl = uri.endsWith('/') ? uri : uri + '/';
    } else if (allSetting.subPortLocked) {
      const extPort = allSetting.subExternalPort > 0 ? allSetting.subExternalPort : (allSetting.subPort || 2096);
      const proto = window.location.protocol;
      const host = window.location.hostname;
      baseUrl = `${proto}//${host}:${extPort}${path}`;
    } else {
      const port = allSetting.subPort || 2096;
      const proto = window.location.protocol;
      const host = window.location.hostname;
      baseUrl = `${proto}//${host}:${port}${path}`;
    }
    let url = `${baseUrl}${sub.subId}`;
    if (sub.password) url += `?pwd=${sub.password}`;
    navigator.clipboard.writeText(url).then(
      () => messageApi.success(t('subLinkCopied')),
      () => messageApi.error(t('subCopyFailed')),
    );
  }

  // Compute enriched table data
  const GB = 1073741824;

  const tableData = useMemo(() => {
    const now = Date.now();

    // Step 1: Build email → [{client,inbound} pair] reverse index.
    // One-to-many: a single email may appear in multiple inbounds.
    interface EmailClientInfo {
      clientEnable: boolean;
      clientTotalGB: number;   // raw totalGB from settings (GB)
      inboundId: number;
      inboundEnable: boolean;
      inboundTotal: number;    // inbound.total (bytes)
    }
    const emailToInbounds: Record<string, EmailClientInfo[]> = {};
    for (const ib of allInbounds) {
      const ibEnabled = ib.enable && (ib.expiryTime <= 0 || now < ib.expiryTime);
      const ibTotal = Number(ib.total || 0);
      try {
        const settings = typeof ib.settings === 'string' ? JSON.parse(ib.settings) : (ib.settings || {});
        for (const c of (settings.clients || [])) {
          if (!c.email) continue;
          if (!emailToInbounds[c.email]) emailToInbounds[c.email] = [];
          emailToInbounds[c.email].push({
            clientEnable: c.enable !== false,
            clientTotalGB: Number(c.totalGB || 0),
            inboundId: ib.id,
            inboundEnable: ibEnabled,
            inboundTotal: ibTotal,
          });
        }
      } catch { /* skip malformed settings */ }
    }

    // Step 2: Build email → traffic index from all inbounds' clientStats.
    const emailToTraffic: Record<string, { up: number; down: number }> = {};
    for (const ib of allInbounds) {
      const stats = Array.isArray(ib.clientStats) ? ib.clientStats : [];
      for (const st of stats) {
        if (st.email) {
          if (!emailToTraffic[st.email]) {
            emailToTraffic[st.email] = { up: 0, down: 0 };
          }
          emailToTraffic[st.email].up += Number(st.up || 0);
          emailToTraffic[st.email].down += Number(st.down || 0);
        }
      }
    }

    return subscriptions.map((s, idx) => {
      const emails = (s.clientEmails || '').split(',').map((e: string) => e.trim()).filter(Boolean);

      const seenEmails = new Set<string>();
      const seenInbounds = new Set<number>();
      let clientCount = 0;
      let deactiveClientCount = 0;
      let linkCount = 0;
      let disabledLinkCount = 0;
      let sumUp = 0;
      let sumDown = 0;
      let clientQuotaBytes = 0;   // clientTotalGB × GB
      let inboundQuotaBytes = 0;  // inbound.total (already bytes)

      for (const email of emails) {
        if (!email || seenEmails.has(email)) continue;
        seenEmails.add(email);

        const records = emailToInbounds[email];
        if (!records || records.length === 0) continue;

        const t = emailToTraffic[email];
        const trafficUsed = t ? (t.up || 0) + (t.down || 0) : 0;
        const clientTotalGB = records[0]?.clientTotalGB || 0;
        const clientDepleted = clientTotalGB > 0 && trafficUsed >= clientTotalGB * GB;

        let emailHasClient = false;
        for (const r of records) {
          if (r.clientEnable) {
            emailHasClient = true;
          }
          const recordDepleted = r.clientTotalGB > 0 && trafficUsed >= r.clientTotalGB * GB;
          const clientLinkActive = r.clientEnable && !recordDepleted;
          const linkActive = clientLinkActive && r.inboundEnable;
          if (linkActive) {
            linkCount++;
          } else {
            disabledLinkCount++;
          }
          if (!seenInbounds.has(r.inboundId)) {
            seenInbounds.add(r.inboundId);
            inboundQuotaBytes += r.inboundTotal;
          }
        }
        if (emailHasClient && !clientDepleted) {
          clientCount++;
        } else {
          deactiveClientCount++;
        }

        // Client quota: first record's totalGB (backward compatible with
        // the old "first match wins" behaviour for quota calculation).
        clientQuotaBytes += records[0].clientTotalGB * GB;

        if (t) {
          sumUp += t.up;
          sumDown += t.down;
        }
      }

      const finalQuota = Math.min(clientQuotaBytes, inboundQuotaBytes);

      const expired = s.expiryTime > 0 && now > s.expiryTime;

      return {
        ...s,
        key: s.id,
        index: idx + 1,
        clientCount,
        deactiveClientCount,
        linkCount,
        disabledLinkCount,
        trafficDown: sumDown,
        trafficUp: sumUp,
        quotaTotal: finalQuota,
        expired,
      };
    });
  }, [subscriptions, allInbounds]);

  // Inbounds loading for the form modal
  const [inboundsForForm, setInboundsForForm] = useState<any[]>([]);
  useEffect(() => {
    if (!formOpen) return;
    (async () => {
      const msg = await HttpUtil.get('/panel/api/inbounds/list') as { success?: boolean; obj?: any[] };
      if (msg?.success) setInboundsForForm(msg.obj || []);
    })();
  }, [formOpen]);

  const totals = useMemo(() => {
    const total = subscriptions.length;
    const enabled = subscriptions.filter((s) => s.enable).length;
    return { total, enabled };
  }, [subscriptions]);

  const pageClass = useMemo(() => {
    const classes = ['subscription-page'];
    if (isDark) classes.push('is-dark');
    if (isUltra) classes.push('is-ultra');
    return classes.join(' ');
  }, [isDark, isUltra]);

  const columns = useMemo(() => {
    const cols: any[] = [
      { title: '#', dataIndex: 'index', key: 'index', width: 50, align: 'center' as const },
      {
        title: t('subName'), key: 'name', width: 200,
        onHeaderCell: () => ({ style: { textAlign: 'center' as const } }),
        render: (_: any, record: any) => (
          <div>
            <div style={{ fontWeight: 500 }}>{record.title || record.subId}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>{record.remark || ''}</Text>
          </div>
        ),
      },
      {
        title: t('subStatus'), key: 'enable', width: 70, align: 'center' as const,
        render: (_: any, record: any) => (
          <Switch
            size="small"
            checked={record.enable}
            disabled={subDisabled}
            className={shakingId === record.id ? 'expired-switch-shake' : ''}
            onChange={(v) => onToggleEnable(record, v)}
          />
        ),
      },
      {
        title: t('subFormat'), dataIndex: 'format', key: 'format', width: 70, align: 'center' as const,
        render: (v: string) => <Tag>{v}</Tag>,
      },
      {
        title: t('subClients'), key: 'clientCount', width: 70, align: 'center' as const,
        render: (_: any, record: any) => (
          <>
            <Tag color="green" style={{ margin: 0, padding: '0 2px' }}>{record.clientCount}</Tag>
            {record.deactiveClientCount > 0 && (
              <Popover title={t('disabled')}>
                <Tag style={{ margin: 0, padding: '0 2px' }}>{record.deactiveClientCount}</Tag>
              </Popover>
            )}
          </>
        ),
      },
      {
        title: t('subLinkCount'), key: 'linkCount', width: 70, align: 'center' as const,
        render: (_: any, record: any) => (
          <>
            <Tag color="green" style={{ margin: 0, padding: '0 2px' }}>{record.linkCount}</Tag>
            {record.disabledLinkCount > 0 && (
              <Popover title={t('disabled')}>
                <Tag style={{ margin: 0, padding: '0 2px' }}>{record.disabledLinkCount}</Tag>
              </Popover>
            )}
          </>
        ),
      },
      {
        title: t('subTraffic'), key: 'traffic', width: 110, align: 'center' as const,
        render: (_: any, record: any) => {
          const used = (record.trafficDown || 0) + (record.trafficUp || 0);
          const total = record.quotaTotal || 0;
          return (
            <Popover content={(
              <table cellPadding={2}>
                <tbody>
                  <tr><td>{'↑'}</td><td>{SizeFormatter.sizeFormat(record.trafficUp || 0)}</td></tr>
                  <tr><td>{'↓'}</td><td>{SizeFormatter.sizeFormat(record.trafficDown || 0)}</td></tr>
                </tbody>
              </table>
            )}>
              <Tag color={ColorUtils.usageColor(used, 0, total)}>
                {SizeFormatter.sizeFormat(used)}/{' '}
                {total > 0 ? SizeFormatter.sizeFormat(total) : <InfinityIcon />}
              </Tag>
            </Popover>
          );
        },
      },
      {
        title: t('subExpiryTime'), key: 'expiryTime', width: 130, align: 'center' as const,
        render: (_: any, record: any) => (
          record.expiryTime === 0
            ? <span>{t('subscription.noExpiry')}</span>
            : <span style={{ color: record.expired ? '#ff4d4f' : undefined }}>{IntlUtil.formatDate(record.expiryTime, allSetting.datepicker)}</span>
        ),
      },
      { title: t('subOnlineCount'), dataIndex: 'callCount', key: 'callCount', width: 70, align: 'center' as const },
      { title: t('subLastOnlineTime'), key: 'lastUsed', width: 160, align: 'center' as const,
        render: (_: any, record: any) => (
          record.lastUsed ? <span>{IntlUtil.formatDate(record.lastUsed, allSetting.datepicker)}</span> : <span>-</span>
        ),
      },
      { title: t('subCreatedAt'), key: 'createdAt', width: 160, align: 'center' as const,
        render: (_: any, record: any) => (
          record.createdAt ? <span>{IntlUtil.formatDate(record.createdAt, allSetting.datepicker)}</span> : <span>-</span>
        ),
      },
      {
        title: t('subActions'), key: 'actions', width: 160, fixed: 'right' as const, align: 'center' as const,
        render: (_: any, record: any) => (
          <Space size="small">
            <Tooltip title={t('subCopyLink')}>
              <Button size="small" icon={<CopyOutlined />} onClick={() => onCopyLink(record)} />
            </Tooltip>
            <Tooltip title={t('edit')}>
              <Button size="small" icon={<EditOutlined />} disabled={subDisabled} onClick={() => onEdit(record)} />
            </Tooltip>
            <Popconfirm
              title={t('subDeleteConfirm', { remark: record.remark || record.subId })}
              onConfirm={() => onDelete(record)}
              okText={t('subOk')}
              cancelText={t('subCancel')}
            >
              <Button size="small" danger icon={<DeleteOutlined />} disabled={subDisabled} />
            </Popconfirm>
          </Space>
        ),
      },
    ];

    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, subDisabled, allSetting.subPort, allSetting.subURI, allSetting.subPath, allSetting.datepicker]);

  return (
    <ConfigProvider theme={antdThemeConfig}>
      {messageContextHolder}
      {modalContextHolder}
      <Layout className={pageClass}>
        <AppSidebar basePath={basePath} requestUri={requestUri} />

        <Layout className="content-shell">
          <Layout.Content id="content-layout" className="content-area">
            <Spin spinning={(!fetched && loading) || false} delay={200} description="Loading…" size="large">
              {!fetched && loading ? (
                <div className="loading-spacer" />
              ) : (
                <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 12]}>
                  <Col span={24}>
                    <Card size="small" hoverable className="summary-card">
                      <Row gutter={[16, isMobile ? 16 : 12]} justify="space-evenly">
                        <Col xs={8} sm={6} md={6}>
                          <CustomStatistic
                            title={t('subTotalCount')}
                            value={String(totals.total)}
                            prefix={<CloudServerOutlined />}
                          />
                        </Col>
                        <Col xs={8} sm={6} md={6}>
                          <CustomStatistic
                            title={t('enabled')}
                            value={String(totals.enabled)}
                            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                          />
                        </Col>
                        <Col xs={8} sm={6} md={6}>
                          <CustomStatistic
                            title={t('disabled')}
                            value={String(totals.total - totals.enabled)}
                            prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                          />
                        </Col>
                      </Row>
                    </Card>
                  </Col>

                  {subDisabled && (
                    <Col span={24}>
                      <Alert
                        type="warning"
                        showIcon
                        banner
                        message={t('subServiceDisabled')}
                        description={t('subServiceDisabledDesc')}
                        style={{ marginBottom: 16 }}
                      />
                    </Col>
                  )}

                  <Col span={24}>
                    <Card size="small" hoverable>
                      <div className="toolbar">
                        <Button type="primary" icon={<PlusOutlined />} onClick={onAdd} disabled={subDisabled}>
                          {t('subCreate')}
                        </Button>
                      </div>

                      {subscriptions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
                          <CloudServerOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                          <div>{t('subNoSubscriptions')}</div>
                        </div>
                      ) : (
                        <Table
                          columns={columns}
                          dataSource={tableData}
                          size="small"
                          scroll={{ x: isMobile ? 1000 : 1200 }}
                          pagination={subscriptions.length > 25 ? { pageSize: 25, showSizeChanger: true } : false}
                        />
                      )}
                    </Card>
                  </Col>
                </Row>
              )}
            </Spin>
          </Layout.Content>
        </Layout>
      </Layout>

      <SubscriptionFormModal
        open={formOpen}
        mode={formMode}
        subscription={formSub}
        save={onSave}
        onOpenChange={setFormOpen}
        subPortLocked={allSetting.subPortLocked}
        subExternalPort={allSetting.subExternalPort}
      />
    </ConfigProvider>
  );
}
