import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  message,
  Modal,
  Select,
  Space,
  Table,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { HttpUtil, SizeFormatter, IntlUtil } from '@/utils';
import { TLS_FLOW_CONTROL } from '@/schemas/primitives';

const FLOW_OPTIONS = Object.values(TLS_FLOW_CONTROL) as string[];

interface SourceOption {
  id: number;
  label: string;
}

interface SourceClient {
  email: string;
  trafficLabel: string;
  expiryLabel: string;
}

interface CopyClientsModalProps {
  open: boolean;
  onClose: () => void;
  dbInbound: any;
  dbInbounds: any[];
  onSaved: () => void;
}

export default function CopyClientsModal({
  open,
  onClose,
  dbInbound,
  dbInbounds,
  onSaved,
}: CopyClientsModalProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [sourceInboundId, setSourceInboundId] = useState<number | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [flow, setFlow] = useState('');
  const initializedRef = useRef(false);

  const sources = useMemo<SourceOption[]>(() => {
    if (!dbInbound) return [];
    return (dbInbounds || [])
      .filter(
        (row: any) =>
          row.id !== dbInbound.id &&
          typeof row.isMultiUser === 'function' &&
          row.isMultiUser(),
      )
      .map((row: any) => {
        let count = 0;
        try { count = (row.toInbound().clients || []).length; } catch { /* ignore */ }
        return { id: row.id, label: `${row.remark || `#${row.id}`} (${row.protocol}, ${count})` };
      });
  }, [dbInbound, dbInbounds]);

  const sourceInbound = useMemo(() => {
    if (!sourceInboundId) return null;
    return (dbInbounds || []).find((r: any) => r.id === sourceInboundId) || null;
  }, [sourceInboundId, dbInbounds]);

  const sourceClients = useMemo<SourceClient[]>(() => {
    if (!sourceInbound) return [];
    let list: any[] = [];
    try { list = sourceInbound.toInbound().clients || []; } catch { /* ignore */ }
    const stats = new Map((sourceInbound.clientStats || []).map((s: any) => [s.email, s]));
    return list
      .filter((c: any) => c.email)
      .map((c: any) => {
        const s = stats.get(c.email);
        const used = s ? (s.up || 0) + (s.down || 0) : 0;
        let expiryLabel = t('unlimited');
        if (c.expiryTime > 0) expiryLabel = IntlUtil.formatDate(c.expiryTime);
        else if (c.expiryTime < 0) expiryLabel = `${-c.expiryTime / 86400000}d`;
        return { email: c.email, trafficLabel: SizeFormatter.sizeFormat(used), expiryLabel };
      });
  }, [sourceInbound, t]);

  const showFlow = useMemo(() => {
    if (!dbInbound) return false;
    try {
      const inb = dbInbound.toInbound();
      return !!(inb && typeof inb.canEnableTlsFlow === 'function' && inb.canEnableTlsFlow());
    } catch { return false; }
  }, [dbInbound]);

  const columns: ColumnsType<SourceClient> = useMemo(() => [
    { title: t('pages.inbounds.email'), dataIndex: 'email', width: 280 },
    { title: t('pages.inbounds.traffic'), dataIndex: 'trafficLabel', width: 140 },
    { title: t('pages.inbounds.expireDate'), dataIndex: 'expiryLabel', width: 160 },
  ], [t]);

  const title = useMemo(() => {
    if (!dbInbound) return t('pages.client.copyFromInbound');
    const target = dbInbound.remark || `#${dbInbound.id}`;
    return `${t('pages.client.copyToInbound')} ${target}`;
  }, [dbInbound, t]);

  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;

    setSourceInboundId(null);
    setSelectedEmails([]);
    setFlow('');
    setSaving(false);
  }, [open]);

  useEffect(() => {
    setSelectedEmails([]);
  }, [sourceInboundId]);

  const selectAll = useCallback(() => {
    setSelectedEmails(sourceClients.map((c) => c.email));
  }, [sourceClients]);

  const clearAll = useCallback(() => {
    setSelectedEmails([]);
  }, []);

  const handleClose = useCallback(() => {
    if (saving) return;
    onClose();
  }, [saving, onClose]);

  const submit = useCallback(async () => {
    if (!sourceInboundId) {
      message.error(t('pages.client.copySelectSourceFirst'));
      return;
    }
    if (!dbInbound) return;

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        sourceInboundId,
        clientEmails: selectedEmails,
      };
      if (showFlow && flow) payload.flow = flow;
      const msg = await HttpUtil.post(
        `/panel/api/inbounds/${dbInbound.id}/copyClients`,
        payload,
      );
      if (!msg?.success) return;
      const obj = msg.obj || {};
      const addedCount = (obj.added || []).length;
      const errorList = obj.errors || [];
      if (addedCount > 0) {
        message.success(`${t('pages.client.copyResultSuccess')}: ${addedCount}`);
      } else {
        message.warning(t('pages.client.copyResultNone'));
      }
      if (errorList.length > 0) {
        message.error(`${t('pages.client.copyResultErrors')}: ${errorList.join('; ')}`);
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }, [sourceInboundId, selectedEmails, showFlow, flow, dbInbound, onSaved, onClose, t]);

  const rowSelection = useMemo(() => ({
    selectedRowKeys: selectedEmails,
    onChange: (_: React.Key[], rows: SourceClient[]) => {
      setSelectedEmails(rows.map((r) => r.email));
    },
  }), [selectedEmails]);

  return (
    <Modal
      open={open}
      title={title}
      okText={t('pages.client.copySelected')}
      cancelText={t('close')}
      confirmLoading={saving}
      maskClosable={false}
      width={720}
      onOk={submit}
      onCancel={handleClose}
      destroyOnHidden
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <div style={{ marginBottom: 6 }}>{t('pages.client.copySource')}</div>
          <Select
            value={sourceInboundId}
            style={{ width: '100%' }}
            allowClear
            placeholder={t('pages.client.copySelectSourcePlaceholder')}
            onChange={(v) => setSourceInboundId(v ?? null)}
            options={sources.map((item) => ({ value: item.id, label: item.label }))}
          />
        </div>

        {sourceInboundId != null && (
          <div>
            <Space style={{ marginBottom: 8 }}>
              <Button size="small" onClick={selectAll}>{t('pages.client.selectAll')}</Button>
              <Button size="small" onClick={clearAll}>{t('pages.client.clearAll')}</Button>
            </Space>
            <Table
              columns={columns}
              dataSource={sourceClients.map((c) => ({ ...c, key: c.email }))}
              pagination={false}
              size="small"
              rowSelection={rowSelection}
              scroll={{ y: 280 }}
            />
          </div>
        )}

        {showFlow && (
          <div>
            <div style={{ marginBottom: 6 }}>{t('pages.client.copyFlowLabel')}</div>
            <Select
              value={flow || undefined}
              style={{ width: '100%' }}
              allowClear
              onChange={(v) => setFlow(v ?? '')}
              options={[{ value: '', label: t('none') }, ...FLOW_OPTIONS.map((k) => ({ value: k, label: k }))]}
            />
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
              {t('pages.client.copyFlowHint')}
            </div>
          </div>
        )}
      </Space>
    </Modal>
  );
}
