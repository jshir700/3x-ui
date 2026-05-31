import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Row,
  Select,
  Switch,
  Tabs,
} from 'antd';

import DateTimePicker from '@/components/DateTimePicker';
import { HttpUtil } from '@/utils';
import { Protocols, TLS_FLOW_CONTROL } from '@/schemas/primitives';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

interface BatchEditModalProps {
  open: boolean;
  onClose: () => void;
  inbounds: any[];
  onDone: () => void;
}

function inboundDisplay(ib: any): string {
  return ib.remark || ib.tag || `#${ib.id}`;
}

function fmtField(ib: any, fn: (ib: any) => any, trueLabel?: string, falseLabel?: string, notSetLabel: string = '未设置'): string {
  const v = fn(ib);
  if (typeof v === 'boolean') return v ? (trueLabel || '✓') : (falseLabel || '✗');
  if (v === null || v === undefined || v === '') return notSetLabel;
  if (v === 0) return '0';
  return String(v);
}

export default function BatchEditModal({
  open,
  onClose,
  inbounds,
  onDone,
}: BatchEditModalProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState('general');
  const initializedRef = useRef(false);

  // General
  const [externalAddrType, setExternalAddrType] = useState<string | null>(null);
  const [externalAddrCustom, setExternalAddrCustom] = useState<string | null>(null);
  const [externalAddrTls, setExternalAddrTls] = useState<boolean | null>(null);
  const [externalPort, setExternalPort] = useState<number | null>(null);
  const [trafficReset, setTrafficReset] = useState<string | null>(null);
  const [totalGB, setTotalGB] = useState<number | null>(null);
  const [expiryTime, setExpiryTime] = useState<Dayjs | null>(null);
  const [enable, setEnable] = useState<boolean | null>(null);

  // TCP
  const [tcpHttpCamouflage, setTcpHttpCamouflage] = useState<boolean | null>(null);

  // WebSocket
  const [wsHost, setWsHost] = useState<string | null>(null);
  const [wsPath, setWsPath] = useState<string | null>(null);
  const [wsHeartbeat, setWsHeartbeat] = useState<number | null>(null);

  // gRPC
  const [grpcServiceName, setGrpcServiceName] = useState<string | null>(null);
  const [grpcAuthority, setGrpcAuthority] = useState<string | null>(null);
  const [grpcMultiMode, setGrpcMultiMode] = useState<boolean | null>(null);

  // HTTPUpgrade
  const [huHost, setHuHost] = useState<string | null>(null);
  const [huPath, setHuPath] = useState<string | null>(null);

  // xHTTP
  const [xhHost, setXhHost] = useState<string | null>(null);
  const [xhPath, setXhPath] = useState<string | null>(null);
  const [xhMode, setXhMode] = useState<string | null>(null);
  const [xhNoSseHeader, setXhNoSseHeader] = useState<boolean | null>(null);

  // KCP
  const [kcpSeed, setKcpSeed] = useState<string | null>(null);
  const [kcpMtu, setKcpMtu] = useState<number | null>(null);
  const [kcpTti, setKcpTti] = useState<number | null>(null);
  const [kcpUpCap, setKcpUpCap] = useState<number | null>(null);
  const [kcpDownCap, setKcpDownCap] = useState<number | null>(null);
  const [kcpReadBuf, setKcpReadBuf] = useState<number | null>(null);
  const [kcpWriteBuf, setKcpWriteBuf] = useState<number | null>(null);
  const [kcpHeaderType, setKcpHeaderType] = useState<string | null>(null);

  // Hysteria
  const [hyVersion, setHyVersion] = useState<number | null>(null);
  const [hyAuth, setHyAuth] = useState<string | null>(null);
  const [hyUdpIdle, setHyUdpIdle] = useState<number | null>(null);
  const [hyMasqueradeSwitch, setHyMasqueradeSwitch] = useState<boolean | null>(null);
  const [hyMasqueradeType, setHyMasqueradeType] = useState<string | null>(null);
  const [hyClearUdpMasks, setHyClearUdpMasks] = useState<boolean>(false);
  const [hyQuicParamsSwitch, setHyQuicParamsSwitch] = useState<boolean | null>(null);
  const [hyQuicCongestion, setHyQuicCongestion] = useState<string | null>(null);
  const [hyQuicDebug, setHyQuicDebug] = useState<boolean | null>(null);
  const [hyQuicBrutalUp, setHyQuicBrutalUp] = useState<number | null>(null);
  const [hyQuicBrutalDown, setHyQuicBrutalDown] = useState<number | null>(null);
  const [hyQuicUdpHopSwitch, setHyQuicUdpHopSwitch] = useState<boolean | null>(null);
  const [hyQuicUdpHopPorts, setHyQuicUdpHopPorts] = useState<string | null>(null);
  const [hyQuicUdpHopInterval, setHyQuicUdpHopInterval] = useState<string | null>(null);
  const [hyQuicInitStreamRecv, setHyQuicInitStreamRecv] = useState<number | null>(null);
  const [hyQuicMaxStreamRecv, setHyQuicMaxStreamRecv] = useState<number | null>(null);
  const [hyQuicInitConnRecv, setHyQuicInitConnRecv] = useState<number | null>(null);
  const [hyQuicMaxConnRecv, setHyQuicMaxConnRecv] = useState<number | null>(null);
  const [hyQuicMaxIdleTimeout, setHyQuicMaxIdleTimeout] = useState<number | null>(null);
  const [hyQuicKeepAlive, setHyQuicKeepAlive] = useState<number | null>(null);
  const [hyQuicDisableMtu, setHyQuicDisableMtu] = useState<boolean | null>(null);
  const [hyQuicMaxIncoming, setHyQuicMaxIncoming] = useState<number | null>(null);

  // TLS
  const [tlsSni, setTlsSni] = useState<string | null>(null);
  const [tlsMinVer, setTlsMinVer] = useState<string | null>(null);
  const [tlsMaxVer, setTlsMaxVer] = useState<string | null>(null);
  const [tlsCiphers, setTlsCiphers] = useState<string | null>(null);
  const [tlsRejectUnknownSni, setTlsRejectUnknownSni] = useState<boolean | null>(null);
  const [tlsDisableSystemRoot, setTlsDisableSystemRoot] = useState<boolean | null>(null);
  const [tlsSessionResumption, setTlsSessionResumption] = useState<boolean | null>(null);
  const [tlsAlpn, setTlsAlpn] = useState<string[] | null>(null);

  // Reality
  const [realSni, setRealSni] = useState<string | null>(null);
  const [realPubkey, setRealPubkey] = useState<string | null>(null);
  const [realShortId, setRealShortId] = useState<string | null>(null);
  const [realSpiderX, setRealSpiderX] = useState<string | null>(null);
  const [realMldsa, setRealMldsa] = useState<boolean | null>(null);

  // VLESS
  const [vlessDecryption, setVlessDecryption] = useState<string | null>(null);
  const [vlessEncryption, setVlessEncryption] = useState<string | null>(null);
  const [clearFallbacks, setClearFallbacks] = useState<boolean>(false);
  const [flowControl, setFlowControl] = useState<string | null>(null);

  // Sockopt
  const [sockoptEnabled, setSockoptEnabled] = useState<boolean>(false);

  // Intersections
  const protocols = useMemo(() => [...new Set(inbounds.map((ib: any) => ib.protocol))], [inbounds]);
  const networks = useMemo(() => [...new Set(inbounds.map((ib: any) => ib.toInbound().stream.network).filter(Boolean))], [inbounds]);
  const securities = useMemo(() => [...new Set(inbounds.map((ib: any) => ib.toInbound().stream.security).filter(Boolean))], [inbounds]);

  const hasNetwork = useCallback((net: string) => networks.includes(net), [networks]);
  const hasSecurity = useCallback((sec: string) => securities.includes(sec), [securities]);
  const hasProtocol = useCallback((p: string) => protocols.includes(p), [protocols]);

  const canStream = useMemo(() => inbounds.every((ib: any) => ib.toInbound().canEnableStream()), [inbounds]);
  const hasNetworkTab = networks.length > 0;
  const hasSecurityTab = securities.length > 0;
  const hasProtocolTab = useMemo(() => {
    if (hasProtocol(Protocols.VLESS)) return true;
    if ((hasProtocol(Protocols.VLESS) || hasProtocol(Protocols.TROJAN)) && hasSecurity('tls') && hasNetwork('tcp')) return true;
    if (canStream) return true;
    return false;
  }, [hasProtocol, hasSecurity, hasNetwork, canStream]);

  // Current value helpers
  const currentValues = useCallback((fn: (ib: any) => any, trueLabel?: string, falseLabel?: string): string => {
    const notSet = t('pages.inbounds.batchEditNotSet');
    const parts = inbounds.map((ib: any) => `${inboundDisplay(ib)}: ${fmtField(ib, fn, trueLabel, falseLabel, notSet)}`);
    if (parts.length <= 5) return parts.join('\n');
    return parts.slice(0, 5).join('\n') + `\n...${t('pages.inbounds.batchEditAndMore', { count: parts.length - 5 }) ?? ` and ${parts.length - 5} more`}`;
  }, [inbounds, t]);

  const currentValuesForNetwork = useCallback((net: string, fn: (ib: any) => any, trueLabel?: string, falseLabel?: string): string => {
    const notSet = t('pages.inbounds.batchEditNotSet');
    const filtered = inbounds.filter((ib: any) => ib.toInbound().stream.network === net);
    if (filtered.length === 0) return t('none');
    return filtered.map((ib: any) => `${inboundDisplay(ib)}: ${fmtField(ib, fn, trueLabel, falseLabel, notSet)}`).join('\n');
  }, [inbounds, t]);

  const currentValuesForSecurity = useCallback((sec: string, fn: (ib: any) => any, trueLabel?: string, falseLabel?: string): string => {
    const notSet = t('pages.inbounds.batchEditNotSet');
    const filtered = inbounds.filter((ib: any) => ib.toInbound().stream.security === sec);
    if (filtered.length === 0) return t('none');
    return filtered.map((ib: any) => `${inboundDisplay(ib)}: ${fmtField(ib, fn, trueLabel, falseLabel, notSet)}`).join('\n');
  }, [inbounds, t]);

  const flowCurrentValues = useMemo(() => {
    const none = t('none');
    const parts: string[] = [];
    for (const ib of inbounds) {
      if ((ib as any).protocol !== Protocols.VLESS) continue;
      const inbound = (ib as any).toInbound();
      if (inbound.stream.network !== 'tcp') continue;
      if (!['tls', 'reality'].includes(inbound.stream.security)) continue;
      for (const c of (inbound.clients || [])) {
        parts.push(`${inboundDisplay(ib)} / ${c.email || c.id || '?'}: ${c.flow || `(${none})`}`);
      }
    }
    return parts.length > 0 ? parts.join('\n') : t('pages.inbounds.batchEditNoMatchingInbounds');
  }, [inbounds, t]);

  function isIndeterminate(v: any): boolean {
    return v === null || v === undefined;
  }

  const resetForm = useCallback(() => {
    setExternalAddrType(null);
    setExternalAddrCustom(null);
    setExternalAddrTls(null);
    setExternalPort(null);
    setTrafficReset(null);
    setTotalGB(null);
    setExpiryTime(null);
    setEnable(null);
    setTcpHttpCamouflage(null);
    setWsHost(null); setWsPath(null); setWsHeartbeat(null);
    setGrpcServiceName(null); setGrpcAuthority(null); setGrpcMultiMode(null);
    setHuHost(null); setHuPath(null);
    setXhHost(null); setXhPath(null); setXhMode(null); setXhNoSseHeader(null);
    setKcpSeed(null); setKcpMtu(null); setKcpTti(null); setKcpUpCap(null); setKcpDownCap(null);
    setKcpReadBuf(null); setKcpWriteBuf(null); setKcpHeaderType(null);
    setHyVersion(null); setHyAuth(null); setHyUdpIdle(null);
    setHyMasqueradeSwitch(null); setHyMasqueradeType(null); setHyClearUdpMasks(false);
    setHyQuicParamsSwitch(null); setHyQuicCongestion(null); setHyQuicDebug(null);
    setHyQuicBrutalUp(null); setHyQuicBrutalDown(null);
    setHyQuicUdpHopSwitch(null); setHyQuicUdpHopPorts(null); setHyQuicUdpHopInterval(null);
    setHyQuicInitStreamRecv(null); setHyQuicMaxStreamRecv(null);
    setHyQuicInitConnRecv(null); setHyQuicMaxConnRecv(null);
    setHyQuicMaxIdleTimeout(null); setHyQuicKeepAlive(null);
    setHyQuicDisableMtu(null); setHyQuicMaxIncoming(null);
    setTlsSni(null); setTlsMinVer(null); setTlsMaxVer(null); setTlsCiphers(null);
    setTlsRejectUnknownSni(null); setTlsDisableSystemRoot(null);
    setTlsSessionResumption(null); setTlsAlpn(null);
    setRealSni(null); setRealPubkey(null); setRealShortId(null);
    setRealSpiderX(null); setRealMldsa(null);
    setVlessDecryption(null); setVlessEncryption(null);
    setClearFallbacks(false); setFlowControl(null);
    setSockoptEnabled(false);
  }, []);

  useEffect(() => {
    if (!open) { initializedRef.current = false; return; }
    if (initializedRef.current) return;
    initializedRef.current = true;
    resetForm();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => onClose(), [onClose]);

  const submit = useCallback(async () => {
    setSaving(true);
    try {
      for (const dbInbound of inbounds) {
        const inbound = (dbInbound as any).toInbound();

        // Apply db-level fields
        if (externalAddrType != null) {
          if (externalAddrType === 'custom' && externalAddrCustom != null) {
            dbInbound.externalAddr = externalAddrCustom;
          } else if (externalAddrType === 'panel') {
            dbInbound.externalAddr = '';
          } else if (externalAddrType === 'none') {
            dbInbound.externalAddr = '';
          }
        }
        if (externalPort != null) {
          dbInbound.externalPort = externalPort || null;
        }
        if (externalAddrTls != null) {
          dbInbound.externalAddrTls = externalAddrTls;
        }
        if (trafficReset != null) {
          dbInbound.trafficReset = trafficReset;
        }
        if (totalGB != null) {
          dbInbound.totalGB = Number(totalGB);
        }
        if (expiryTime != null) {
          dbInbound.expiryTime = expiryTime ? expiryTime.valueOf() : 0;
        }
        if (enable != null) {
          dbInbound.enable = enable;
        }

        const stream = inbound.stream;

        // TCP
        if (hasNetwork('tcp') && tcpHttpCamouflage != null) {
          stream.tcp.type = tcpHttpCamouflage ? 'http' : 'none';
        }
        // WS
        if (hasNetwork('ws')) {
          if (wsHost != null) stream.ws.host = wsHost;
          if (wsPath != null) stream.ws.path = wsPath;
          if (wsHeartbeat != null && wsHeartbeat !== 0) stream.ws.heartbeatPeriod = Number(wsHeartbeat);
        }
        // gRPC
        if (hasNetwork('grpc')) {
          if (grpcServiceName != null) stream.grpc.serviceName = grpcServiceName;
          if (grpcAuthority != null) stream.grpc.authority = grpcAuthority;
          if (grpcMultiMode != null) stream.grpc.multiMode = grpcMultiMode;
        }
        // HTTPUpgrade
        if (hasNetwork('httpupgrade')) {
          if (huHost != null) stream.httpupgrade.host = huHost;
          if (huPath != null) stream.httpupgrade.path = huPath;
        }
        // xHTTP
        if (hasNetwork('xhttp')) {
          if (xhHost != null) stream.xhttp.host = xhHost;
          if (xhPath != null) stream.xhttp.path = xhPath;
          if (xhMode != null) stream.xhttp.mode = xhMode;
          if (xhNoSseHeader != null) stream.xhttp.noSSEHeader = xhNoSseHeader;
        }
        // KCP
        if (hasNetwork('kcp')) {
          if (kcpSeed != null) stream.kcp.seed = kcpSeed;
          if (kcpMtu != null && kcpMtu !== 0) stream.kcp.mtu = Number(kcpMtu);
          if (kcpTti != null && kcpTti !== 0) stream.kcp.tti = Number(kcpTti);
          if (kcpUpCap != null && kcpUpCap !== 0) stream.kcp.uplinkCapacity = Number(kcpUpCap);
          if (kcpDownCap != null && kcpDownCap !== 0) stream.kcp.downlinkCapacity = Number(kcpDownCap);
          if (kcpReadBuf != null && kcpReadBuf !== 0) stream.kcp.readBufferSize = Number(kcpReadBuf);
          if (kcpWriteBuf != null && kcpWriteBuf !== 0) stream.kcp.writeBufferSize = Number(kcpWriteBuf);
          if (kcpHeaderType != null) stream.kcp.headerType = kcpHeaderType;
        }
        // Hysteria
        if (hasNetwork('hysteria')) {
          if (hyVersion != null) stream.hysteria.version = Number(hyVersion);
          if (hyAuth != null) stream.hysteria.auth = hyAuth;
          if (hyUdpIdle != null && hyUdpIdle !== 0) stream.hysteria.udpIdleTimeout = Number(hyUdpIdle);
          if (hyMasqueradeSwitch != null) stream.hysteria.masqueradeSwitch = hyMasqueradeSwitch;
          if (hyMasqueradeType != null && stream.hysteria.masquerade) stream.hysteria.masquerade.type = hyMasqueradeType;
          if (hyClearUdpMasks) stream.finalmask.udp = [];
          if (hyQuicParamsSwitch != null) stream.finalmask.enableQuicParams = hyQuicParamsSwitch;
          if (hyQuicParamsSwitch && stream.finalmask.quicParams) {
            const qp = stream.finalmask.quicParams;
            if (hyQuicCongestion != null) qp.congestion = hyQuicCongestion;
            if (hyQuicDebug != null) qp.debug = hyQuicDebug;
            if (hyQuicBrutalUp != null && hyQuicBrutalUp !== 0) qp.brutalUp = Number(hyQuicBrutalUp);
            if (hyQuicBrutalDown != null && hyQuicBrutalDown !== 0) qp.brutalDown = Number(hyQuicBrutalDown);
            if (hyQuicUdpHopSwitch != null) qp.hasUdpHop = hyQuicUdpHopSwitch;
            if (hyQuicUdpHopPorts != null && qp.udpHop) qp.udpHop.ports = hyQuicUdpHopPorts;
            if (hyQuicUdpHopInterval != null && qp.udpHop) qp.udpHop.interval = hyQuicUdpHopInterval;
            if (hyQuicInitStreamRecv != null && hyQuicInitStreamRecv !== 0) qp.initStreamReceiveWindow = Number(hyQuicInitStreamRecv);
            if (hyQuicMaxStreamRecv != null && hyQuicMaxStreamRecv !== 0) qp.maxStreamReceiveWindow = Number(hyQuicMaxStreamRecv);
            if (hyQuicInitConnRecv != null && hyQuicInitConnRecv !== 0) qp.initConnectionReceiveWindow = Number(hyQuicInitConnRecv);
            if (hyQuicMaxConnRecv != null && hyQuicMaxConnRecv !== 0) qp.maxConnectionReceiveWindow = Number(hyQuicMaxConnRecv);
            if (hyQuicMaxIdleTimeout != null && hyQuicMaxIdleTimeout !== 0) qp.maxIdleTimeout = Number(hyQuicMaxIdleTimeout);
            if (hyQuicKeepAlive != null && hyQuicKeepAlive !== 0) qp.keepAlivePeriod = Number(hyQuicKeepAlive);
            if (hyQuicDisableMtu != null) qp.disablePathMTUDiscovery = hyQuicDisableMtu;
            if (hyQuicMaxIncoming != null && hyQuicMaxIncoming !== 0) qp.maxIncomingStreams = Number(hyQuicMaxIncoming);
          }
        }
        // TLS
        if (hasSecurity('tls')) {
          if (tlsSni != null) stream.tls.sni = tlsSni;
          if (tlsMinVer != null) stream.tls.minVersion = tlsMinVer;
          if (tlsMaxVer != null) stream.tls.maxVersion = tlsMaxVer;
          if (tlsCiphers != null) stream.tls.cipherSuites = tlsCiphers;
          if (tlsRejectUnknownSni != null) stream.tls.rejectUnknownSni = tlsRejectUnknownSni;
          if (tlsDisableSystemRoot != null) stream.tls.disableSystemRoot = tlsDisableSystemRoot;
          if (tlsSessionResumption != null) stream.tls.enableSessionResumption = tlsSessionResumption;
          if (tlsAlpn != null && tlsAlpn.length > 0) stream.tls.alpn = tlsAlpn;
        }
        // Reality
        if (hasSecurity('reality')) {
          if (realSni != null) stream.reality.serverName = realSni;
          if (realPubkey != null) stream.reality.publicKey = realPubkey;
          if (realShortId != null) stream.reality.shortId = realShortId;
          if (realSpiderX != null) stream.reality.spiderX = realSpiderX;
          if (realMldsa != null) stream.reality.mldsa65Verify = realMldsa;
        }
        // VLESS
        if (inbound.protocol === Protocols.VLESS || hasProtocol(Protocols.VLESS)) {
          if (vlessDecryption != null && inbound.settings.vlesses) {
            inbound.settings.decryption = vlessDecryption;
          }
          if (vlessEncryption != null && inbound.settings.vlesses) {
            inbound.settings.encryption = vlessEncryption;
          }
          if (clearFallbacks && inbound.settings.fallbacks) {
            inbound.settings.fallbacks = [];
          }
          if (flowControl != null && inbound.settings.vlesses) {
            for (const v of inbound.settings.vlesses) {
              v.flow = flowControl;
            }
          }
        }
        // Trojan fallbacks
        if (clearFallbacks && inbound.settings.trojans && inbound.settings.fallbacks) {
          inbound.settings.fallbacks = [];
        }

        const payload = {
          up: dbInbound.up,
          down: dbInbound.down,
          total: dbInbound.total,
          remark: dbInbound.remark,
          enable: dbInbound.enable,
          expiryTime: dbInbound.expiryTime,
          listen: dbInbound.listen,
          port: dbInbound.port,
          protocol: inbound.protocol,
          settings: inbound.settings.toString(),
          streamSettings: inbound.stream.toString(),
          sniffing: inbound.sniffing.toString(),
          trafficReset: dbInbound.trafficReset,
          externalAddr: dbInbound.externalAddr,
          externalAddrTls: dbInbound.externalAddrTls,
          externalPort: dbInbound.externalPort,
        };

        await HttpUtil.post(`/panel/api/inbounds/update/${dbInbound.id}`, payload);
      }
      message.success(t('pages.inbounds.batchEditSaved'));
      onDone();
    } catch {
      message.error(t('pages.inbounds.batchEditPartialError'));
    } finally {
      setSaving(false);
    }
  }, [
    inbounds, hasNetwork, hasSecurity, hasProtocol,
    externalAddrType, externalAddrCustom, externalAddrTls, externalPort,
    trafficReset, totalGB, expiryTime, enable,
    tcpHttpCamouflage, wsHost, wsPath, wsHeartbeat,
    grpcServiceName, grpcAuthority, grpcMultiMode,
    huHost, huPath, xhHost, xhPath, xhMode, xhNoSseHeader,
    kcpSeed, kcpMtu, kcpTti, kcpUpCap, kcpDownCap, kcpReadBuf, kcpWriteBuf, kcpHeaderType,
    hyVersion, hyAuth, hyUdpIdle, hyMasqueradeSwitch, hyMasqueradeType,
    hyClearUdpMasks, hyQuicParamsSwitch, hyQuicCongestion, hyQuicDebug,
    hyQuicBrutalUp, hyQuicBrutalDown, hyQuicUdpHopSwitch, hyQuicUdpHopPorts,
    hyQuicUdpHopInterval, hyQuicInitStreamRecv, hyQuicMaxStreamRecv,
    hyQuicInitConnRecv, hyQuicMaxConnRecv, hyQuicMaxIdleTimeout, hyQuicKeepAlive,
    hyQuicDisableMtu, hyQuicMaxIncoming,
    tlsSni, tlsMinVer, tlsMaxVer, tlsCiphers, tlsRejectUnknownSni,
    tlsDisableSystemRoot, tlsSessionResumption, tlsAlpn,
    realSni, realPubkey, realShortId, realSpiderX, realMldsa,
    vlessDecryption, vlessEncryption, clearFallbacks, flowControl,
    onDone, t,
  ]);

  const curVals = (fn: (ib: any) => any, tl?: string, fl?: string) => (
    <div style={{ fontSize: 11, color: '#888', whiteSpace: 'pre-line', marginTop: 2, lineHeight: 1.4 }}>
      {currentValues(fn, tl, fl)}
    </div>
  );

  const curValsForNet = (net: string, fn: (ib: any) => any, tl?: string, fl?: string) => (
    <div style={{ fontSize: 11, color: '#888', whiteSpace: 'pre-line', marginTop: 2, lineHeight: 1.4 }}>
      {currentValuesForNetwork(net, fn, tl, fl)}
    </div>
  );

  const tabItems = [
    {
      key: 'general',
      label: t('pages.inbounds.batchEditTabGeneral'),
      children: (
        <Form layout="vertical" colon={false}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={t('pages.inbounds.externalAddress')}>
                <Select value={externalAddrType} allowClear placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(v) => setExternalAddrType(v ?? null)}>
                  <Select.Option value="">{t('pages.inbounds.batchEditKeepOriginal')}</Select.Option>
                  <Select.Option value="panel">{t('pages.inbounds.extAddrPanel')}</Select.Option>
                  <Select.Option value="custom">{t('pages.inbounds.extAddrCustom')}</Select.Option>
                  <Select.Option value="none">{t('pages.inbounds.extAddrNone')}</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('pages.inbounds.externalPort')}>
                <InputNumber value={externalPort} placeholder={t('pages.inbounds.batchEditKeepOriginal')} style={{ width: '100%' }} onChange={(v) => setExternalPort(v ?? null)} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label={t('pages.inbounds.externalTls')}>
                <Switch checked={externalAddrTls ?? false} indeterminate={isIndeterminate(externalAddrTls)} onChange={(v) => setExternalAddrTls(v)} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={t('pages.inbounds.trafficReset')}>
                <Select value={trafficReset} allowClear placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(v) => setTrafficReset(v ?? null)}>
                  <Select.Option value="">{t('pages.inbounds.batchEditKeepOriginal')}</Select.Option>
                  <Select.Option value="never">never</Select.Option>
                  <Select.Option value="hourly">hourly</Select.Option>
                  <Select.Option value="daily">daily</Select.Option>
                  <Select.Option value="weekly">weekly</Select.Option>
                  <Select.Option value="monthly">monthly</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={t('enabled')}>
                <Switch checked={enable ?? false} indeterminate={isIndeterminate(enable)} onChange={(v) => setEnable(v)} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={t('pages.clients.totalGB')}>
                <InputNumber value={totalGB} placeholder={t('pages.inbounds.batchEditKeepOriginal')} style={{ width: '100%' }} onChange={(v) => setTotalGB(v ?? null)} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('pages.clients.expiryTime')}>
                <DateTimePicker value={expiryTime} onChange={(v) => setExpiryTime(v)} showTime={false} placeholder={t('pages.inbounds.batchEditKeepOriginal')} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      ),
    },
    {
      key: 'network',
      label: t('pages.inbounds.batchEditTabNetwork'),
      disabled: !hasNetworkTab,
      children: (
        <Form layout="vertical" colon={false}>
          {hasNetwork('tcp') && (
            <Card size="small" title="TCP" style={{ marginBottom: 12 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label={t('pages.inbounds.batchEditHttpCamouflage')}>
                    <Switch checked={tcpHttpCamouflage ?? false} indeterminate={isIndeterminate(tcpHttpCamouflage)} onChange={(v) => setTcpHttpCamouflage(v)} />
                    {curValsForNet('tcp', (ib: any) => ib.toInbound().stream.tcp.type === 'http' ? `${t('enabled')}(http)` : `${t('disabled')}(none)`)}
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          )}

          {hasNetwork('ws') && (
            <Card size="small" title="WebSocket" style={{ marginBottom: 12 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditHost')}>
                    <Input value={wsHost ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setWsHost(e.target.value || null)} />
                    {curValsForNet('ws', (ib: any) => ib.toInbound().stream.ws.host)}
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditPath')}>
                    <Input value={wsPath ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setWsPath(e.target.value || null)} />
                    {curValsForNet('ws', (ib: any) => ib.toInbound().stream.ws.path)}
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditHeartbeat')}>
                    <InputNumber value={wsHeartbeat} placeholder={t('pages.inbounds.batchEditKeepOriginal')} style={{ width: '100%' }} onChange={(v) => setWsHeartbeat(v ?? null)} />
                    {curValsForNet('ws', (ib: any) => ib.toInbound().stream.ws.heartbeatPeriod)}
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          )}

          {hasNetwork('grpc') && (
            <Card size="small" title="gRPC" style={{ marginBottom: 12 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditServiceName')}>
                    <Input value={grpcServiceName ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setGrpcServiceName(e.target.value || null)} />
                    {curValsForNet('grpc', (ib: any) => ib.toInbound().stream.grpc.serviceName)}
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditAuthority')}>
                    <Input value={grpcAuthority ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setGrpcAuthority(e.target.value || null)} />
                    {curValsForNet('grpc', (ib: any) => ib.toInbound().stream.grpc.authority)}
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditMultiMode')}>
                    <Switch checked={grpcMultiMode ?? false} indeterminate={isIndeterminate(grpcMultiMode)} onChange={(v) => setGrpcMultiMode(v)} />
                    {curValsForNet('grpc', (ib: any) => ib.toInbound().stream.grpc.multiMode, t('enabled'), t('disabled'))}
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          )}

          {hasNetwork('httpupgrade') && (
            <Card size="small" title="HTTPUpgrade" style={{ marginBottom: 12 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label={t('pages.inbounds.batchEditHost')}>
                    <Input value={huHost ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setHuHost(e.target.value || null)} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={t('pages.inbounds.batchEditPath')}>
                    <Input value={huPath ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setHuPath(e.target.value || null)} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          )}

          {hasNetwork('xhttp') && (
            <Card size="small" title="xHTTP" style={{ marginBottom: 12 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label={t('pages.inbounds.batchEditHost')}>
                    <Input value={xhHost ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setXhHost(e.target.value || null)} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label={t('pages.inbounds.batchEditPath')}>
                    <Input value={xhPath ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setXhPath(e.target.value || null)} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label={t('pages.inbounds.batchEditMode')}>
                    <Select value={xhMode} allowClear placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(v) => setXhMode(v ?? null)}>
                      <Select.Option value="">{t('pages.inbounds.batchEditKeepOriginal')}</Select.Option>
                      <Select.Option value="auto">auto</Select.Option>
                      <Select.Option value="packet-one">packet-one</Select.Option>
                      <Select.Option value="stream-one">stream-one</Select.Option>
                      <Select.Option value="stream-two">stream-two</Select.Option>
                      <Select.Option value="stream-separate">stream-separate</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label={t('pages.inbounds.batchEditNoSseHeader')}>
                    <Switch checked={xhNoSseHeader ?? false} indeterminate={isIndeterminate(xhNoSseHeader)} onChange={(v) => setXhNoSseHeader(v)} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          )}

          {hasNetwork('kcp') && (
            <Card size="small" title="KCP" style={{ marginBottom: 12 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditSeed')}><Input value={kcpSeed ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setKcpSeed(e.target.value || null)} /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditMtu')}><InputNumber value={kcpMtu} placeholder={t('pages.inbounds.batchEditKeepOriginal')} style={{ width: '100%' }} onChange={(v) => setKcpMtu(v ?? null)} /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditTti')}><InputNumber value={kcpTti} placeholder={t('pages.inbounds.batchEditKeepOriginal')} style={{ width: '100%' }} onChange={(v) => setKcpTti(v ?? null)} /></Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditUplinkCap')}><InputNumber value={kcpUpCap} placeholder={t('pages.inbounds.batchEditKeepOriginal')} style={{ width: '100%' }} onChange={(v) => setKcpUpCap(v ?? null)} /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditDownlinkCap')}><InputNumber value={kcpDownCap} placeholder={t('pages.inbounds.batchEditKeepOriginal')} style={{ width: '100%' }} onChange={(v) => setKcpDownCap(v ?? null)} /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditHeaderType')}>
                    <Select value={kcpHeaderType} allowClear placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(v) => setKcpHeaderType(v ?? null)}>
                      <Select.Option value="">{t('pages.inbounds.batchEditKeepOriginal')}</Select.Option>
                      <Select.Option value="none">none</Select.Option>
                      <Select.Option value="dtls">dtls</Select.Option>
                      <Select.Option value="utp">utp</Select.Option>
                      <Select.Option value="wechat-video">wechat-video</Select.Option>
                      <Select.Option value="wireguard">wireguard</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          )}

          {hasNetwork('hysteria') && (
            <Card size="small" title="UDP / Hysteria" style={{ marginBottom: 12 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditVersion')}>
                    <Select value={hyVersion} allowClear placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(v) => setHyVersion(v ?? null)}>
                      <Select.Option value="">{t('pages.inbounds.batchEditKeepOriginal')}</Select.Option>
                      <Select.Option value={1}>1</Select.Option>
                      <Select.Option value={2}>2</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditAuth')}><Input value={hyAuth ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setHyAuth(e.target.value || null)} /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditUdpIdleTimeout')}>
                    <InputNumber value={hyUdpIdle} placeholder={t('pages.inbounds.batchEditKeepOriginal')} style={{ width: '100%' }} onChange={(v) => setHyUdpIdle(v ?? null)} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label={t('pages.inbounds.batchEditMasquerade')}>
                    <Switch checked={hyMasqueradeSwitch ?? false} indeterminate={isIndeterminate(hyMasqueradeSwitch)} onChange={(v) => setHyMasqueradeSwitch(v)} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label={t('pages.inbounds.batchEditMasqType')}>
                    <Select value={hyMasqueradeType} allowClear placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(v) => setHyMasqueradeType(v ?? null)}>
                      <Select.Option value="">{t('pages.inbounds.batchEditKeepOriginal')}</Select.Option>
                      <Select.Option value="proxy">proxy</Select.Option>
                      <Select.Option value="file">file</Select.Option>
                      <Select.Option value="string">string</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label={t('pages.inbounds.batchEditClearUdpMasks')}>
                    <Switch checked={hyClearUdpMasks} onChange={(v) => setHyClearUdpMasks(v)} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label={t('pages.inbounds.batchEditQuicParams')}>
                    <Switch checked={hyQuicParamsSwitch ?? false} indeterminate={isIndeterminate(hyQuicParamsSwitch)} onChange={(v) => setHyQuicParamsSwitch(v)} />
                  </Form.Item>
                </Col>
              </Row>
              {hyQuicParamsSwitch && (
                <>
                  <Divider style={{ margin: '8px 0' }}>{t('pages.inbounds.batchEditQuicParams')}</Divider>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label={t('pages.inbounds.batchEditCongestion')}>
                        <Select value={hyQuicCongestion} allowClear placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(v) => setHyQuicCongestion(v ?? null)}>
                          <Select.Option value="">{t('pages.inbounds.batchEditKeepOriginal')}</Select.Option>
                          <Select.Option value="bbr">bbr</Select.Option>
                          <Select.Option value="cubic">cubic</Select.Option>
                          <Select.Option value="brutal">brutal</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item label={t('pages.inbounds.batchEditDebug')}><Switch checked={hyQuicDebug ?? false} indeterminate={isIndeterminate(hyQuicDebug)} onChange={(v) => setHyQuicDebug(v)} /></Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item label={t('pages.inbounds.batchEditBrutalUp')}><InputNumber value={hyQuicBrutalUp} placeholder={t('pages.inbounds.batchEditKeepOriginal')} style={{ width: '100%' }} onChange={(v) => setHyQuicBrutalUp(v ?? null)} /></Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item label={t('pages.inbounds.batchEditBrutalDown')}><InputNumber value={hyQuicBrutalDown} placeholder={t('pages.inbounds.batchEditKeepOriginal')} style={{ width: '100%' }} onChange={(v) => setHyQuicBrutalDown(v ?? null)} /></Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={4}>
                      <Form.Item label={t('pages.inbounds.batchEditUdpHop')}><Switch checked={hyQuicUdpHopSwitch ?? false} indeterminate={isIndeterminate(hyQuicUdpHopSwitch)} onChange={(v) => setHyQuicUdpHopSwitch(v)} /></Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item label={t('pages.inbounds.batchEditHopPorts')}><Input value={hyQuicUdpHopPorts ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setHyQuicUdpHopPorts(e.target.value || null)} /></Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item label={t('pages.inbounds.batchEditHopInterval')}><Input value={hyQuicUdpHopInterval ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setHyQuicUdpHopInterval(e.target.value || null)} /></Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item label={t('pages.inbounds.batchEditMaxIdle')}><InputNumber value={hyQuicMaxIdleTimeout} placeholder={t('pages.inbounds.batchEditKeepOriginal')} style={{ width: '100%' }} onChange={(v) => setHyQuicMaxIdleTimeout(v ?? null)} /></Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item label={t('pages.inbounds.batchEditKeepAlive')}><InputNumber value={hyQuicKeepAlive} placeholder={t('pages.inbounds.batchEditKeepOriginal')} style={{ width: '100%' }} onChange={(v) => setHyQuicKeepAlive(v ?? null)} /></Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label={t('pages.inbounds.batchEditInitStreamRecv')}><InputNumber value={hyQuicInitStreamRecv} placeholder={t('pages.inbounds.batchEditKeepOriginal')} style={{ width: '100%' }} onChange={(v) => setHyQuicInitStreamRecv(v ?? null)} /></Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label={t('pages.inbounds.batchEditMaxStreamRecv')}><InputNumber value={hyQuicMaxStreamRecv} placeholder={t('pages.inbounds.batchEditKeepOriginal')} style={{ width: '100%' }} onChange={(v) => setHyQuicMaxStreamRecv(v ?? null)} /></Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label={t('pages.inbounds.batchEditMaxIncomingStreams')}><InputNumber value={hyQuicMaxIncoming} placeholder={t('pages.inbounds.batchEditKeepOriginal')} style={{ width: '100%' }} onChange={(v) => setHyQuicMaxIncoming(v ?? null)} /></Form.Item>
                    </Col>
                  </Row>
                </>
              )}
            </Card>
          )}
        </Form>
      ),
    },
    {
      key: 'security',
      label: t('pages.inbounds.batchEditTabSecurity'),
      disabled: !hasSecurityTab,
      children: (
        <Form layout="vertical" colon={false}>
          {hasSecurity('tls') && (
            <Card size="small" title="TLS" style={{ marginBottom: 12 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="SNI"><Input value={tlsSni ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setTlsSni(e.target.value || null)} /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditMinVersion')}>
                    <Select value={tlsMinVer} allowClear placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(v) => setTlsMinVer(v ?? null)}>
                      <Select.Option value="">{t('pages.inbounds.batchEditKeepOriginal')}</Select.Option>
                      <Select.Option value="1.0">1.0</Select.Option>
                      <Select.Option value="1.1">1.1</Select.Option>
                      <Select.Option value="1.2">1.2</Select.Option>
                      <Select.Option value="1.3">1.3</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditMaxVersion')}>
                    <Select value={tlsMaxVer} allowClear placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(v) => setTlsMaxVer(v ?? null)}>
                      <Select.Option value="">{t('pages.inbounds.batchEditKeepOriginal')}</Select.Option>
                      <Select.Option value="1.0">1.0</Select.Option>
                      <Select.Option value="1.1">1.1</Select.Option>
                      <Select.Option value="1.2">1.2</Select.Option>
                      <Select.Option value="1.3">1.3</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditRejectUnknownSni')}>
                    <Switch checked={tlsRejectUnknownSni ?? false} indeterminate={isIndeterminate(tlsRejectUnknownSni)} onChange={(v) => setTlsRejectUnknownSni(v)} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditDisableSystemRoot')}>
                    <Switch checked={tlsDisableSystemRoot ?? false} indeterminate={isIndeterminate(tlsDisableSystemRoot)} onChange={(v) => setTlsDisableSystemRoot(v)} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditSessionResumption')}>
                    <Switch checked={tlsSessionResumption ?? false} indeterminate={isIndeterminate(tlsSessionResumption)} onChange={(v) => setTlsSessionResumption(v)} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label={t('pages.inbounds.batchEditAlpn')}>
                    <Select value={tlsAlpn} mode="multiple" allowClear placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(v) => setTlsAlpn(v.length > 0 ? v : null)}>
                      <Select.Option value="h2">h2</Select.Option>
                      <Select.Option value="h3">h3</Select.Option>
                      <Select.Option value="http/1.1">http/1.1</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={t('pages.inbounds.batchEditCipherSuites')}><Input value={tlsCiphers ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setTlsCiphers(e.target.value || null)} /></Form.Item>
                </Col>
              </Row>
            </Card>
          )}

          {hasSecurity('reality') && (
            <Card size="small" title="Reality" style={{ marginBottom: 12 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditServerName')}><Input value={realSni ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setRealSni(e.target.value || null)} /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditPublicKey')}><Input value={realPubkey ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setRealPubkey(e.target.value || null)} /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditShortId')}><Input value={realShortId ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setRealShortId(e.target.value || null)} /></Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditSpiderX')}><Input value={realSpiderX ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setRealSpiderX(e.target.value || null)} /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditMldsaVerify')}>
                    <Switch checked={realMldsa ?? false} indeterminate={isIndeterminate(realMldsa)} onChange={(v) => setRealMldsa(v)} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          )}
        </Form>
      ),
    },
    {
      key: 'protocol',
      label: t('pages.inbounds.batchEditTabProtocol'),
      disabled: !hasProtocolTab,
      children: (
        <Form layout="vertical" colon={false}>
          {hasProtocol(Protocols.VLESS) && (
            <Card size="small" title="VLESS" style={{ marginBottom: 12 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditDecryption')}><Input value={vlessDecryption ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setVlessDecryption(e.target.value || null)} /></Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditEncryption')}><Input value={vlessEncryption ?? ''} placeholder={t('pages.inbounds.batchEditKeepOriginal')} onChange={(e) => setVlessEncryption(e.target.value || null)} /></Form.Item>
                </Col>
              </Row>
            </Card>
          )}

          {(hasProtocol(Protocols.VLESS) || hasProtocol(Protocols.TROJAN)) && hasSecurity('tls') && hasNetwork('tcp') && (
            <Card size="small" title="Fallbacks" style={{ marginBottom: 12 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label={t('pages.inbounds.batchEditClearFallbacks')}>
                    <Switch checked={clearFallbacks} onChange={(v) => setClearFallbacks(v)} />
                    {curVals((ib: any) => { const fb = ib.toInbound().settings.fallbacks; return fb && fb.length ? String(fb.length) : t('none'); })}
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          )}

          {hasProtocol(Protocols.VLESS) && hasNetwork('tcp') && (hasSecurity('tls') || hasSecurity('reality')) && (
            <Card size="small" title={t('pages.inbounds.batchEditFlow')} style={{ marginBottom: 12 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label={t('pages.inbounds.batchEditFlow')}>
                    <Select value={flowControl} allowClear placeholder={t('pages.inbounds.batchEditKeepClientOriginals')} onChange={(v) => setFlowControl(v ?? null)}>
                      <Select.Option value="">{t('pages.inbounds.batchEditKeepOriginal')}</Select.Option>
                      <Select.Option value={TLS_FLOW_CONTROL.VISION}>xtls-rprx-vision</Select.Option>
                      <Select.Option value={TLS_FLOW_CONTROL.VISION_UDP443}>xtls-rprx-vision-udp443</Select.Option>
                    </Select>
                    <div style={{ fontSize: 11, color: '#888', whiteSpace: 'pre-line', marginTop: 2, lineHeight: 1.4 }}>{flowCurrentValues}</div>
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          )}

          {canStream && (
            <Card size="small" title="Sockopt" style={{ marginBottom: 12 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label={t('pages.inbounds.batchEditEnableSockopt')}>
                    <Switch checked={sockoptEnabled} onChange={(v) => setSockoptEnabled(v)} />
                    <div style={{ color: '#999', fontSize: 12 }}>
                      {t('pages.inbounds.batchEditSockoptHint')}
                    </div>
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          )}
        </Form>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      title={t('pages.inbounds.batchEditInbounds')}
      width={800}
      confirmLoading={saving}
      okText={t('pages.inbounds.batchEditApply')}
      cancelText={t('cancel')}
      onOk={submit}
      onCancel={handleClose}
      maskClosable={false}
      destroyOnHidden
    >
      <Tabs activeKey={activeTabKey} onChange={(k) => setActiveTabKey(k)} items={tabItems} />
    </Modal>
  );
}
