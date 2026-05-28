import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Divider, Form, Input, InputNumber, Select, Switch } from 'antd';
import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';

import { RandomUtil } from '@/utils';
import { Protocols } from '@/models/outbound.js';

interface StreamShape {
  network?: string;
  kcp?: { mtu?: number };
  finalmask: {
    tcp?: MaskRow[];
    udp?: MaskRow[];
    enableQuicParams?: boolean;
    quicParams?: QuicParams;
  };
  addTcpMask: (type?: string) => void;
  delTcpMask: (index: number) => void;
  addUdpMask: (type?: string) => void;
  delUdpMask: (index: number) => void;
}

interface MaskRow {
  type: string;
  settings: Record<string, unknown>;
  _getDefaultSettings: (type: string, settings: Record<string, unknown>) => Record<string, unknown>;
}

interface ItemRow {
  type: string;
  packet: string | unknown[];
  delay?: number | string;
  rand?: number | string;
  randRange?: string;
}

interface QuicParams {
  congestion: string;
  debug?: boolean;
  brutalUp?: number | string;
  brutalDown?: number | string;
  hasUdpHop?: boolean;
  udpHop?: { ports: string; interval: string | number };
  maxIdleTimeout?: number;
  keepAlivePeriod?: number;
  disablePathMTUDiscovery?: boolean;
  maxIncomingStreams?: number;
  initStreamReceiveWindow?: number;
  maxStreamReceiveWindow?: number;
  initConnectionReceiveWindow?: number;
  maxConnectionReceiveWindow?: number;
}

interface FinalMaskFormProps {
  stream: StreamShape;
  protocol: string;
  onChange: () => void;
}

function changeMaskType(mask: MaskRow, type: string) {
  mask.type = type;
  mask.settings = mask._getDefaultSettings(type, {});
}

function changeItemType(item: ItemRow, type: string) {
  item.type = type;
  if (type === 'base64') item.packet = RandomUtil.randomBase64();
  else if (type === 'array') {
    item.rand = 0;
    item.packet = [];
  } else item.packet = '';
}

function newClientServerItem(): ItemRow {
  return { delay: 0, rand: 0, randRange: '0-255', type: 'array', packet: [] };
}

function newUdpClientServerItem(): ItemRow {
  return { rand: 0, randRange: '0-255', type: 'array', packet: [] };
}

function newNoiseItem(): ItemRow {
  return { rand: '1-8192', randRange: '0-255', type: 'array', packet: [], delay: '10-20' };
}

export default function FinalMaskForm({ stream, protocol, onChange }: FinalMaskFormProps) {
  const { t } = useTranslation();
  const isHysteria = protocol === Protocols.Hysteria || protocol === 'hysteria';
  const network = stream?.network || '';

  const showTcp = useMemo(
    () => ['raw', 'tcp', 'httpupgrade', 'ws', 'grpc', 'xhttp'].includes(network),
    [network],
  );
  const showUdp = isHysteria || network === 'kcp';
  const showQuic = isHysteria || network === 'xhttp';

  function notify() {
    onChange();
  }

  function changeUdpMaskType(mask: MaskRow, type: string) {
    changeMaskType(mask, type);
    if (network === 'kcp' && stream.kcp) {
      stream.kcp.mtu = type === 'xdns' ? 900 : 1350;
    }
    notify();
  }

  function addUdpMaskWithDefault() {
    const def = isHysteria ? 'salamander' : 'mkcp-aes128gcm';
    stream.addUdpMask(def);
    notify();
  }

  const tcpMasks = stream.finalmask.tcp || [];
  const udpMasks = stream.finalmask.udp || [];

  if (!showTcp && !showUdp && !showQuic) return null;

  return (
    <Form colon={false} labelCol={{ md: { span: 8 } }} wrapperCol={{ md: { span: 14 } }}>
      {showTcp && (
        <>
          <Form.Item label={t('pages.inbounds.finalmask.tcpMasks')}>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                stream.addTcpMask('fragment');
                notify();
              }}
            >
              {t('pages.inbounds.finalmask.addTcpMask')}
            </Button>
          </Form.Item>

          {tcpMasks.map((mask, mIdx) => (
            <div key={`tcp-${mIdx}`}>
              <Divider style={{ margin: 0 }}>
                {t('pages.inbounds.finalmask.tcpMaskPattern', { index: mIdx + 1 })}
                <DeleteOutlined
                  style={{ color: 'rgb(255, 77, 79)', cursor: 'pointer', marginLeft: 8 }}
                  onClick={() => {
                    stream.delTcpMask(mIdx);
                    notify();
                  }}
                />
              </Divider>

              <Form.Item label={t('pages.inbounds.finalmask.type')}>
                <Select
                  value={mask.type}
                  onChange={(v) => {
                    changeMaskType(mask, v);
                    notify();
                  }}
                  options={[
                    { value: 'fragment', label: t('pages.inbounds.finalmask.fragment') },
                    { value: 'header-custom', label: t('pages.inbounds.finalmask.headerCustom') },
                    { value: 'sudoku', label: t('pages.inbounds.finalmask.sudoku') },
                  ]}
                />
              </Form.Item>

              {mask.type === 'fragment' && (
                <>
                  <Form.Item label={t('pages.inbounds.finalmask.packets')}>
                    <Select
                      value={mask.settings.packets as string}
                      onChange={(v) => {
                        (mask.settings as Record<string, unknown>).packets = v;
                        notify();
                      }}
                      options={[
                        { value: 'tlshello', label: t('pages.inbounds.finalmask.tlshello') },
                        { value: '1-3', label: '1-3' },
                        { value: '1-5', label: '1-5' },
                      ]}
                    />
                  </Form.Item>
                  {(['length', 'delay', 'maxSplit'] as const).map((field) => (
                    <Form.Item key={field} label={t(`pages.inbounds.finalmask.${field}` as any)}>
                      <Input
                        value={(mask.settings[field] as string) || ''}
                        onChange={(e) => {
                          (mask.settings as Record<string, unknown>)[field] = e.target.value;
                          notify();
                        }}
                      />
                    </Form.Item>
                  ))}
                </>
              )}

              {mask.type === 'sudoku' && (
                <>
                  {(['password', 'ascii', 'customTable', 'customTables'] as const).map((field) => (
                    <Form.Item key={field} label={t(`pages.inbounds.finalmask.${field}` as any)}>
                      <Input
                        value={(mask.settings[field] as string) || ''}
                        onChange={(e) => {
                          (mask.settings as Record<string, unknown>)[field] = e.target.value;
                          notify();
                        }}
                      />
                    </Form.Item>
                  ))}
                  {(['paddingMin', 'paddingMax'] as const).map((field) => (
                    <Form.Item key={field} label={t(`pages.inbounds.finalmask.${field}` as any)}>
                      <InputNumber
                        value={(mask.settings[field] as number) || 0}
                        min={0}
                        onChange={(v) => {
                          (mask.settings as Record<string, unknown>)[field] = Number(v) || 0;
                          notify();
                        }}
                      />
                    </Form.Item>
                  ))}
                </>
              )}

              {mask.type === 'header-custom' && (
                <HeaderCustomGroups mask={mask} kind="tcp" onChange={notify} />
              )}
            </div>
          ))}
        </>
      )}

      {showUdp && (
        <>
          <Form.Item label={t('pages.inbounds.finalmask.udpMasks')}>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={addUdpMaskWithDefault}>
              {t('pages.inbounds.finalmask.addUdpMask')}
            </Button>
          </Form.Item>

          {udpMasks.map((mask, mIdx) => (
            <div key={`udp-${mIdx}`}>
              <Divider style={{ margin: 0 }}>
                {t('pages.inbounds.finalmask.udpMaskPattern', { index: mIdx + 1 })}
                <DeleteOutlined
                  style={{ color: 'rgb(255, 77, 79)', cursor: 'pointer', marginLeft: 8 }}
                  onClick={() => {
                    stream.delUdpMask(mIdx);
                    notify();
                  }}
                />
              </Divider>

              <Form.Item label={t('pages.inbounds.finalmask.type')}>
                <Select
                  value={mask.type}
                  onChange={(v) => changeUdpMaskType(mask, v)}
                  options={
                    isHysteria
                      ? [{ value: 'salamander', label: t('pages.inbounds.finalmask.salamander') }]
                      : [
                          { value: 'mkcp-aes128gcm', label: t('pages.inbounds.finalmask.mkcpAes128gcm') },
                          { value: 'header-dns', label: t('pages.inbounds.finalmask.headerDns') },
                          { value: 'header-dtls', label: t('pages.inbounds.finalmask.headerDtls') },
                          { value: 'header-srtp', label: t('pages.inbounds.finalmask.headerSrtp') },
                          { value: 'header-utp', label: t('pages.inbounds.finalmask.headerUtp') },
                          { value: 'header-wechat', label: t('pages.inbounds.finalmask.headerWechat') },
                          { value: 'header-wireguard', label: t('pages.inbounds.finalmask.headerWireguard') },
                          { value: 'mkcp-original', label: t('pages.inbounds.finalmask.mkcpOriginal') },
                          { value: 'xdns', label: t('pages.inbounds.finalmask.xdns') },
                          { value: 'xicmp', label: t('pages.inbounds.finalmask.xicmp') },
                          { value: 'header-custom', label: t('pages.inbounds.finalmask.headerCustom') },
                          { value: 'noise', label: t('pages.inbounds.finalmask.noise') },
                        ]
                  }
                />
              </Form.Item>

              {['mkcp-aes128gcm', 'salamander'].includes(mask.type) && (
                <Form.Item label={t('pages.inbounds.finalmask.password')}>
                  <Input
                    value={(mask.settings.password as string) || ''}
                    placeholder={t('pages.inbounds.finalmask.obfuscationPassword')}
                    onChange={(e) => {
                      (mask.settings as Record<string, unknown>).password = e.target.value;
                      notify();
                    }}
                  />
                </Form.Item>
              )}

              {mask.type === 'header-dns' && (
                <Form.Item label={t('pages.inbounds.finalmask.domain')}>
                  <Input
                    value={(mask.settings.domain as string) || ''}
                    placeholder={t('pages.inbounds.finalmask.domainPlaceholder')}
                    onChange={(e) => {
                      (mask.settings as Record<string, unknown>).domain = e.target.value;
                      notify();
                    }}
                  />
                </Form.Item>
              )}

              {mask.type === 'xdns' && (
                <Form.Item label={t('pages.inbounds.finalmask.domains')}>
                  <Select
                    mode="tags"
                    value={(mask.settings.domains as string[]) || []}
                    style={{ width: '100%' }}
                    tokenSeparators={[',']}
                    placeholder={t('pages.inbounds.finalmask.domainPlaceholder')}
                    onChange={(v) => {
                      (mask.settings as Record<string, unknown>).domains = v;
                      notify();
                    }}
                  />
                </Form.Item>
              )}

              {mask.type === 'noise' && (
                <NoiseItems mask={mask} onChange={notify} />
              )}

              {mask.type === 'header-custom' && (
                <UdpHeaderCustom mask={mask} onChange={notify} />
              )}

              {mask.type === 'xicmp' && (
                <>
                  <Form.Item label={t('pages.inbounds.finalmask.ip')}>
                    <Input
                      value={(mask.settings.ip as string) || ''}
                      placeholder={t('pages.inbounds.finalmask.ipPlaceholder')}
                      onChange={(e) => {
                        (mask.settings as Record<string, unknown>).ip = e.target.value;
                        notify();
                      }}
                    />
                  </Form.Item>
                  <Form.Item label={t('pages.inbounds.finalmask.itemId')}>
                    <InputNumber
                      value={(mask.settings.id as number) || 0}
                      min={0}
                      onChange={(v) => {
                        (mask.settings as Record<string, unknown>).id = Number(v) || 0;
                        notify();
                      }}
                    />
                  </Form.Item>
                </>
              )}
            </div>
          ))}
        </>
      )}

      {showQuic && (
        <>
          <Form.Item label={t('pages.inbounds.finalmask.quicParams')}>
            <Switch
              checked={!!stream.finalmask.enableQuicParams}
              onChange={(v) => {
                stream.finalmask.enableQuicParams = v;
                notify();
              }}
            />
          </Form.Item>
          {stream.finalmask.enableQuicParams && stream.finalmask.quicParams && (
            <QuicParamsForm params={stream.finalmask.quicParams} onChange={notify} />
          )}
        </>
      )}
    </Form>
  );
}

function HeaderCustomGroups({
  mask,
  kind: _kind,
  onChange,
}: {
  mask: MaskRow;
  kind: 'tcp';
  onChange: () => void;
}) {
  const { t } = useTranslation();
  const settings = mask.settings as { clients?: ItemRow[][]; servers?: ItemRow[][] };
  if (!settings.clients) settings.clients = [];
  if (!settings.servers) settings.servers = [];

  return (
    <>
      {(['clients', 'servers'] as const).map((groupKey) => (
        <div key={groupKey}>
          <Form.Item label={groupKey === 'clients' ? t('pages.inbounds.finalmask.clients') : t('pages.inbounds.finalmask.servers')}>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                (settings[groupKey] as ItemRow[][]).push([newClientServerItem()]);
                onChange();
              }}
            />
          </Form.Item>
          {(settings[groupKey] as ItemRow[][]).map((group, gi) => (
            <div key={`${groupKey}-${gi}`}>
              <Divider style={{ margin: 0 }}>
                {groupKey === 'clients' ? t('pages.inbounds.finalmask.clientsGroup', { index: gi + 1 }) : t('pages.inbounds.finalmask.serversGroup', { index: gi + 1 })}
                <DeleteOutlined
                  style={{ color: 'rgb(255, 77, 79)', cursor: 'pointer', marginLeft: 8 }}
                  onClick={() => {
                    (settings[groupKey] as ItemRow[][]).splice(gi, 1);
                    onChange();
                  }}
                />
              </Divider>
              {group.map((item, _ii) => (
                <ItemEditor key={_ii} item={item} onChange={onChange} delayAsNumber />
              ))}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function UdpHeaderCustom({ mask, onChange }: { mask: MaskRow; onChange: () => void }) {
  const { t } = useTranslation();
  const settings = mask.settings as { client?: ItemRow[]; server?: ItemRow[] };
  if (!settings.client) settings.client = [];
  if (!settings.server) settings.server = [];
  return (
    <>
      {(['client', 'server'] as const).map((groupKey) => (
        <div key={groupKey}>
          <Form.Item label={groupKey === 'client' ? t('pages.inbounds.finalmask.client') : t('pages.inbounds.finalmask.server')}>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                (settings[groupKey] as ItemRow[]).push(newUdpClientServerItem());
                onChange();
              }}
            />
          </Form.Item>
          {(settings[groupKey] as ItemRow[]).map((item, ci) => (
            <div key={ci}>
              <Divider style={{ margin: 0 }}>
                {groupKey === 'client' ? t('pages.inbounds.finalmask.clientItem', { index: ci + 1 }) : t('pages.inbounds.finalmask.serverItem', { index: ci + 1 })}
                <DeleteOutlined
                  style={{ color: 'rgb(255, 77, 79)', cursor: 'pointer', marginLeft: 8 }}
                  onClick={() => {
                    (settings[groupKey] as ItemRow[]).splice(ci, 1);
                    onChange();
                  }}
                />
              </Divider>
              <ItemEditor item={item} onChange={onChange} />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function NoiseItems({ mask, onChange }: { mask: MaskRow; onChange: () => void }) {
  const { t } = useTranslation();
  const settings = mask.settings as { reset?: number; noise?: ItemRow[] };
  if (!settings.noise) settings.noise = [];

  return (
    <>
      <Form.Item label={t('pages.inbounds.finalmask.noiseReset')}>
        <InputNumber
          value={settings.reset || 0}
          min={0}
          onChange={(v) => {
            settings.reset = Number(v) || 0;
            onChange();
          }}
        />
      </Form.Item>
      <Form.Item label={t('pages.inbounds.finalmask.noise')}>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => {
            (settings.noise as ItemRow[]).push(newNoiseItem());
            onChange();
          }}
        />
      </Form.Item>
      {(settings.noise as ItemRow[]).map((n, ni) => (
        <div key={ni}>
          <Divider style={{ margin: 0 }}>
            {t('pages.inbounds.finalmask.noiseItem', { index: ni + 1 })}
            <DeleteOutlined
              style={{ color: 'rgb(255, 77, 79)', cursor: 'pointer', marginLeft: 8 }}
              onClick={() => {
                (settings.noise as ItemRow[]).splice(ni, 1);
                onChange();
              }}
            />
          </Divider>
          <ItemEditor item={n} onChange={onChange} delayAsString />
        </div>
      ))}
    </>
  );
}

function ItemEditor({
  item,
  onChange,
  delayAsNumber,
  delayAsString,
}: {
  item: ItemRow;
  onChange: () => void;
  delayAsNumber?: boolean;
  delayAsString?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Form.Item label={t('pages.inbounds.finalmask.type')}>
        <Select
          value={item.type}
          onChange={(v) => {
            changeItemType(item, v);
            onChange();
          }}
          options={[
            { value: 'array', label: t('pages.inbounds.finalmask.array') },
            { value: 'str', label: t('pages.inbounds.finalmask.string') },
            { value: 'hex', label: t('pages.inbounds.finalmask.hex') },
            { value: 'base64', label: t('pages.inbounds.finalmask.base64') },
          ]}
        />
      </Form.Item>
      {delayAsNumber && (
        <Form.Item label={t('pages.inbounds.finalmask.delayMs')}>
          <InputNumber
            value={typeof item.delay === 'number' ? item.delay : 0}
            min={0}
            onChange={(v) => {
              item.delay = Number(v) || 0;
              onChange();
            }}
          />
        </Form.Item>
      )}
      {item.type === 'array' ? (
        <>
          <Form.Item label={t('pages.inbounds.finalmask.rand')}>
            {delayAsString ? (
              <Input
                value={String(item.rand ?? '')}
                onChange={(e) => {
                  item.rand = e.target.value;
                  onChange();
                }}
                placeholder={t('pages.inbounds.finalmask.randPlaceholder')}
              />
            ) : (
              <InputNumber
                value={typeof item.rand === 'number' ? item.rand : 0}
                min={0}
                onChange={(v) => {
                  item.rand = Number(v) || 0;
                  onChange();
                }}
              />
            )}
          </Form.Item>
          <Form.Item label={t('pages.inbounds.finalmask.randRange')}>
            <Input
              value={item.randRange || ''}
              placeholder={t('pages.inbounds.finalmask.randRangePlaceholder')}
              onChange={(e) => {
                item.randRange = e.target.value;
                onChange();
              }}
            />
          </Form.Item>
        </>
      ) : (
        <Form.Item label={t('pages.inbounds.finalmask.packet')}>
          {item.type === 'base64' ? (
            <Input.Group compact>
              <Input
                value={String(item.packet ?? '')}
                placeholder={t('pages.inbounds.finalmask.binaryData')}
                style={{ width: 'calc(100% - 32px)' }}
                onChange={(e) => {
                  item.packet = e.target.value;
                  onChange();
                }}
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  item.packet = RandomUtil.randomBase64();
                  onChange();
                }}
              />
            </Input.Group>
          ) : (
            <Input
              value={String(item.packet ?? '')}
              placeholder={t('pages.inbounds.finalmask.binaryData')}
              onChange={(e) => {
                item.packet = e.target.value;
                onChange();
              }}
            />
          )}
        </Form.Item>
      )}
      {delayAsString && (
        <Form.Item label={t('pages.inbounds.finalmask.delay')}>
          <Input
            value={typeof item.delay === 'string' ? item.delay : ''}
            placeholder={t('pages.inbounds.finalmask.delayPlaceholder')}
            onChange={(e) => {
              item.delay = e.target.value;
              onChange();
            }}
          />
        </Form.Item>
      )}
    </>
  );
}

function QuicParamsForm({ params, onChange }: { params: QuicParams; onChange: () => void }) {
  const { t } = useTranslation();
  function update<K extends keyof QuicParams>(key: K, value: QuicParams[K]) {
    params[key] = value;
    onChange();
  }
  return (
    <>
      <Form.Item label={t('pages.inbounds.finalmask.congestion')}>
        <Select
          value={params.congestion}
          onChange={(v) => update('congestion', v)}
          options={[
            { value: 'reno', label: t('pages.inbounds.finalmask.reno') },
            { value: 'bbr', label: t('pages.inbounds.finalmask.bbr') },
            { value: 'brutal', label: t('pages.inbounds.finalmask.brutal') },
            { value: 'force-brutal', label: t('pages.inbounds.finalmask.forceBrutal') },
          ]}
        />
      </Form.Item>
      <Form.Item label={t('pages.inbounds.finalmask.debug')}>
        <Switch checked={!!params.debug} onChange={(v) => update('debug', v)} />
      </Form.Item>
      {['brutal', 'force-brutal'].includes(params.congestion) && (
        <>
          <Form.Item label={t('pages.inbounds.finalmask.brutalUp')}>
            <Input
              value={String(params.brutalUp ?? '')}
              placeholder={t('pages.inbounds.finalmask.brutalUpPlaceholder')}
              onChange={(e) => update('brutalUp', e.target.value)}
            />
          </Form.Item>
          <Form.Item label={t('pages.inbounds.finalmask.brutalDown')}>
            <Input
              value={String(params.brutalDown ?? '')}
              placeholder={t('pages.inbounds.finalmask.brutalDownPlaceholder')}
              onChange={(e) => update('brutalDown', e.target.value)}
            />
          </Form.Item>
        </>
      )}
      <Form.Item label={t('pages.inbounds.finalmask.udpHop')}>
        <Switch checked={!!params.hasUdpHop} onChange={(v) => update('hasUdpHop', v)} />
      </Form.Item>
      {params.hasUdpHop && params.udpHop && (
        <>
          <Form.Item label={t('pages.inbounds.finalmask.hopPorts')}>
            <Input
              value={params.udpHop.ports || ''}
              placeholder={t('pages.inbounds.finalmask.hopPortsPlaceholder')}
              onChange={(e) => {
                params.udpHop!.ports = e.target.value;
                onChange();
              }}
            />
          </Form.Item>
          <Form.Item label={t('pages.inbounds.finalmask.hopInterval')}>
            <InputNumber
              value={Number(params.udpHop.interval) || 5}
              min={5}
              onChange={(v) => {
                params.udpHop!.interval = Number(v) || 5;
                onChange();
              }}
            />
          </Form.Item>
        </>
      )}
      {(
        [
          ['maxIdleTimeout', t('pages.inbounds.finalmask.maxIdleTimeout'), 4, 120],
          ['keepAlivePeriod', t('pages.inbounds.finalmask.keepAlivePeriod'), 2, 60],
        ] as const
      ).map(([key, label, min, max]) => (
        <Form.Item key={key} label={label}>
          <InputNumber
            value={params[key] as number}
            min={min}
            max={max}
            onChange={(v) => update(key, Number(v) || min)}
          />
        </Form.Item>
      ))}
      <Form.Item label={t('pages.inbounds.finalmask.disablePathMtu')}>
        <Switch checked={!!params.disablePathMTUDiscovery} onChange={(v) => update('disablePathMTUDiscovery', v)} />
      </Form.Item>
      {(
        [
          ['maxIncomingStreams', t('pages.inbounds.finalmask.maxIncomingStreams'), 8, '1024 = default'],
          ['initStreamReceiveWindow', t('pages.inbounds.finalmask.initStreamWindow'), 16384, '8388608 = default'],
          ['maxStreamReceiveWindow', t('pages.inbounds.finalmask.maxStreamWindow'), 16384, '8388608 = default'],
          ['initConnectionReceiveWindow', t('pages.inbounds.finalmask.initConnWindow'), 16384, '20971520 = default'],
          ['maxConnectionReceiveWindow', t('pages.inbounds.finalmask.maxConnWindow'), 16384, '20971520 = default'],
        ] as const
      ).map(([key, label, min, placeholder]) => (
        <Form.Item key={key} label={label}>
          <InputNumber
            value={params[key] as number}
            min={min}
            placeholder={placeholder}
            onChange={(v) => update(key, Number(v) || 0)}
          />
        </Form.Item>
      ))}
    </>
  );
}
