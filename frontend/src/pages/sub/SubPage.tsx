import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Col,
  ConfigProvider,
  Descriptions,
  Dropdown,
  Layout,
  message,
  Popover,
  QRCode,
  Row,
  Space,
  Tag,
  Alert,
} from 'antd';
import {
  AndroidOutlined,
  AppleOutlined,
  CopyOutlined,
  DownOutlined,
  LinkOutlined,
  QuestionCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';

import { ClipboardManager, ColorUtils, IntlUtil, LanguageManager, SizeFormatter } from '@/utils';
import InfinityIcon from '@/components/InfinityIcon';
import { setMessageInstance } from '@/utils/messageBus';
import { pauseAnimationsUntilLeave, useTheme } from '@/hooks/useTheme';
import './SubPage.css';

const QR_SIZE = 240;

const subData = window.__SUB_PAGE_DATA__ || {};

const enabled = !!subData.enabled;
const download = subData.download || '0';
const upload = subData.upload || '0';
const remained = subData.remained || '';
const totalByte = Number(subData.totalByte || 0);
const downloadByte = Number(subData.downloadByte || 0);
const uploadByte = Number(subData.uploadByte || 0);
const expireMs = Number(subData.expire || 0) * 1000;
const lastOnlineMs = Number(subData.lastOnline || 0);
const subUrl = subData.subUrl || '';
const subTitle = subData.subTitle || '';
const remark = subData.remark || '';
const subSupportUrl = subData.subSupportUrl || '';
const subProfileUrl = subData.subProfileUrl || '';
const announce = subData.announce || '';
const updateInterval = subData.updateInterval || '0';
const callCount = Number(subData.callCount || 0);
const clientCount = Number(subData.clientCount || 0);
const linkCount = Number(subData.linkCount || 0);
const format = subData.format || '';
const links: string[] = Array.isArray(subData.links) ? subData.links : [];
const datepicker = subData.datepicker || 'gregorian';

export default function SubPage() {
  const { t } = useTranslation();
  const { isDark, isUltra, toggleTheme, toggleUltra, antdThemeConfig } = useTheme();
  const [messageApi, messageContextHolder] = message.useMessage();
  const qrRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { setMessageInstance(messageApi); }, [messageApi]);

  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth < 576);
  const [lang, setLang] = useState<string>(() => LanguageManager.getLanguage());

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 576);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onLangChange = useCallback((next: string) => {
    setLang(next);
    LanguageManager.setLanguage(next);
  }, []);

  const cycleTheme = useCallback(() => {
    pauseAnimationsUntilLeave('sub-theme-cycle');
    if (!isDark) {
      toggleTheme();
      if (isUltra) toggleUltra();
    } else if (!isUltra) {
      toggleUltra();
    } else {
      toggleUltra();
      toggleTheme();
    }
  }, [isDark, isUltra, toggleTheme, toggleUltra]);

  const copy = useCallback(async (value: string) => {
    if (!value) return;
    const ok = await ClipboardManager.copyText(value);
    if (ok) messageApi.success(t('copied'));
  }, [t, messageApi]);

  const getQrBlob = useCallback(async (): Promise<Blob | null> => {
    const canvas = qrRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (canvas) return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const svgEl = qrRef.current?.querySelector('svg') as SVGSVGElement | null;
    if (!svgEl) return null;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    return new Promise<Blob | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const cvs = document.createElement('canvas');
        cvs.width = QR_SIZE;
        cvs.height = QR_SIZE;
        const ctx = cvs.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(url); resolve(null); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, QR_SIZE, QR_SIZE);
        ctx.drawImage(img, 0, 0, QR_SIZE, QR_SIZE);
        URL.revokeObjectURL(url);
        cvs.toBlob((blob) => resolve(blob), 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }, []);

  const copyImage = useCallback(async () => {
    const blob = await getQrBlob();
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      messageApi.success(t('copiedQrImage'));
    } catch {
      messageApi.error(t('copyFailed') !== 'copyFailed' ? t('copyFailed') : 'Copy failed');
    }
  }, [getQrBlob, messageApi, t]);

  const open = useCallback((url: string) => {
    if (!url) return;
    window.open(url, '_blank');
  }, []);

  const shadowrocketUrl = useMemo(() => {
    if (!subUrl) return '';
    const separator = subUrl.includes('?') ? '&' : '?';
    const rawUrl = subUrl + separator + 'flag=shadowrocket';
    const base64Url = btoa(rawUrl).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const remark = encodeURIComponent(subTitle || 'Subscription');
    return `shadowrocket://add/sub/${base64Url}?remark=${remark}`;
  }, []);

  const v2boxUrl = useMemo(
    () => `v2box://install-sub?url=${encodeURIComponent(subUrl)}&name=${encodeURIComponent(subTitle || 'Sub')}`,
    [],
  );
  const streisandUrl = useMemo(() => `streisand://import/${encodeURIComponent(subUrl)}`, []);
  const happUrl = useMemo(() => `happ://add/${subUrl}`, []);

  const pageClass = useMemo(() => {
    const classes = ['subscription-page'];
    if (isDark) classes.push('is-dark');
    if (isUltra) classes.push('is-ultra');
    return classes.join(' ');
  }, [isDark, isUltra]);

  const usedBytes = downloadByte + uploadByte;
  const remaining = totalByte > 0 ? Math.max(0, totalByte - usedBytes) : 0;
  const isUnlimited = totalByte <= 0 && expireMs === 0;
  const isActive = enabled
    && (totalByte <= 0 || usedBytes < totalByte)
    && (expireMs <= 0 || Date.now() < expireMs);

  const intervalDisplay = useMemo(() => {
    const totalHours = parseInt(updateInterval) || 0;
    if (totalHours <= 0) return '';
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}${t('subIntervalDays')}`);
    if (hours > 0) parts.push(`${hours}${t('subIntervalHours')}`);
    return parts.join(' ');
  }, [updateInterval, t]);

  const displayContent = useMemo(() => {
    const raw = links.join('\n');
    if (!raw) return '';
    if (format === 'json') {
      try { return JSON.stringify(JSON.parse(raw), null, 2); }
      catch { return raw; }
    }
    return raw;
  }, [links, format]);

  const descriptionsItems = useMemo(() => {
    const items = [
      {
        key: 'status',
        label: t('subscription.status'),
        children: !enabled
          ? <Tag color="red">{t('subscription.inactive')}</Tag>
          : isUnlimited
            ? <Tag color="purple">{t('subscription.unlimited')}</Tag>
            : <Tag color={isActive ? 'green' : 'red'}>
                {isActive ? t('subscription.active') : t('subscription.inactive')}
              </Tag>,
      },
      {
        key: 'clientCount',
        label: t('subClients'),
        children: clientCount,
      },
      {
        key: 'linkCount',
        label: t('subLinkCount'),
        children: linkCount,
      },
      {
        key: 'traffic',
        label: t('subscription.traffic'),
        children: (
          <Popover content={(
            <table cellPadding={2}>
              <tbody>
                <tr><td>{'↑'}</td><td>{SizeFormatter.sizeFormat(uploadByte)}</td></tr>
                <tr><td>{'↓'}</td><td>{SizeFormatter.sizeFormat(downloadByte)}</td></tr>
                {totalByte > 0 && usedBytes < totalByte && (
                  <tr><td>{t('remained')}</td><td>{SizeFormatter.sizeFormat(remaining)}</td></tr>
                )}
              </tbody>
            </table>
          )}>
            <Tag color={ColorUtils.usageColor(usedBytes, 0, totalByte)}>
              {SizeFormatter.sizeFormat(usedBytes)} /{' '}
              {totalByte > 0 ? SizeFormatter.sizeFormat(totalByte) : <InfinityIcon />}
            </Tag>
          </Popover>
        ),
      },
      {
        key: 'expiry',
        label: t('subscription.expiry'),
        children: expireMs === 0
          ? t('subscription.noExpiry')
          : IntlUtil.formatDate(expireMs, datepicker),
      },
    ];
    if (updateInterval !== '0') {
      items.push({
        key: 'updInterval',
        label: t('subscription.updateInterval'),
        children: intervalDisplay,
      });
    }
    items.push({
      key: 'onlineCount',
      label: t('subscription.onlineCount'),
      children: callCount > 0 ? callCount : '-',
    });
    items.push({
      key: 'lastOnline',
      label: t('subscription.lastOnlineTime'),
      children: lastOnlineMs > 0 ? IntlUtil.formatDate(lastOnlineMs, datepicker) : '-',
    });
    return items;
  }, [t, isActive, isUnlimited, usedBytes, uploadByte, downloadByte, totalByte, remaining, intervalDisplay]);

  const androidMenuItems = useMemo(() => [
    {
      key: 'android-v2box',
      label: 'V2Box',
      onClick: () => open(`v2box://install-sub?url=${encodeURIComponent(subUrl)}&name=${encodeURIComponent(subTitle || 'Sub')}`),
    },
    {
      key: 'android-v2rayng',
      label: 'V2RayNG',
      onClick: () => open(`v2rayng://install-config?url=${encodeURIComponent(subUrl)}`),
    },
    { key: 'android-singbox', label: 'Sing-box', onClick: () => copy(subUrl) },
    { key: 'android-v2raytun', label: 'V2RayTun', onClick: () => copy(subUrl) },
    { key: 'android-npvtunnel', label: 'NPV Tunnel', onClick: () => copy(subUrl) },
    { key: 'android-happ', label: 'Happ', onClick: () => open(`happ://add/${subUrl}`) },
  ], [copy, open]);

  const iosMenuItems = useMemo(() => [
    { key: 'ios-shadowrocket', label: 'Shadowrocket', onClick: () => open(shadowrocketUrl) },
    { key: 'ios-v2box', label: 'V2Box', onClick: () => open(v2boxUrl) },
    { key: 'ios-streisand', label: 'Streisand', onClick: () => open(streisandUrl) },
    { key: 'ios-v2raytun', label: 'V2RayTun', onClick: () => copy(subUrl) },
    { key: 'ios-npvtunnel', label: 'NPV Tunnel', onClick: () => copy(subUrl) },
    { key: 'ios-happ', label: 'Happ', onClick: () => open(happUrl) },
  ], [copy, open, shadowrocketUrl, v2boxUrl, streisandUrl, happUrl]);

  const langMenuItems = useMemo(
    () => LanguageManager.supportedLanguages.map((l: { value: string; name: string; icon: string }) => ({
      key: l.value,
      icon: <span>{l.icon}</span>,
      label: l.name,
    })),
    [],
  );

  const currentLang = useMemo(
    () => LanguageManager.supportedLanguages.find((l) => l.value === lang),
    [lang],
  );

  const themeIcon = !isDark ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  ) : !isUltra ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      <path fill="none" d="M19 3l0.7 1.4 1.4 0.7-1.4 0.7L19 7.2l-0.7-1.4-1.4-0.7 1.4-0.7z" />
    </svg>
  );

  const displayTitle = remark || subTitle || '';
  const cardTitle = (
    <Space>
      {displayTitle && <span style={{ fontSize: 18, fontWeight: 600 }}>{displayTitle}</span>}
      {format && <Tag color="blue">{format}</Tag>}
    </Space>
  );

  const cardExtra = (
    <Space size={8} align="center">
      <Dropdown
        trigger={['click']}
        menu={{
          items: langMenuItems,
          onClick: ({ key }) => onLangChange(key),
        }}
      >
        <Button size="small">
          {currentLang?.icon} {currentLang?.name} <DownOutlined />
        </Button>
      </Dropdown>
      <button
        type="button"
        id="sub-theme-cycle"
        className="theme-cycle"
        aria-label={t('menu.theme')}
        title={t('menu.theme')}
        onClick={cycleTheme}
      >
        {themeIcon}
      </button>
    </Space>
  );

  return (
    <ConfigProvider theme={antdThemeConfig}>
      {messageContextHolder}
      <Layout className={pageClass}>
        <Layout.Content className="content">
          <Row justify="center">
            <Col xs={24} sm={23} md={22} lg={20} xl={18}>
              <Card className="subscription-card" title={cardTitle} extra={cardExtra}>
                <Row gutter={24}>
                  <Col xs={24} md={13}>
                    <Descriptions
                      bordered
                      column={1}
                      size="small"
                      className="info-table"
                      items={descriptionsItems}
                    />
                  </Col>

                  <Col xs={24} md={11} className="qr-col">
                    <div ref={qrRef} className="qr-box">
                      <QRCode
                        className="qr-code"
                        value={subUrl}
                        size={QR_SIZE}
                        type="canvas"
                        bordered={false}
                        color={isDark || isUltra ? '#fff' : '#000'}
                        bgColor={isUltra ? '#0c0e12' : isDark ? '#252526' : '#ffffff'}
                        title={t('clickToCopyImage')}
                        onClick={copyImage}
                      />
                    </div>
                  </Col>
                </Row>

                <Space className="quick-actions" size={32}>
                  <Button type="primary" icon={<LinkOutlined />} onClick={() => copy(subUrl)}>
                    {t('subscription.copyLink')}
                  </Button>
                  {subSupportUrl && (
                    <Button icon={<QuestionCircleOutlined />} onClick={() => open(subSupportUrl)}>
                      {t('subscription.supportLink')}
                    </Button>
                  )}
                  {subProfileUrl && (
                    <Button icon={<UserOutlined />} onClick={() => open(subProfileUrl)}>
                      {t('subscription.profileLink')}
                    </Button>
                  )}
                </Space>

                {announce && (
                  <Alert
                    type="warning"
                    message={announce}
                    showIcon
                    className="announce-box"
                  />
                )}

                {displayContent && (
                  <div className="links-section">
                    <div className="link-box">
                      <CopyOutlined className="link-copy-icon" onClick={() => copy(displayContent)} />
                      <pre className="content-pre">{displayContent}</pre>
                    </div>
                  </div>
                )}

                <Row gutter={[8, 8]} justify="center" className="apps-row">
                  <Col xs={24} sm={12} className="app-col">
                    <Dropdown trigger={['click']} menu={{ items: androidMenuItems }}>
                      <Button block={isMobile} size="large" type="primary">
                        <AndroidOutlined /> Android <DownOutlined />
                      </Button>
                    </Dropdown>
                  </Col>
                  <Col xs={24} sm={12} className="app-col">
                    <Dropdown trigger={['click']} menu={{ items: iosMenuItems }}>
                      <Button block={isMobile} size="large" type="primary">
                        <AppleOutlined /> iOS <DownOutlined />
                      </Button>
                    </Dropdown>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
}
