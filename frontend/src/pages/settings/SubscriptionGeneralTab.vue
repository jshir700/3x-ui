<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import SettingListItem from '@/components/SettingListItem.vue';

const { t } = useI18n();

const props = defineProps({
  allSetting: { type: Object, required: true },
});

const subLinkHint = computed(() => {
  const host = window.location.hostname;
  const port = props.allSetting.subPort || '2096';
  const path = props.allSetting.subPath || '/sub/';
  const customAddr = props.allSetting.subUriAddress;
  if (customAddr) {
    const scheme = props.allSetting.subUriScheme || 'https';
    const cPort = props.allSetting.subUriPort;
    const cPath = props.allSetting.subUriPath || '/';
    const hostPart = cPort ? `${customAddr}:${cPort}` : customAddr;
    const finalPath = cPath.endsWith('/') ? cPath : cPath + '/';
    return t('subLinkHint', { scheme, hostPart, finalPath }) || `${scheme}://${hostPart}${finalPath}{subId}`;
  }
  const hostPart = port ? `${host}:${port}` : host;
  return t('subLinkHint2', { protocol: window.location.protocol, hostPart, path }) || `${window.location.protocol}//${hostPart}${path}{subId}`;
});

// Sub path
const subPath = computed({
  get: () => props.allSetting.subPath,
  set: (v) => {
    props.allSetting.subPath = String(v ?? '').replace(/[:*]/g, '');
  },
});
function normalizeSubPath() {
  let p = props.allSetting.subPath || '/';
  if (!p.startsWith('/')) p = '/' + p;
  if (!p.endsWith('/')) p += '/';
  p = p.replace(/\/+/g, '/');
  props.allSetting.subPath = p;
}

// Sub URI segments
const subUriScheme = computed({
  get: () => props.allSetting.subUriScheme || 'https',
  set: (v) => { props.allSetting.subUriScheme = v; },
});
const subUriAddress = computed({
  get: () => props.allSetting.subUriAddress || '',
  set: (v) => { props.allSetting.subUriAddress = v; },
});
const subUriPort = computed({
  get: () => props.allSetting.subUriPort || null,
  set: (v) => { props.allSetting.subUriPort = v || null; },
});
const subUriPath = computed({
  get: () => props.allSetting.subUriPath || '/',
  set: (v) => {
    let p = String(v ?? '/');
    if (!p.startsWith('/')) p = '/' + p;
    props.allSetting.subUriPath = p;
  },
});
</script>

<template>
  <a-collapse default-active-key="1">
    <a-collapse-panel key="1" :header="t('pages.settings.panelSettings')">
      <SettingListItem paddings="small">
        <template #title>{{ t('pages.settings.subEnable') }}</template>
        <template #description>{{ t('pages.settings.subEnableDesc') }}</template>
        <template #control>
          <a-switch v-model:checked="allSetting.subEnable" />
          <div v-if="allSetting.subEnable" class="sub-control-hint">
            {{ subLinkHint }}
          </div>
        </template>
      </SettingListItem>

      <SettingListItem paddings="small">
        <template #title>{{ t('pages.settings.subListen') }}</template>
        <template #description>{{ t('pages.settings.subListenDesc') }}</template>
        <template #control>
          <a-input v-model:value="allSetting.subListen" type="text" />
        </template>
      </SettingListItem>

      <SettingListItem paddings="small">
        <template #title>{{ t('pages.settings.subDomain') }}</template>
        <template #description>{{ t('pages.settings.subDomainDesc') }}</template>
        <template #control>
          <a-input v-model:value="allSetting.subDomain" type="text" />
        </template>
      </SettingListItem>

      <SettingListItem paddings="small">
        <template #title>{{ t('pages.settings.subPort') }}</template>
        <template #description>{{ t('pages.settings.subPortDesc') }}</template>
        <template #control>
          <a-input-number v-model:value="allSetting.subPort" :min="1" :max="65535" :style="{ width: '100%' }" />
        </template>
      </SettingListItem>

      <SettingListItem paddings="small">
        <template #title>{{ t('pages.settings.subPath') }}</template>
        <template #description>{{ t('pages.settings.subPathDesc') }}</template>
        <template #control>
          <a-input v-model:value="subPath" type="text" placeholder="/sub/" @blur="normalizeSubPath" />
        </template>
      </SettingListItem>

      <SettingListItem paddings="small">
        <template #title>{{ t('pages.settings.subURI') }}</template>
        <template #description>{{ t('pages.settings.subURIDesc') }}</template>
        <template #control>
          <a-space direction="vertical" style="width:100%">
            <a-row :gutter="8">
              <a-col :span="3">
                <a-select v-model:value="subUriScheme" style="width:100%">
                  <a-select-option value="https">https</a-select-option>
                  <a-select-option value="http">http</a-select-option>
                </a-select>
              </a-col>
              <a-col :span="11">
                <a-input v-model:value="subUriAddress" :placeholder="t('pages.settings.subUriAddressPlaceholder')"
                  @blur="v => { subUriAddress.value = (subUriAddress.value || '').replace(/^https?:\/\//, '').trim(); }" />
              </a-col>
              <a-col :span="3">
                <a-input-number v-model:value="subUriPort" :min="1" :max="65535" style="width:100%" :placeholder="t('subPortLabel')" />
              </a-col>
              <a-col :span="7">
                <a-input v-model:value="subUriPath" placeholder="/" />
              </a-col>
            </a-row>
          </a-space>
        </template>
      </SettingListItem>
    </a-collapse-panel>

    <a-collapse-panel key="2" :header="t('pages.settings.information')">
      <SettingListItem paddings="small">
        <template #title>{{ t('pages.settings.subEncrypt') }}</template>
        <template #description>{{ t('pages.settings.subEncryptDesc') }}</template>
        <template #control>
          <a-switch v-model:checked="allSetting.subEncrypt" />
        </template>
      </SettingListItem>

      <SettingListItem paddings="small">
        <template #title>{{ t('pages.settings.subShowInfo') }}</template>
        <template #description>{{ t('pages.settings.subShowInfoDesc') }}</template>
        <template #control>
          <a-switch v-model:checked="allSetting.subShowInfo" />
        </template>
      </SettingListItem>

      <SettingListItem paddings="small">
        <template #title>{{ t('pages.settings.subEmailInRemark') }}</template>
        <template #description>{{ t('pages.settings.subEmailInRemarkDesc') }}</template>
        <template #control>
          <a-switch v-model:checked="allSetting.subEmailInRemark" />
        </template>
      </SettingListItem>

      <a-divider>{{ t('pages.settings.subTitle') }}</a-divider>

      <SettingListItem paddings="small">
        <template #title>{{ t('pages.settings.subTitle') }}</template>
        <template #description>{{ t('pages.settings.subTitleDesc') }}</template>
        <template #control>
          <a-input v-model:value="allSetting.subTitle" type="text" />
        </template>
      </SettingListItem>

      <SettingListItem paddings="small">
        <template #title>{{ t('pages.settings.subSupportUrl') }}</template>
        <template #description>{{ t('pages.settings.subSupportUrlDesc') }}</template>
        <template #control>
          <a-input v-model:value="allSetting.subSupportUrl" type="text" placeholder="https://example.com" />
        </template>
      </SettingListItem>

      <SettingListItem paddings="small">
        <template #title>{{ t('pages.settings.subProfileUrl') }}</template>
        <template #description>{{ t('pages.settings.subProfileUrlDesc') }}</template>
        <template #control>
          <a-input v-model:value="allSetting.subProfileUrl" type="text" placeholder="https://example.com" />
        </template>
      </SettingListItem>

      <SettingListItem paddings="small">
        <template #title>{{ t('pages.settings.subAnnounce') }}</template>
        <template #description>{{ t('pages.settings.subAnnounceDesc') }}</template>
        <template #control>
          <a-textarea v-model:value="allSetting.subAnnounce" />
        </template>
      </SettingListItem>

      <a-divider>Happ</a-divider>

      <SettingListItem paddings="small">
        <template #title>{{ t('pages.settings.subEnableRouting') }}</template>
        <template #description>{{ t('pages.settings.subEnableRoutingDesc') }}</template>
        <template #control>
          <a-switch v-model:checked="allSetting.subEnableRouting" />
        </template>
      </SettingListItem>

      <SettingListItem paddings="small">
        <template #title>{{ t('pages.settings.subRoutingRules') }}</template>
        <template #description>{{ t('pages.settings.subRoutingRulesDesc') }}</template>
        <template #control>
          <a-textarea v-model:value="allSetting.subRoutingRules" placeholder="happ://routing/add/..." />
        </template>
      </SettingListItem>
    </a-collapse-panel>

    <a-collapse-panel key="3" :header="t('pages.settings.certs')">
      <SettingListItem paddings="small">
        <template #title>{{ t('pages.settings.subCertPath') }}</template>
        <template #description>{{ t('pages.settings.subCertPathDesc') }}</template>
        <template #control>
          <a-input v-model:value="allSetting.subCertFile" type="text" />
        </template>
      </SettingListItem>

      <SettingListItem paddings="small">
        <template #title>{{ t('pages.settings.subKeyPath') }}</template>
        <template #description>{{ t('pages.settings.subKeyPathDesc') }}</template>
        <template #control>
          <a-input v-model:value="allSetting.subKeyFile" type="text" />
        </template>
      </SettingListItem>
    </a-collapse-panel>

    <a-collapse-panel key="4" :header="t('pages.settings.intervals')">
      <SettingListItem paddings="small">
        <template #title>{{ t('pages.settings.subUpdates') }}</template>
        <template #description>{{ t('pages.settings.subUpdatesDesc') }}</template>
        <template #control>
          <a-input-number v-model:value="allSetting.subUpdates" :min="1" :style="{ width: '100%' }" />
        </template>
      </SettingListItem>
    </a-collapse-panel>
  </a-collapse>
</template>

<style scoped>
.sub-control-hint {
  font-size: 12px;
  color: #999;
  margin-top: 6px;
  line-height: 1.5;
}
</style>
