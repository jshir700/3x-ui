<script setup>
import { computed, ref, watch } from 'vue';
import { Modal, message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { HttpUtil } from '@/utils';
import { Protocols, TLS_FLOW_CONTROL } from '@/models/inbound.js';

const { t } = useI18n();

const props = defineProps({
  open: { type: Boolean, default: false },
  inbounds: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:open', 'done']);

const saving = ref(false);
const activeTabKey = ref('general');

// ── helpers ──────────────────────────────────────────────────────────
function currentValueLabel(fn) {
  if (!props.inbounds.length) return '';
  const parts = props.inbounds.map(ib => {
    const val = fn(ib);
    const label = val === undefined || val === null || val === '' ? '未设置' : String(val);
    return `${ib.remark || ib.tag || ib.id}: ${label}`;
  });
  if (parts.length <= 5) return parts.join('\n');
  return parts.slice(0, 5).join('\n') + `\n...及其他 ${parts.length - 5} 个入站`;
}

function inboundDisplay(ib) {
  return ib.remark || ib.tag || `#${ib.id}`;
}

// ── protocol / network / security intersections ──────────────────────
const protocols = computed(() => [...new Set(props.inbounds.map(ib => ib.protocol))]);
const networks = computed(() => [...new Set(props.inbounds.map(ib => ib.toInbound().stream.network).filter(Boolean))]);
const securities = computed(() => [...new Set(props.inbounds.map(ib => ib.toInbound().stream.security).filter(Boolean))]);

const hasNetwork = (net) => networks.value.includes(net);
const hasSecurity = (sec) => securities.value.includes(sec);
const hasProtocol = (p) => protocols.value.includes(p);

const canStream = computed(() => props.inbounds.every(ib => ib.toInbound().canEnableStream()));

const hasNetworkTab = computed(() => networks.value.length > 0);
const hasSecurityTab = computed(() => securities.value.length > 0);
const hasProtocolTab = computed(() => {
  if (hasProtocol(Protocols.VLESS)) return true;
  if ((hasProtocol(Protocols.VLESS) || hasProtocol(Protocols.TROJAN)) && hasSecurity('tls') && hasNetwork('tcp')) return true;
  if (canStream.value) return true;
  return false;
});

// ── form state (null = keep original) ────────────────────────────────
// General
const externalAddrType = ref(null);
const externalAddrCustom = ref(null);
const externalAddrTls = ref(null);
const externalPort = ref(null);
const trafficReset = ref(null);
const totalGB = ref(null);
const expiryTime = ref(null);
const enable = ref(null);

// TCP
const tcpHttpCamouflage = ref(null);

// WebSocket
const wsHost = ref(null);
const wsPath = ref(null);
const wsHeartbeat = ref(null);

// gRPC
const grpcServiceName = ref(null);
const grpcAuthority = ref(null);
const grpcMultiMode = ref(null);

// HTTPUpgrade
const huHost = ref(null);
const huPath = ref(null);

// xHTTP
const xhHost = ref(null);
const xhPath = ref(null);
const xhMode = ref(null);
const xhNoSseHeader = ref(null);

// KCP
const kcpSeed = ref(null);
const kcpMtu = ref(null);
const kcpTti = ref(null);
const kcpUpCap = ref(null);
const kcpDownCap = ref(null);
const kcpReadBuf = ref(null);
const kcpWriteBuf = ref(null);
const kcpHeaderType = ref(null);

// Hysteria
const hyVersion = ref(null);
const hyAuth = ref(null);
const hyUdpIdle = ref(null);
const hyMasqueradeSwitch = ref(null);
const hyMasqueradeType = ref(null);
const hyClearUdpMasks = ref(null);
const hyQuicParamsSwitch = ref(null);
const hyQuicCongestion = ref(null);
const hyQuicDebug = ref(null);
const hyQuicBrutalUp = ref(null);
const hyQuicBrutalDown = ref(null);
const hyQuicUdpHopSwitch = ref(null);
const hyQuicUdpHopPorts = ref(null);
const hyQuicUdpHopInterval = ref(null);
const hyQuicInitStreamRecv = ref(null);
const hyQuicMaxStreamRecv = ref(null);
const hyQuicInitConnRecv = ref(null);
const hyQuicMaxConnRecv = ref(null);
const hyQuicMaxIdleTimeout = ref(null);
const hyQuicKeepAlive = ref(null);
const hyQuicDisableMtu = ref(null);
const hyQuicMaxIncoming = ref(null);

// TLS
const tlsSni = ref(null);
const tlsMinVer = ref(null);
const tlsMaxVer = ref(null);
const tlsCiphers = ref(null);
const tlsRejectUnknownSni = ref(null);
const tlsDisableSystemRoot = ref(null);
const tlsSessionResumption = ref(null);
const tlsAlpn = ref(null);

// Reality
const realSni = ref(null);
const realPubkey = ref(null);
const realShortId = ref(null);
const realSpiderX = ref(null);
const realMldsa = ref(null);

// VLESS
const vlessDecryption = ref(null);
const vlessEncryption = ref(null);
const clearFallbacks = ref(null);
const flowControl = ref(null);

// Sockopt
const sockoptEnabled = ref(null);

function resetForm() {
  const fields = [
    externalAddrType, externalAddrCustom, externalAddrTls, externalPort,
    trafficReset, totalGB, expiryTime, enable,
    tcpHttpCamouflage,
    wsHost, wsPath, wsHeartbeat,
    grpcServiceName, grpcAuthority, grpcMultiMode,
    huHost, huPath,
    xhHost, xhPath, xhMode, xhNoSseHeader,
    kcpSeed, kcpMtu, kcpTti, kcpUpCap, kcpDownCap, kcpReadBuf, kcpWriteBuf, kcpHeaderType,
    hyVersion, hyAuth, hyUdpIdle, hyMasqueradeSwitch, hyMasqueradeType,
    hyClearUdpMasks, hyQuicParamsSwitch,
    hyQuicCongestion, hyQuicDebug, hyQuicBrutalUp, hyQuicBrutalDown,
    hyQuicUdpHopSwitch, hyQuicUdpHopPorts, hyQuicUdpHopInterval,
    hyQuicInitStreamRecv, hyQuicMaxStreamRecv, hyQuicInitConnRecv,
    hyQuicMaxConnRecv, hyQuicMaxIdleTimeout, hyQuicKeepAlive,
    hyQuicDisableMtu, hyQuicMaxIncoming,
    tlsSni, tlsMinVer, tlsMaxVer, tlsCiphers, tlsRejectUnknownSni,
    tlsDisableSystemRoot, tlsSessionResumption, tlsAlpn,
    realSni, realPubkey, realShortId, realSpiderX, realMldsa,
    vlessDecryption, vlessEncryption, clearFallbacks, flowControl,
    sockoptEnabled,
  ];
  for (const f of fields) f.value = null;
}

watch(() => props.open, (v) => { if (v) resetForm(); });

// ── current value helpers ────────────────────────────────────────────
function fmtField(ib, fn, trueLabel, falseLabel) {
  const v = fn(ib);
  if (typeof v === 'boolean') return v ? (trueLabel || '✓') : (falseLabel || '✗');
  if (v === null || v === undefined || v === '') return '未设置';
  if (v === 0) return '0';
  return String(v);
}

function currentLine(ib, fn, trueLabel, falseLabel) {
  return `${inboundDisplay(ib)}: ${fmtField(ib, fn, trueLabel, falseLabel)}`;
}

function currentValues(fn, trueLabel, falseLabel) {
  return props.inbounds.map(ib => currentLine(ib, fn, trueLabel, falseLabel)).join('\n');
}

function currentValuesForNetwork(net, fn, trueLabel, falseLabel) {
  const filtered = props.inbounds.filter(ib => ib.toInbound().stream.network === net);
  if (filtered.length === 0) return '无';
  return filtered.map(ib => currentLine(ib, fn, trueLabel, falseLabel)).join('\n');
}

function currentValuesForSecurity(sec, fn, trueLabel, falseLabel) {
  const filtered = props.inbounds.filter(ib => ib.toInbound().stream.security === sec);
  if (filtered.length === 0) return '无';
  return filtered.map(ib => currentLine(ib, fn, trueLabel, falseLabel)).join('\n');
}

function currentValuesForProto(p, fn, trueLabel, falseLabel) {
  const filtered = props.inbounds.filter(ib => ib.protocol === p);
  if (filtered.length === 0) return '无';
  return filtered.map(ib => currentLine(ib, fn, trueLabel, falseLabel)).join('\n');
}

function flowCurrentValues() {
  const parts = [];
  for (const ib of props.inbounds) {
    if (ib.protocol !== Protocols.VLESS) continue;
    const inbound = ib.toInbound();
    if (inbound.stream.network !== 'tcp') continue;
    if (!['tls', 'reality'].includes(inbound.stream.security)) continue;
    for (const c of (inbound.clients || [])) {
      parts.push(`${inboundDisplay(ib)} / ${c.email || c.id || '?'}: ${c.flow || '(无)'}`);
    }
  }
  return parts.length > 0 ? parts.join('\n') : '无符合条件的入站';
}

function isIndeterminate(refVal) {
  return refVal === null || refVal === undefined;
}

// ── submit ───────────────────────────────────────────────────────────
async function onSubmit() {
  saving.value = true;
  try {
    for (const dbInbound of props.inbounds) {
      const inbound = dbInbound.toInbound();
      // Apply changes to the live Inbound / DBInbound, then serialise
      applyGeneral(inbound);
      applyTransport(inbound);
      applySecurity(inbound);
      applyProtocol(inbound);
      applySockopt(inbound);
      applyDbFields(dbInbound);

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
    emit('done');
  } catch (_e) {
    message.error('部分入站更新失败');
  } finally {
    saving.value = false;
  }
}

function applyGeneral(inbound) {
  if (externalAddrType.value !== null) {
    // externalAddrType: 'panel' | 'custom' | 'none'
    if (externalAddrType.value === 'none') {
      // keep existing external addr settings
    } else if (externalAddrType.value === 'panel') {
      // uses panel domain — set in the db-level fields
    }
  }
  if (externalPort.value !== null && externalPort.value !== undefined) {
    // Handle at DBInbound level below
  }
  // Note: external addr & port are DBInbound-level fields, not on the Inbound model.
  // They'll be applied in the payload construction below.
}

function applyDbFields(dbInbound) {
  if (externalAddrType.value) {
    if (externalAddrType.value === 'custom' && externalAddrCustom.value !== null) {
      dbInbound.externalAddr = externalAddrCustom.value;
    } else if (externalAddrType.value === 'panel') {
      dbInbound.externalAddr = '';
    } else if (externalAddrType.value === 'none') {
      dbInbound.externalAddr = '';
    }
  }
  if (externalPort.value !== null) {
    dbInbound.externalPort = externalPort.value || null;
  }
  if (externalAddrTls.value !== null) {
    dbInbound.externalAddrTls = externalAddrTls.value;
  }
  if (trafficReset.value !== null) {
    dbInbound.trafficReset = trafficReset.value;
  }
  if (totalGB.value !== null) {
    dbInbound.totalGB = Number(totalGB.value);
  }
  if (expiryTime.value !== null) {
    dbInbound.expiryTime = expiryTime.value ? new Date(expiryTime.value).getTime() : 0;
  }
  if (enable.value !== null) {
    dbInbound.enable = enable.value;
  }
}

function applyTransport(inbound) {
  const stream = inbound.stream;
  // TCP
  if (hasNetwork('tcp') && tcpHttpCamouflage.value !== null) {
    stream.tcp.type = tcpHttpCamouflage.value ? 'http' : 'none';
  }
  // WS
  if (hasNetwork('ws')) {
    if (wsHost.value !== null) stream.ws.host = wsHost.value;
    if (wsPath.value !== null) stream.ws.path = wsPath.value;
    if (wsHeartbeat.value !== null && wsHeartbeat.value !== '') stream.ws.heartbeatPeriod = Number(wsHeartbeat.value);
  }
  // gRPC
  if (hasNetwork('grpc')) {
    if (grpcServiceName.value !== null) stream.grpc.serviceName = grpcServiceName.value;
    if (grpcAuthority.value !== null) stream.grpc.authority = grpcAuthority.value;
    if (grpcMultiMode.value !== null) stream.grpc.multiMode = grpcMultiMode.value;
  }
  // HTTPUpgrade
  if (hasNetwork('httpupgrade')) {
    if (huHost.value !== null) stream.httpupgrade.host = huHost.value;
    if (huPath.value !== null) stream.httpupgrade.path = huPath.value;
  }
  // xHTTP
  if (hasNetwork('xhttp')) {
    if (xhHost.value !== null) stream.xhttp.host = xhHost.value;
    if (xhPath.value !== null) stream.xhttp.path = xhPath.value;
    if (xhMode.value !== null) stream.xhttp.mode = xhMode.value;
    if (xhNoSseHeader.value !== null) stream.xhttp.noSSEHeader = xhNoSseHeader.value;
  }
  // KCP
  if (hasNetwork('kcp')) {
    if (kcpSeed.value !== null) stream.kcp.seed = kcpSeed.value;
    if (kcpMtu.value !== null && kcpMtu.value !== '') stream.kcp.mtu = Number(kcpMtu.value);
    if (kcpTti.value !== null && kcpTti.value !== '') stream.kcp.tti = Number(kcpTti.value);
    if (kcpUpCap.value !== null && kcpUpCap.value !== '') stream.kcp.uplinkCapacity = Number(kcpUpCap.value);
    if (kcpDownCap.value !== null && kcpDownCap.value !== '') stream.kcp.downlinkCapacity = Number(kcpDownCap.value);
    if (kcpReadBuf.value !== null && kcpReadBuf.value !== '') stream.kcp.readBufferSize = Number(kcpReadBuf.value);
    if (kcpWriteBuf.value !== null && kcpWriteBuf.value !== '') stream.kcp.writeBufferSize = Number(kcpWriteBuf.value);
    if (kcpHeaderType.value !== null) stream.kcp.headerType = kcpHeaderType.value;
  }
  // Hysteria
  if (hasNetwork('hysteria')) {
    if (hyVersion.value !== null) stream.hysteria.version = Number(hyVersion.value);
    if (hyAuth.value !== null) stream.hysteria.auth = hyAuth.value;
    if (hyUdpIdle.value !== null && hyUdpIdle.value !== '') stream.hysteria.udpIdleTimeout = Number(hyUdpIdle.value);
    if (hyMasqueradeSwitch.value !== null) stream.hysteria.masqueradeSwitch = hyMasqueradeSwitch.value;
    if (hyMasqueradeType.value !== null && stream.hysteria.masquerade) stream.hysteria.masquerade.type = hyMasqueradeType.value;
    if (hyClearUdpMasks.value) stream.finalmask.udp = [];
    if (hyQuicParamsSwitch.value !== null) stream.finalmask.enableQuicParams = hyQuicParamsSwitch.value;
    if (hyQuicParamsSwitch.value && stream.finalmask.quicParams) {
      const qp = stream.finalmask.quicParams;
      if (hyQuicCongestion.value !== null) qp.congestion = hyQuicCongestion.value;
      if (hyQuicDebug.value !== null) qp.debug = hyQuicDebug.value;
      if (hyQuicBrutalUp.value !== null && hyQuicBrutalUp.value !== '') qp.brutalUp = Number(hyQuicBrutalUp.value);
      if (hyQuicBrutalDown.value !== null && hyQuicBrutalDown.value !== '') qp.brutalDown = Number(hyQuicBrutalDown.value);
      if (hyQuicUdpHopSwitch.value !== null) qp.hasUdpHop = hyQuicUdpHopSwitch.value;
      if (hyQuicUdpHopPorts.value !== null && qp.udpHop) qp.udpHop.ports = hyQuicUdpHopPorts.value;
      if (hyQuicUdpHopInterval.value !== null && qp.udpHop) qp.udpHop.interval = hyQuicUdpHopInterval.value;
      if (hyQuicInitStreamRecv.value !== null && hyQuicInitStreamRecv.value !== '') qp.initStreamReceiveWindow = Number(hyQuicInitStreamRecv.value);
      if (hyQuicMaxStreamRecv.value !== null && hyQuicMaxStreamRecv.value !== '') qp.maxStreamReceiveWindow = Number(hyQuicMaxStreamRecv.value);
      if (hyQuicInitConnRecv.value !== null && hyQuicInitConnRecv.value !== '') qp.initConnectionReceiveWindow = Number(hyQuicInitConnRecv.value);
      if (hyQuicMaxConnRecv.value !== null && hyQuicMaxConnRecv.value !== '') qp.maxConnectionReceiveWindow = Number(hyQuicMaxConnRecv.value);
      if (hyQuicMaxIdleTimeout.value !== null && hyQuicMaxIdleTimeout.value !== '') qp.maxIdleTimeout = Number(hyQuicMaxIdleTimeout.value);
      if (hyQuicKeepAlive.value !== null && hyQuicKeepAlive.value !== '') qp.keepAlivePeriod = Number(hyQuicKeepAlive.value);
      if (hyQuicDisableMtu.value !== null) qp.disablePathMTUDiscovery = hyQuicDisableMtu.value;
      if (hyQuicMaxIncoming.value !== null && hyQuicMaxIncoming.value !== '') qp.maxIncomingStreams = Number(hyQuicMaxIncoming.value);
    }
  }
}

function applySecurity(inbound) {
  const stream = inbound.stream;
  // TLS
  if (hasSecurity('tls')) {
    if (tlsSni.value !== null) stream.tls.sni = tlsSni.value;
    if (tlsMinVer.value !== null) stream.tls.minVersion = tlsMinVer.value;
    if (tlsMaxVer.value !== null) stream.tls.maxVersion = tlsMaxVer.value;
    if (tlsCiphers.value !== null) stream.tls.cipherSuites = tlsCiphers.value;
    if (tlsRejectUnknownSni.value !== null) stream.tls.rejectUnknownSni = tlsRejectUnknownSni.value;
    if (tlsDisableSystemRoot.value !== null) stream.tls.disableSystemRoot = tlsDisableSystemRoot.value;
    if (tlsSessionResumption.value !== null) stream.tls.enableSessionResumption = tlsSessionResumption.value;
    if (tlsAlpn.value !== null && tlsAlpn.value.length > 0) stream.tls.alpn = tlsAlpn.value;
  }
  // Reality
  if (hasSecurity('reality')) {
    if (realSni.value !== null) stream.reality.serverName = realSni.value;
    if (realPubkey.value !== null) stream.reality.publicKey = realPubkey.value;
    if (realShortId.value !== null) stream.reality.shortId = realShortId.value;
    if (realSpiderX.value !== null) stream.reality.spiderX = realSpiderX.value;
    if (realMldsa.value !== null) stream.reality.mldsa65Verify = realMldsa.value;
  }
}

function applyProtocol(inbound) {
  // VLESS
  if (inbound.protocol === Protocols.VLESS || hasProtocol(Protocols.VLESS)) {
    if (vlessDecryption.value !== null && inbound.settings.vlesses) {
      inbound.settings.decryption = vlessDecryption.value;
    }
    if (vlessEncryption.value !== null && inbound.settings.vlesses) {
      inbound.settings.encryption = vlessEncryption.value;
    }
    if (clearFallbacks.value && inbound.settings.fallbacks) {
      inbound.settings.fallbacks = [];
    }
    if (flowControl.value !== null && inbound.settings.vlesses) {
      for (const v of inbound.settings.vlesses) {
        v.flow = flowControl.value;
      }
    }
  }
  // Trojan
  if (clearFallbacks.value && inbound.settings.trojans && inbound.settings.fallbacks) {
    inbound.settings.fallbacks = [];
  }
}

function applySockopt(inbound) {
  // Sockopt — complex, handled via the switch
  // For now, batch edit only toggles sockopt on/off at the stream level
  // if the protocol supports it. Detailed sockopt field editing would
  // require a much larger ref structure — skipping for now.
}

function close() {
  emit('update:open', false);
}
</script>

<template>
  <a-modal :open="open" :title="t('pages.inbounds.batchEditInbounds')" :width="800" :confirm-loading="saving"
    :ok-text="t('pages.inbounds.batchEditApply')" :cancel-text="t('cancel')" @ok="onSubmit" @cancel="close" :mask-closable="false">
    <a-tabs v-model:active-key="activeTabKey">
      <!-- ==================== Tab: General ==================== -->
      <a-tab-pane key="general" :tab="t('pages.inbounds.batchEditTabGeneral')">
        <a-form layout="vertical" :colon="false">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="对外地址类型">
                <a-select v-model:value="externalAddrType" allow-clear placeholder="保持各入站原值">
                  <a-select-option value="">保持原值</a-select-option>
                  <a-select-option value="panel">面板地址</a-select-option>
                  <a-select-option value="custom">自定义</a-select-option>
                  <a-select-option value="none">无</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="对外端口">
                <a-input-number v-model:value="externalPort" placeholder="保持各入站原值" style="width: 100%" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="8">
              <a-form-item label="对外地址 TLS">
                <a-switch v-model:checked="externalAddrTls" :indeterminate="isIndeterminate(externalAddrTls)" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="流量重置">
                <a-select v-model:value="trafficReset" allow-clear placeholder="保持原值">
                  <a-select-option value="">保持原值</a-select-option>
                  <a-select-option value="never">never</a-select-option>
                  <a-select-option value="hourly">hourly</a-select-option>
                  <a-select-option value="daily">daily</a-select-option>
                  <a-select-option value="weekly">weekly</a-select-option>
                  <a-select-option value="monthly">monthly</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="启用">
                <a-switch v-model:checked="enable" :indeterminate="isIndeterminate(enable)" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="总流量 (GB)">
                <a-input-number v-model:value="totalGB" placeholder="保持原值" style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="到期时间">
                <a-date-picker v-model:value="expiryTime" placeholder="保持原值" style="width: 100%" />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </a-tab-pane>

      <!-- ==================== Tab: Network ==================== -->
      <a-tab-pane key="network" :tab="t('pages.inbounds.batchEditTabNetwork')" :disabled="!hasNetworkTab">
        <a-form layout="vertical" :colon="false">
          <a-card v-if="hasNetwork('tcp')" size="small" title="TCP" style="margin-bottom: 12px">
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="HTTP 伪装">
                  <a-switch v-model:checked="tcpHttpCamouflage" :indeterminate="isIndeterminate(tcpHttpCamouflage)" />
                  <div class="current-vals">{{ currentValuesForNetwork('tcp', ib => ib.toInbound().stream.tcp.type === 'http' ? '开启(http)' : '关闭(none)') }}</div>
                </a-form-item>
              </a-col>
            </a-row>
          </a-card>

          <a-card v-if="hasNetwork('ws')" size="small" title="WebSocket" style="margin-bottom: 12px">
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="Host">
                  <a-input v-model:value="wsHost" placeholder="保持原值" />
                  <div class="current-vals">{{ currentValuesForNetwork('ws', ib => ib.toInbound().stream.ws.host) }}</div>
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="Path">
                  <a-input v-model:value="wsPath" placeholder="保持原值" />
                  <div class="current-vals">{{ currentValuesForNetwork('ws', ib => ib.toInbound().stream.ws.path) }}</div>
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="Heartbeat (秒)">
                  <a-input-number v-model:value="wsHeartbeat" placeholder="保持原值" style="width: 100%" />
                  <div class="current-vals">{{ currentValuesForNetwork('ws', ib => ib.toInbound().stream.ws.heartbeatPeriod) }}</div>
                </a-form-item>
              </a-col>
            </a-row>
          </a-card>

          <a-card v-if="hasNetwork('grpc')" size="small" title="gRPC" style="margin-bottom: 12px">
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="Service Name">
                  <a-input v-model:value="grpcServiceName" placeholder="保持原值" />
                  <div class="current-vals">{{ currentValuesForNetwork('grpc', ib => ib.toInbound().stream.grpc.serviceName) }}</div>
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="Authority">
                  <a-input v-model:value="grpcAuthority" placeholder="保持原值" />
                  <div class="current-vals">{{ currentValuesForNetwork('grpc', ib => ib.toInbound().stream.grpc.authority) }}</div>
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="Multi Mode">
                  <a-switch v-model:checked="grpcMultiMode" :indeterminate="isIndeterminate(grpcMultiMode)" />
                  <div class="current-vals">{{ currentValuesForNetwork('grpc', ib => ib.toInbound().stream.grpc.multiMode, '开启', '关闭') }}</div>
                </a-form-item>
              </a-col>
            </a-row>
          </a-card>

          <a-card v-if="hasNetwork('httpupgrade')" size="small" title="HTTPUpgrade" style="margin-bottom: 12px">
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="Host">
                  <a-input v-model:value="huHost" placeholder="保持原值" />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="Path">
                  <a-input v-model:value="huPath" placeholder="保持原值" />
                </a-form-item>
              </a-col>
            </a-row>
          </a-card>

          <a-card v-if="hasNetwork('xhttp')" size="small" title="xHTTP" style="margin-bottom: 12px">
            <a-row :gutter="16">
              <a-col :span="6">
                <a-form-item label="Host">
                  <a-input v-model:value="xhHost" placeholder="保持原值" />
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="Path">
                  <a-input v-model:value="xhPath" placeholder="保持原值" />
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="Mode">
                  <a-select v-model:value="xhMode" allow-clear placeholder="保持原值">
                    <a-select-option value="">保持原值</a-select-option>
                    <a-select-option value="auto">auto</a-select-option>
                    <a-select-option value="packet-one">packet-one</a-select-option>
                    <a-select-option value="stream-one">stream-one</a-select-option>
                    <a-select-option value="stream-two">stream-two</a-select-option>
                    <a-select-option value="stream-separate">stream-separate</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="No SSE Header">
                  <a-switch v-model:checked="xhNoSseHeader" :indeterminate="isIndeterminate(xhNoSseHeader)" />
                </a-form-item>
              </a-col>
            </a-row>
          </a-card>

          <a-card v-if="hasNetwork('kcp')" size="small" title="KCP" style="margin-bottom: 12px">
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="Seed"><a-input v-model:value="kcpSeed" placeholder="保持原值" /></a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="MTU"><a-input-number v-model:value="kcpMtu" placeholder="保持原值" style="width: 100%" /></a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="TTI"><a-input-number v-model:value="kcpTti" placeholder="保持原值" style="width: 100%" /></a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="Uplink Cap"><a-input-number v-model:value="kcpUpCap" placeholder="保持原值" style="width: 100%" /></a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="Downlink Cap"><a-input-number v-model:value="kcpDownCap" placeholder="保持原值" style="width: 100%" /></a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="Header Type">
                  <a-select v-model:value="kcpHeaderType" allow-clear placeholder="保持原值">
                    <a-select-option value="">保持原值</a-select-option>
                    <a-select-option value="none">none</a-select-option>
                    <a-select-option value="dtls">dtls</a-select-option>
                    <a-select-option value="utp">utp</a-select-option>
                    <a-select-option value="wechat-video">wechat-video</a-select-option>
                    <a-select-option value="wireguard">wireguard</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
            </a-row>
          </a-card>

          <a-card v-if="hasNetwork('hysteria')" size="small" title="UDP / Hysteria" style="margin-bottom: 12px">
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="Version">
                  <a-select v-model:value="hyVersion" allow-clear placeholder="保持原值">
                    <a-select-option value="">保持原值</a-select-option>
                    <a-select-option :value="1">1</a-select-option>
                    <a-select-option :value="2">2</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="Auth"><a-input v-model:value="hyAuth" placeholder="保持原值" /></a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="UDP Idle Timeout (秒)">
                  <a-input-number v-model:value="hyUdpIdle" placeholder="保持原值" style="width: 100%" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="16">
              <a-col :span="6">
                <a-form-item label="Masquerade">
                  <a-switch v-model:checked="hyMasqueradeSwitch" :indeterminate="isIndeterminate(hyMasqueradeSwitch)" />
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="Masq Type">
                  <a-select v-model:value="hyMasqueradeType" allow-clear placeholder="保持原值">
                    <a-select-option value="">保持原值</a-select-option>
                    <a-select-option value="proxy">proxy</a-select-option>
                    <a-select-option value="file">file</a-select-option>
                    <a-select-option value="string">string</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="清空 UDP Masks">
                  <a-switch v-model:checked="hyClearUdpMasks" />
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="QUIC Params">
                  <a-switch v-model:checked="hyQuicParamsSwitch" :indeterminate="isIndeterminate(hyQuicParamsSwitch)" />
                </a-form-item>
              </a-col>
            </a-row>
            <template v-if="hyQuicParamsSwitch">
              <a-divider style="margin: 8px 0">QUIC Params</a-divider>
              <a-row :gutter="16">
                <a-col :span="8">
                  <a-form-item label="Congestion">
                    <a-select v-model:value="hyQuicCongestion" allow-clear placeholder="保持原值">
                      <a-select-option value="">保持原值</a-select-option>
                      <a-select-option value="bbr">bbr</a-select-option>
                      <a-select-option value="cubic">cubic</a-select-option>
                      <a-select-option value="brutal">brutal</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
                <a-col :span="4">
                  <a-form-item label="Debug"><a-switch v-model:checked="hyQuicDebug" :indeterminate="isIndeterminate(hyQuicDebug)" /></a-form-item>
                </a-col>
                <a-col :span="6">
                  <a-form-item label="Brutal Up"><a-input-number v-model:value="hyQuicBrutalUp" placeholder="保持原值" style="width:100%" /></a-form-item>
                </a-col>
                <a-col :span="6">
                  <a-form-item label="Brutal Down"><a-input-number v-model:value="hyQuicBrutalDown" placeholder="保持原值" style="width:100%" /></a-form-item>
                </a-col>
              </a-row>
              <a-row :gutter="16">
                <a-col :span="4">
                  <a-form-item label="UDP Hop"><a-switch v-model:checked="hyQuicUdpHopSwitch" :indeterminate="isIndeterminate(hyQuicUdpHopSwitch)" /></a-form-item>
                </a-col>
                <a-col :span="5">
                  <a-form-item label="Hop Ports"><a-input v-model:value="hyQuicUdpHopPorts" placeholder="保持原值" /></a-form-item>
                </a-col>
                <a-col :span="5">
                  <a-form-item label="Hop Interval"><a-input v-model:value="hyQuicUdpHopInterval" placeholder="保持原值" /></a-form-item>
                </a-col>
                <a-col :span="5">
                  <a-form-item label="Max Idle (s)"><a-input-number v-model:value="hyQuicMaxIdleTimeout" placeholder="保持原值" style="width:100%" /></a-form-item>
                </a-col>
                <a-col :span="5">
                  <a-form-item label="KeepAlive (s)"><a-input-number v-model:value="hyQuicKeepAlive" placeholder="保持原值" style="width:100%" /></a-form-item>
                </a-col>
              </a-row>
              <a-row :gutter="16">
                <a-col :span="8">
                  <a-form-item label="Init Stream Recv"><a-input-number v-model:value="hyQuicInitStreamRecv" placeholder="保持原值" style="width:100%" /></a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item label="Max Stream Recv"><a-input-number v-model:value="hyQuicMaxStreamRecv" placeholder="保持原值" style="width:100%" /></a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item label="Max Incoming Streams"><a-input-number v-model:value="hyQuicMaxIncoming" placeholder="保持原值" style="width:100%" /></a-form-item>
                </a-col>
              </a-row>
            </template>
          </a-card>
        </a-form>
      </a-tab-pane>

      <!-- ==================== Tab: Security ==================== -->
      <a-tab-pane key="security" :tab="t('pages.inbounds.batchEditTabSecurity')" :disabled="!hasSecurityTab">
        <a-form layout="vertical" :colon="false">
          <a-card v-if="hasSecurity('tls')" size="small" title="TLS" style="margin-bottom: 12px">
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="SNI"><a-input v-model:value="tlsSni" placeholder="保持原值" /></a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="Min Version">
                  <a-select v-model:value="tlsMinVer" allow-clear placeholder="保持原值">
                    <a-select-option value="">保持原值</a-select-option>
                    <a-select-option value="1.0">1.0</a-select-option>
                    <a-select-option value="1.1">1.1</a-select-option>
                    <a-select-option value="1.2">1.2</a-select-option>
                    <a-select-option value="1.3">1.3</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="Max Version">
                  <a-select v-model:value="tlsMaxVer" allow-clear placeholder="保持原值">
                    <a-select-option value="">保持原值</a-select-option>
                    <a-select-option value="1.0">1.0</a-select-option>
                    <a-select-option value="1.1">1.1</a-select-option>
                    <a-select-option value="1.2">1.2</a-select-option>
                    <a-select-option value="1.3">1.3</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="Reject Unknown SNI">
                  <a-switch v-model:checked="tlsRejectUnknownSni" :indeterminate="isIndeterminate(tlsRejectUnknownSni)" />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="Disable System Root">
                  <a-switch v-model:checked="tlsDisableSystemRoot" :indeterminate="isIndeterminate(tlsDisableSystemRoot)" />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="Session Resumption">
                  <a-switch v-model:checked="tlsSessionResumption" :indeterminate="isIndeterminate(tlsSessionResumption)" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="ALPN">
                  <a-select v-model:value="tlsAlpn" mode="multiple" allow-clear placeholder="保持原值">
                    <a-select-option value="h2">h2</a-select-option>
                    <a-select-option value="h3">h3</a-select-option>
                    <a-select-option value="http/1.1">http/1.1</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="Cipher Suites"><a-input v-model:value="tlsCiphers" placeholder="保持原值" /></a-form-item>
              </a-col>
            </a-row>
          </a-card>

          <a-card v-if="hasSecurity('reality')" size="small" title="Reality" style="margin-bottom: 12px">
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="Server Name"><a-input v-model:value="realSni" placeholder="保持原值" /></a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="Public Key"><a-input v-model:value="realPubkey" placeholder="保持原值" /></a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="Short ID"><a-input v-model:value="realShortId" placeholder="保持原值" /></a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="Spider X"><a-input v-model:value="realSpiderX" placeholder="保持原值" /></a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="ML-DSA65 Verify">
                  <a-switch v-model:checked="realMldsa" :indeterminate="isIndeterminate(realMldsa)" />
                </a-form-item>
              </a-col>
            </a-row>
          </a-card>
        </a-form>
      </a-tab-pane>

      <!-- ==================== Tab: Protocol ==================== -->
      <a-tab-pane key="protocol" :tab="t('pages.inbounds.batchEditTabProtocol')" :disabled="!hasProtocolTab">
        <a-form layout="vertical" :colon="false">
          <a-card v-if="hasProtocol(Protocols.VLESS)" size="small" title="VLESS" style="margin-bottom: 12px">
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="Decryption"><a-input v-model:value="vlessDecryption" placeholder="保持原值" /></a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="Encryption"><a-input v-model:value="vlessEncryption" placeholder="保持原值" /></a-form-item>
              </a-col>
            </a-row>
          </a-card>

          <a-card v-if="(hasProtocol(Protocols.VLESS) || hasProtocol(Protocols.TROJAN)) && hasSecurity('tls') && hasNetwork('tcp')"
            size="small" title="Fallbacks" style="margin-bottom: 12px">
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="清空所有 fallbacks">
                  <a-switch v-model:checked="clearFallbacks" />
                  <div class="current-vals">{{ currentValues(ib => { const fb = ib.toInbound().settings.fallbacks; return fb && fb.length ? fb.length + '个' : '无'; }) }}</div>
                </a-form-item>
              </a-col>
            </a-row>
          </a-card>

          <a-card v-if="hasProtocol(Protocols.VLESS) && hasNetwork('tcp') && (hasSecurity('tls') || hasSecurity('reality'))"
            size="small" title="Flow 流控" style="margin-bottom: 12px">
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="Flow">
                  <a-select v-model:value="flowControl" allow-clear placeholder="保持各客户端原值">
                    <a-select-option value="">保持原值</a-select-option>
                    <a-select-option :value="TLS_FLOW_CONTROL.VISION">xtls-rprx-vision</a-select-option>
                    <a-select-option :value="TLS_FLOW_CONTROL.VISION_UDP443">xtls-rprx-vision-udp443</a-select-option>
                  </a-select>
                  <div class="current-vals">{{ flowCurrentValues() }}</div>
                </a-form-item>
              </a-col>
            </a-row>
          </a-card>

          <a-card v-if="canStream" size="small" title="Sockopt" style="margin-bottom: 12px">
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="启用 Sockopt 修改">
                  <a-switch v-model:checked="sockoptEnabled" />
                  <div class="current-vals" style="color: #999; font-size: 12px;">
                    目前批量编辑 Sockopt 的具体字段需要在后续版本中支持。
                    此开关预留用于将来扩展。
                  </div>
                </a-form-item>
              </a-col>
            </a-row>
          </a-card>
        </a-form>
      </a-tab-pane>
    </a-tabs>
  </a-modal>
</template>

<style scoped>
.current-vals {
  font-size: 11px;
  color: #888;
  white-space: pre-line;
  margin-top: 2px;
  line-height: 1.4;
}
</style>
