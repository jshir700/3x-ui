import { useMemo } from 'react';
import { Collapse, Divider, Input, InputNumber, Select, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import type { AllSetting } from '@/models/setting';
import SettingListItem from '@/components/SettingListItem';

interface SubscriptionGeneralTabProps {
  allSetting: AllSetting;
  updateSetting: (patch: Partial<AllSetting>) => void;
}

function sanitizePath(input: string): string {
  return String(input ?? '').replace(/[:*]/g, '');
}

function normalizePath(input: string): string {
  let p = input || '/';
  if (!p.startsWith('/')) p = '/' + p;
  if (!p.endsWith('/')) p += '/';
  p = p.replace(/\/+/g, '/');
  return p;
}

export default function SubscriptionGeneralTab({ allSetting, updateSetting }: SubscriptionGeneralTabProps) {
  const { t } = useTranslation();

  const subPreviewUrl = useMemo(() => {
    const scheme = allSetting.subUriScheme || 'https';
    const addr = allSetting.subUriAddress?.trim();
    const port = allSetting.subUriPort;
    const path = allSetting.subUriPath || '/sub/';
    if (addr) {
      const defaultPort = port && port > 0 ? `:${port}` : '';
      return `${scheme}://${addr}${defaultPort}${path}`;
    }
    const hostname = window.location.hostname;
    const subPort = allSetting.subPortLocked
      ? (allSetting.subExternalPort || 2096)
      : (allSetting.subPort || 2096);
    const subPath = allSetting.subPath || '/sub/';
    return `${scheme}://${hostname}:${subPort}${subPath}`;
  }, [allSetting.subUriScheme, allSetting.subUriAddress, allSetting.subUriPort, allSetting.subUriPath, allSetting.subPort, allSetting.subPath]);

  return (
    <Collapse defaultActiveKey="1" items={[
      {
        key: '1',
        label: t('pages.settings.panelSettings'),
        children: (
          <>
            <SettingListItem paddings="small" title={t('pages.settings.subEnable')} description={t('pages.settings.subEnableDesc')}>
              <Switch checked={allSetting.subEnable} onChange={(v) => updateSetting({ subEnable: v })} />
              {allSetting.subEnable && (
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  {subPreviewUrl}
                </div>
              )}
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subListen')} description={t('pages.settings.subListenDesc')}>
              <Input value={allSetting.subListen} onChange={(e) => updateSetting({ subListen: e.target.value })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subDomain')} description={t('pages.settings.subDomainDesc')}>
              <Input value={allSetting.subDomain} onChange={(e) => updateSetting({ subDomain: e.target.value })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subPort')} description={t('pages.settings.subPortDesc')}>
              <div style={{ width: '100%' }}>
                <InputNumber value={allSetting.subPort} min={1} max={65535} style={{ width: '100%' }}
                  disabled={allSetting.subPortLocked}
                  onChange={(v) => updateSetting({ subPort: Number(v) || 0 })} />
                {allSetting.subPortLocked && (
                  <p style={{ color: '#8c8c8c', fontSize: 12, margin: '4px 0 0 0' }}>
                    {t('pages.settings.subPortLockedHint', { port: allSetting.subExternalPort || '?' })}
                  </p>
                )}
              </div>
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subPath')} description={t('pages.settings.subPathDesc')}>
              <Input
                value={allSetting.subPath}
                placeholder="/sub/"
                onChange={(e) => updateSetting({ subPath: sanitizePath(e.target.value) })}
                onBlur={() => updateSetting({ subPath: normalizePath(allSetting.subPath) })}
              />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subURI')} description={t('pages.settings.subURIDesc')}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Select
                  value={allSetting.subUriScheme}
                  style={{ width: 90 }}
                  onChange={(v) => updateSetting({ subUriScheme: v })}
                  options={[
                    { value: 'http', label: 'http' },
                    { value: 'https', label: 'https' },
                  ]}
                />
                <span>://</span>
                <Input
                  value={allSetting.subUriAddress}
                  placeholder={t('subUriAddressPlaceholder')}
                  style={{ flex: 1 }}
                  onChange={(e) => updateSetting({ subUriAddress: e.target.value })}
                />
                <span>:</span>
                <InputNumber
                  value={allSetting.subUriPort || undefined}
                  min={1}
                  max={65535}
                  style={{ width: 90 }}
                  placeholder={t('pages.inbounds.port')}
                  onChange={(v) => updateSetting({ subUriPort: v != null ? Number(v) : 0 })}
                />
                <Input
                  value={allSetting.subUriPath}
                  placeholder="/sub/"
                  style={{ width: 100 }}
                  onChange={(e) => updateSetting({ subUriPath: sanitizePath(e.target.value) })}
                  onBlur={() => updateSetting({ subUriPath: normalizePath(allSetting.subUriPath) })}
                />
              </div>
            </SettingListItem>
          </>
        ),
      },
      {
        key: '2',
        label: t('pages.settings.information'),
        children: (
          <>
            <SettingListItem paddings="small" title={t('pages.settings.subEncrypt')} description={t('pages.settings.subEncryptDesc')}>
              <Switch checked={allSetting.subEncrypt} onChange={(v) => updateSetting({ subEncrypt: v })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subShowInfo')} description={t('pages.settings.subShowInfoDesc')}>
              <Switch checked={allSetting.subShowInfo} onChange={(v) => updateSetting({ subShowInfo: v })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subEmailInRemark')} description={t('pages.settings.subEmailInRemarkDesc')}>
              <Switch checked={allSetting.subEmailInRemark} onChange={(v) => updateSetting({ subEmailInRemark: v })} />
            </SettingListItem>

            <Divider>{t('pages.settings.subTitle')}</Divider>

            <SettingListItem paddings="small" title={t('pages.settings.subTitle')} description={t('pages.settings.subTitleDesc')}>
              <Input value={allSetting.subTitle} onChange={(e) => updateSetting({ subTitle: e.target.value })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subSupportUrl')} description={t('pages.settings.subSupportUrlDesc')}>
              <Input value={allSetting.subSupportUrl} placeholder="https://example.com"
                onChange={(e) => updateSetting({ subSupportUrl: e.target.value })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subProfileUrl')} description={t('pages.settings.subProfileUrlDesc')}>
              <Input value={allSetting.subProfileUrl} placeholder="https://example.com"
                onChange={(e) => updateSetting({ subProfileUrl: e.target.value })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subAnnounce')} description={t('pages.settings.subAnnounceDesc')}>
              <Input.TextArea value={allSetting.subAnnounce}
                onChange={(e) => updateSetting({ subAnnounce: e.target.value })} />
            </SettingListItem>

            <Divider>Happ</Divider>

            <SettingListItem paddings="small" title={t('pages.settings.subEnableRouting')} description={t('pages.settings.subEnableRoutingDesc')}>
              <Switch checked={allSetting.subEnableRouting} onChange={(v) => updateSetting({ subEnableRouting: v })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subRoutingRules')} description={t('pages.settings.subRoutingRulesDesc')}>
              <Input.TextArea value={allSetting.subRoutingRules} placeholder="happ://routing/add/..."
                onChange={(e) => updateSetting({ subRoutingRules: e.target.value })} />
            </SettingListItem>
          </>
        ),
      },
      {
        key: '3',
        label: t('pages.settings.certs'),
        children: (
          <>
            <SettingListItem paddings="small" title={t('pages.settings.subCertPath')} description={t('pages.settings.subCertPathDesc')}>
              <Input value={allSetting.subCertFile} onChange={(e) => updateSetting({ subCertFile: e.target.value })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subKeyPath')} description={t('pages.settings.subKeyPathDesc')}>
              <Input value={allSetting.subKeyFile} onChange={(e) => updateSetting({ subKeyFile: e.target.value })} />
            </SettingListItem>
          </>
        ),
      },
      {
        key: '4',
        label: t('pages.settings.intervals'),
        children: (
          <>
            <SettingListItem paddings="small" title={t('pages.settings.subUpdates')} description={t('pages.settings.subUpdatesDesc')}>
              <InputNumber value={allSetting.subUpdates} min={1} style={{ width: '100%' }}
                onChange={(v) => updateSetting({ subUpdates: Number(v) || 0 })} />
            </SettingListItem>
          </>
        ),
      },
    ]} />
  );
}
