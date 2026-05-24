# Changelog

本文件按时间倒序记录所有代码修改，每个条目记录原因、改动文件、如何回退。

---

## 2026-05-21 — 修复导出订阅时多客户端入站选中丢失 + email→clientId 转换

### 根因
1. `selectedClientIds` 存储的是 `rowKey`（email 字符串），但 `SubscriptionFormModal` 的 `__subPreselectIds` 需要数字 `clientId`，直接拼接 `"id:email"` 导致 `parseInt(email) → NaN`，匹配失败。
2. 勾选客户端 checkbox 时 `selectedClientIds` 更新但 `selectedIds` 未同步添加对应入站 ID，导致 `exportAllSubs()` 的遍历只覆盖了行 checkbox 勾选的入站。

### 修复
1. `onClientSelectionChange` — 当 ids 非空且 inboundId 不在 `selectedIds` 时，同步加入。
2. `exportAllSubs` — 从 `dbInbounds` 的 settings JSON 构建 `emailToClientId` 映射，遍历时通过 email 查到数字 clientId 后再拼接 `"id:clientId"`。

### 文件清单
| 文件 | 改动 |
|------|------|
| `frontend/src/pages/inbounds/InboundsPage.vue` | `onClientSelectionChange` 同步 selectedIds；`exportAllSubs` 增加 email→clientId 转换 |

### 回退
1. 恢复 `onClientSelectionChange` 的旧版（不加 selectedIds）
2. 恢复 `exportAllSubs` 的旧版（直接拼接 sc[id]）

---

### 改动
1. `SubscriptionFormModal.vue` — `extractInboundClients` 增加 `enable`/`expiryTime`；`flatInboundList` 计算 `active` 字段（级联判断入站+客户端）；模板加 `inactive-item`/`text-danger` 红色标记
2. `SubscriptionPage.vue` — 构建 `clientActiveMap`；`enabledIds` 过滤过期入站；`clientCount` 只计活跃客户端；`activeClientCount/totalClientCount` 格式显示

### 文件清单
| 文件 | 改动 |
|------|------|
| `frontend/src/pages/subscription/SubscriptionFormModal.vue` | `extractInboundClients` + `flatInboundList` + 模板/样式 |
| `frontend/src/pages/subscription/SubscriptionPage.vue` | `tableData` 增加 clientActiveMap/expiry 过滤 |

### 回退
恢复 `extractInboundClients`、`flatInboundList`、`tableData`、模板的旧版

---

### 根因
`tableData` computed 每次重算都用 `{ ...s, ... }` 展开全新对象，`a-table` 收到全新 data-source 引用后重建行组件，导致行位置"闪烁/切换"。

### 修复
`return { ...s, ... }` → `return Object.assign(s, { ... })`，原地修改 `s` 对象引用，`a-table` 的 rowKey 和对象引用都保持不变。

### 文件清单
| 文件 | 改动 |
|------|------|
| `frontend/src/pages/subscription/SubscriptionPage.vue` | `tableData` 的 return 从 spread 改为 Object.assign |

### 回退
恢复 `return { ...s, ... }` 展开

---

### 改动
1. `SubscriptionPage.vue` 的 `tableData` 从使用 `ib.up/down/total` 改为使用 `ib.clientStats` 数组
2. 整入站选中 → 汇总所有 clientStats 的流量；客户端级选中 → 按 email 匹配后只汇总该客户端流量
3. 配额逻辑：选中客户端配额之和 ≤ 入站配额 → 用客户端之和；否则取入站配额

### 文件清单
| 文件 | 改动 |
|------|------|
| `frontend/src/pages/subscription/SubscriptionPage.vue` | `tableData` 增加 `clientEmailMap` 构建 + 按 ref 类型分流 traffic/quota |

### 回退
恢复 `tableData` 为旧版：直接 `ib.up/down/total` 求和

---

### 根因
`SubscriptionPage.vue` 的 `tableData` 中用 `(s.inboundIds || '').split(',').map(Number).filter(Boolean)` 解析入站 ID。当 `inboundIds` 包含客户端级引用 `"1:3"` 时，`map(Number)` 产生 `NaN`，`filter(Boolean)` 将 `NaN` 筛掉，导致入站数总是 0。

### 修复
1. 改用 `part.split(':')[0]` 提取 `inboundId`，去重后统计入站数
2. 统计含 `:` 的条目标记为客户端数（新增列 `subClients`）
3. 13 个语言文件增加 `subClients` 翻译

### 文件清单
| 文件 | 改动 |
|------|------|
| `frontend/src/pages/subscription/SubscriptionPage.vue` | `tableData` 解析逻辑 + 列定义 |
| `web/translation/en-US.json` | 加 `"subClients": "Clients"` |
| `web/translation/zh-CN.json` | 加 `"subClients": "客户端数"` |
| `web/translation/ar-EG.json` | 加 `"subClients": "العملاء"` |
| `web/translation/es-ES.json` | 加 `"subClients": "Clientes"` |
| `web/translation/fa-IR.json` | 加 `"subClients": "مشتریان"` |
| `web/translation/id-ID.json` | 加 `"subClients": "Klien"` |
| `web/translation/ja-JP.json` | 加 `"subClients": "クライアント数"` |
| `web/translation/pt-BR.json` | 加 `"subClients": "Clientes"` |
| `web/translation/ru-RU.json` | 加 `"subClients": "Клиенты"` |
| `web/translation/tr-TR.json` | 加 `"subClients": "İstemciler"` |
| `web/translation/uk-UA.json` | 加 `"subClients": "Клієнти"` |
| `web/translation/vi-VN.json` | 加 `"subClients": "Khách hàng"` |
| `web/translation/zh-TW.json` | 加 `"subClients": "客戶端數"` |

### 回退
1. 恢复 `SubscriptionPage.vue` 的 `.split(',').map(Number)` 解析
2. 删除 13 个语言文件的 `subClients` key

---

### 根因
`SubscriptionFormModal` 的 `flatInboundList` 对 1 客户端入站生成 key 为 `inbound-{id}`（`inboundItemKey`）。保存时写为 `"inboundId:clientId"`。编辑回读时只用 `clientItemKey`（`"client-{id}-{clientId}"`）查找，找不到１客户端入站的条目。

### 修复
编辑回读时先按 `clientItemKey` 查找，找不到时回退到 `inboundItemKey`：
```js
let item = flatItemMap.get(clientItemKey(inboundKey, clientId));
if (!item) item = flatItemMap.get(inboundItemKey(inboundKey));
```

### 文件清单
| 文件 | 改动 |
|------|------|
| `frontend/src/pages/subscription/SubscriptionFormModal.vue` | 编辑回读增加 key 回退查找 |

### 回退
删除第 553-555 行的 fallback 回退逻辑

---

## 2026-05-21 — 行操作"导出订阅链接"改为单客户端自动选中、多客户端空选

### 根因
行操作 `case 'subs'` 之前设置 `__subPreselectIds = [dbInbound.id]`（数字），`SubscriptionFormModal` 视作选中整个入站及其所有客户端。

### 修复
改为检查客户端数：
- 1 个客户端 → 用 `"inboundId:clientId"` 格式预选该客户端
- 2+ 个客户端或 0 个 → `[]` 空数组，什么都不预选

### 文件清单
| 文件 | 改动 |
|------|------|
| `frontend/src/pages/inbounds/InboundsPage.vue` | `case 'subs'` 增加客户端数判断 + 预选逻辑 |

### 回退
恢复 `case 'subs'` 为 `window.__subPreselectIds = [dbInbound.id]`

---

## 2026-05-21 — 工具栏"导出订阅链接"默认改为空选

### 根因
工具栏 `exportAllSubs()` 之前默认选中所有启用入站。

### 修复
改为 `const preselect = []`，空选。

### 文件清单
| 文件 | 改动 |
|------|------|
| `frontend/src/pages/inbounds/InboundsPage.vue` | `exportAllSubs()` 的 preselect 从 `targets.map(id)` 改为 `[]` |

### 回退
恢复 `exportAllSubs()` 的 `let targets = ... ; preselect = targets.map(ib => ib.id)`

---

## 2026-05-20 — 修复收起后重新展开入站客户端不自动选中

### 根因
`ClientRowTable` 在首次展开挂载时 `watch(clients, {immediate: true})` 触发 INIT 路径选中第一个客户端。收起后重新展开时，`clients` computed 引用未变（同一 DBInbound 对象），watch 不触发回调，`localSelected` 保持空集。

### 修复
在 `InboundList.vue` 中增加 `expandCounter` reactive 对象，每次展开时计数器 +1。两个 `<ClientRowTable>` 模板加 `:key="'crt-' + record.id + '-' + expandCounter[id]"`。key 变化后 Vue 销毁旧组件创建新组件，`watch(clients)` 重新 INIT，自动选中第一个客户端。

### 文件清单
| 文件 | 改动 |
|------|------|
| `frontend/src/pages/inbounds/InboundList.vue` | 新增 `expandCounter`、`onExpand` 递增、两处 `:key` |

### 回退
删除 `expandCounter`、`onExpand` 中递增代码、两处 `:key`

---

## 2026-05-20 — AddInbound 后端防御性 enable 写入修复

### 根因
`AddInbound` 中 `tx.Save(inbound)` 在 WAL 模式下可能因写入可见性问题导致 `enable` 字段未被正确持久化，部分入站创建后显示 `enable=false`。

### 修复
在 `tx.Save` 之后增加一条显式的 `UPDATE enable` 语句，确保值被正确提交:
```go
tx.Model(&model.Inbound{}).Where("id = ?", inbound.Id).Update("enable", inbound.Enable)
```

### 文件清单
| 文件 | 改动 |
|------|------|
| `web/service/inbound.go` | `AddInbound` 增加防御性 enable 更新 |

### 回退
删除 `AddInbound` 中第 539-543 行的防御性 update 代码

---

## 2026-05-20 — 修复 a-switch 行复用导致 enable 显示不同步

### 根因
`a-table` 在收到新 `data-source` 后，会通过 `rowKey` 比对发现 id 没变，`复用旧的 DOM 行`，只更新 props。`a-switch` 的内部 `checked` 状态缓存不会跟随 prop 更新，导致数据显示灰色。

### 修复
两个 `a-switch` 上加动态 `:key="'sw-' + record.id + '-' + record.enable"`。当 `record.enable` 变化时，key 改变，Vue 销毁旧 switch 并创建新 switch，强制从新 props 读取 `:checked`。

### 验证
- `classList.contains('ant-switch-checked')` 返回 `false`（DOM 灰色）
- API 查询 `enable=true`（DB 正确）
- 加 `:key` 后行复用不再使用缓存状态

### 文件清单
| 文件 | 改动 |
|------|------|
| `frontend/src/pages/inbounds/InboundList.vue` | 两处 `a-switch` 添加 `:key` 表达式 |

### 回退
恢复 InboundList.vue 中两处 `:key` 的添加

---

## 2026-05-20 — 修复 enable 开关 FormData→JSON，开关 DB 写入成功

### 根因
`InboundList.vue` 的 `onSwitchEnable` 使用 `FormData`（`multipart/form-data`）发送 `{ enable: true/false }` 到 `/panel/api/inbounds/setEnable/:id`。Go 服务端的 `c.ShouldBind(f)` 对某些 Gin 版本/配置的 multipart 表单绑定可能未正确解析 boolean 字段，导致 `f.Enable` 一直是零值 `false`。服务端发现"和 DB 现有值一样"，直接返回成功但不做任何 DB 更新。前端乐观更新显示绿色，但实际 DB 从未写入，后续 `refresh()` 拉回 `false`，开关变灰且刷新后仍灰。

### 修复
将 `FormData` 改为 `{ enable: next }` 对象，axios 拦截器自动处理为 URL-encoded 格式，`c.ShouldBind(f)` 可以正确解析。

### 验证
浏览器 Console 用 JSON 格式手动调用 `fetch('/panel/api/inbounds/setEnable/1', { body: JSON.stringify({enable: true}) , headers: {'Content-Type':'application/json'} })` 返回 `{success: true}`，确认 JSON/URL-encoded 格式可以正常写入 DB。

### 文件清单
| 文件 | 改动 |
|------|------|
| `frontend/src/pages/inbounds/InboundList.vue` | `onSwitchEnable` 发送格式从 FormData 改为 JSON 对象 |

### 回退
恢复 `onSwitchEnable` 的 FormData 版本

---

## 2026-05-20 — 修复 JSON.parse 崩溃导致页面 loading + TDZ 调试日志

### Bug 1：JSON.parse 崩溃导致页面一直 loading

**根因**：测试数据创建脚本产生了一个 settings JSON 不合法（位置 118 语法错误），`toInbound()` 中的 `JSON.parse(this.settings)` 抛出异常，`setInbounds()` 中断，`fetched` 始终为 `false`，页面显示 loading 旋转。

**修复**：`toInbound()` 中所有三个 `JSON.parse`（settings、streamSettings、sniffing）包裹 `try/catch`，单个入站数据损坏不影响其他入站加载。

### Bug 2：SubscriptionFormModal TDZ 错误添加调试日志

在 `defineAsyncComponent` 的 `import()` 后加 `.catch(console.error)`，模块自身加 `console.log('[MODAL]')`，帮助定位循环依赖。

### 文件清单
| 文件 | 改动 |
|------|------|
| `frontend/src/models/dbinbound.js` | 3 个 JSON.parse 加 try/catch + console.warn |
| `frontend/src/pages/inbounds/InboundsPage.vue` | defineAsyncComponent 加 .catch 日志 |
| `frontend/src/pages/subscription/SubscriptionFormModal.vue` | 顶部加 console.log |

### 回退
1. 恢复 dbinbound.js 的 JSON.parse 不加 try/catch 版本
2. 删除 InboundsPage.vue 的 .catch 和 SubscriptionFormModal.vue 的 console.log

---

## 2026-05-20 — 修复取消所有客户端后入站多选框未取消选中

### 根因
`InboundsPage.vue` 的 `onClientSelectionChange` 函数只更新 `selectedClientIds`，但未从 `selectedIds` 中移除已清空的入站。`selectedIds` 和 `selectedClientIds` 两个状态无联动。

### 修复
`OnClientSelectionChange` 中当 `ids.length === 0` 时，从 `selectedIds` 中过滤掉该入站 ID：
```js
if (ids.length === 0) {
  selectedIds.value = selectedIds.value.filter(id => id !== inboundId);
}
```

### 附带清理
删除之前调试用的 `console.log('[SWITCH]')`。

### 文件清单
| 文件 | 改动 |
|------|------|
| `frontend/src/pages/inbounds/InboundsPage.vue` | `onClientSelectionChange` 增加 selectedIds 清理 |
| `frontend/src/pages/inbounds/InboundList.vue` | 删除调试 console.log |

### 回退
1. 删除 InboundsPage.vue 中 `if (ids.length === 0)` 代码块
2. 恢复 InboundList.vue 的 console.log

---

## 2026-05-20 — 修复启用开关卡顿 + 客户端首个 checkbox 无法取消勾选

### Bug 1：启用开关卡顿

**根因**：`dbInbounds` 是 `shallowRef`，`onSwitchEnable` 中 `dbInbound.enable = next` 修改对象属性但不改变数组引用，Vue 不重新渲染。开关只能等下一次 WebSocket 广播（5 秒周期）才会更新。

**修复**：
1. `InboundList.vue` — 新增 `'toggle-enable'` emit，乐观更新后和失败回退后各 emit 一次
2. `InboundsPage.vue` — 新增 `onToggleEnable()`，执行 `dbInbounds.value = [...dbInbounds.value]` 触发 shallowRef 重新渲染

### Bug 2：展开客户端后无法取消勾选第一个客户端

**根因**：`ClientRowTable.vue` 的第二个 `watch(() => props.selectedClientIds, ...)` 中 `localSelected.size === 0` 的条件无法区分"用户主动清空"和"从未初始化"→ 用户取消后 watch 自动重选第一个客户端，形成死循环。

**修复**：删除第二个 watch（第 236-243 行）。第一个 `watch(clients, { immediate: true })` 已能处理初始化和复用场景，第二个 watch 是冗余的。

### 文件清单
| 文件 | 改动 |
|------|------|
| `frontend/src/pages/inbounds/InboundList.vue` | 新增 `toggle-enable` emit，onSwitchEnable 中 emit |
| `frontend/src/pages/inbounds/InboundsPage.vue` | 新增 `onToggleEnable()`，InboundList 添加 `@toggle-enable` |
| `frontend/src/pages/inbounds/ClientRowTable.vue` | 删除第二个 watch 及 console.log |

### 回退
1. 删除 InboundList.vue 的 emit 调用和定义
2. 删除 InboundsPage.vue 的 onToggleEnable 和模板绑定
3. 恢复 ClientRowTable.vue 的第二个 watch

---

## 2026-05-20 — inbounds.js 改为动态导入 @/i18n，修复 SubscriptionFormModal 循环依赖 TDZ

### 根因
`inbounds.js` 第 7 行 `import { i18n, readyI18n } from '@/i18n/index.js'` 是静态导入，导致 Rolldown 将 `@/i18n` 并入 inbounds 主 chunk。`@/utils` 对 `@/i18n` 的动态 `import()` 被降级为同一 chunk 内的静态引用，配合 `@/i18n` 对 `@/utils` 的动态 `import()` 形成循环引用，产生 TDZ 错误 `Cannot access 'G' before initialization`。

### 修复
将 `inbounds.js` 对 `@/i18n` 的静态导入改为动态导入：
```js
// 改前
import { i18n, readyI18n } from '@/i18n/index.js';
readyI18n().then(() => { createApp(InboundsPage).use(Antd).use(i18n).mount('#app'); });

// 改后
import('@/i18n/index.js').then(({ i18n, readyI18n }) => {
  readyI18n().then(() => { createApp(InboundsPage).use(Antd).use(i18n).mount('#app'); });
});
```

### 验证
- `i18n-DBZf6jqw.js`（51.89 kB）成为独立 chunk
- 构建警告 `INEFFECTIVE_DYNAMIC_IMPORT` 关于 `@/i18n` 的已消失
- 所有页面正常加载（inbounds 2483 / settings 1980 / subscription 2497 / nodes 2294 / xray 2384）
- 50 入站 / 20 节点 / 20 订阅数据正常

### 回退
恢复 `inbounds.js` 的静态导入 `import { i18n, readyI18n } from '@/i18n/index.js'`

---

## 2026-05-20 — 修复入站多选框无法选中 + 启用开关 WebSocket 竞态

### Bug 1：多选框无法选中

**根因**：InboundsPage.vue 缺失 selectedIds ref + prop 绑定 + 事件监听。InboundList 的 row-selection 绑定到 props.selectedIds（默认 []），父组件从未传入或更新该值，checkbox 勾选状态无法保持。

**修复**：
1. 新增 `selectedIds` / `selectedClientIds` ref
2. 新增 `getSelectedInbounds()` / `onClientSelectionChange()` 函数
3. `<InboundList>` 模板补充 `:selected-ids`、`:selected-client-ids`、`@update:selected-ids`、`@update:selected-client-ids`

### Bug 2：打开启用开关→其他入站自动关闭

**根因**：`useInbounds.js:applyClientStatsEvent()` 第 202 行无条件覆盖 `ib.enable = upd.enable`。WebSocket 流量广播中的 `enable` 是 DB 快照值，与用户乐观更新产生竞态，导致所有入站的 enable 被服务器旧值批量冲掉。

**修复**：删除 `if (typeof upd.enable === 'boolean') ib.enable = upd.enable;` 行，流量 WebSocket 不再覆盖入站启用状态。

### 文件清单
| 文件 | 改动 |
|------|------|
| `frontend/src/pages/inbounds/InboundsPage.vue` | 新增 selectedIds/selectedClientIds 状态管理 + 4 个模板绑定 |
| `frontend/src/pages/inbounds/useInbounds.js` | 删除 enable 覆盖行 |

### 回退
1. 删除 InboundsPage.vue 中 selectedIds/selectedClientIds 相关代码和模板绑定
2. 恢复 useInbounds.js 的 `if (typeof upd.enable === 'boolean') ib.enable = upd.enable`

---

## 2026-05-20 — 修复 SubscriptionFormModal v-if 导致入站列表无法加载（根因分析 方案A）

### 根因
`InboundsPage.vue` 中 `<SubscriptionFormModal v-if="subFormOpen">` 导致组件被销毁重建。挂载时 `props.open` 已是 `true`，Vue 3 的 `watch(() => props.open, ...)` 默认不将挂载初始值视为变化，`loadInbounds()` 永不执行，入站列表为空。

### 修复
移除 `v-if="subFormOpen"`，与 `SubscriptionPage.vue` 保持一致的 `v-model:open` 用法。

### 伴随修复
1. 恢复因意外 `git checkout` 丢失的 `SubscriptionFormModal` 集成代码（import、状态变量、onSubSave、exportAllSubs、行操作 'subs'、模板组件）
2. 修复三个 shell 脚本（DockerInit.sh、DockerEntrypoint.sh、x-ui.sh）的 CRLF → LF 换行符，解决 Alpine 容器中 shebang 无法识别导致 Docker 构建失败的问题

### 文件清单
| 文件 | 改动 |
|------|------|
| `frontend/src/pages/inbounds/InboundsPage.vue` | 移除 `v-if`；恢复 import + state + onSubSave + exportAllSubs + row-action + template |
| `DockerInit.sh` | CRLF → LF |
| `DockerEntrypoint.sh` | CRLF → LF |
| `x-ui.sh` | CRLF → LF |

### 回退
1. 恢复 `v-if="subFormOpen"`（第 785 行）
2. 如需同时回退 SubscriptionFormModal 集成，`git checkout -- frontend/src/pages/inbounds/InboundsPage.vue`
3. 恢复 CRLF 换行符

---

### 根因 1：clientId 从未被前端类解析
`Inbound.ClientBase` 构造函数和 `commonArgsFromJson` 都没有 `clientId` 参数。
`VMESS.fromJson(json)` 通过 `commonArgsFromJson(json)` 传参时忽略 `json.clientId`，导致 `client.clientId` 始终为 `undefined`。
`emitSelection()` 发射 `[undefined]`，`selectedClientIds[id] = [undefined]`。

### 根因 2：emitSelection 在 setup 阶段触发重入循环
`watch(clients, ..., { immediate: true })` 在 setup 期间初始化 `localSelected` 后调用 `emitSelection()` → `onClientSelectionChange` → 修改 `selectedInboundIds` → ant-design-vue table 检测到变化并触发 `onChange` → `onUpdateSelectedIds` → `selectedClientIds[id] = []` → 又触发其他渲染 → 重复循环。

### 修复

| 文件 | 修改 |
|------|------|
| `inbound.js:2495-2520` | `ClientBase` 构造函数新增 `clientId` 参数 + `this.clientId = clientId` |
| `inbound.js:2522-2536` | `commonArgsFromJson` 末尾追加 `json.clientId \|\| 0` |
| `ClientRowTable.vue:264-267` | `emitSelection()` 从初始化路径中移除 — 不再 setup 阶段通知父组件 |

### 关键设计决定
初始化 `localSelected` 后不再调用 `emitSelection()`。父组件的 `selectedClientIds[id] = []` 对于导出已经是正确的语义（空 = 全选）。用户在 checkbox 上的手动交互才会触发 `emitSelection()` → 同步 `selectedClientIds`。

---

## 2026-05-19 — 修复 collapse → re-expand 后首客户端不选（watch 加 immediate:true）

### 根因
`watch(clients)` 无 `immediate: true`，若 `clients` 在 `setup()` 阶段已有最终值，watch 永不触发 → 初始化为 `Set{}` → 首客户端不选。`initLocalSelected()` 因 `clients.value` 在 setup 阶段尚未就绪产生 `Set{}`。

### 修复
- 移除 `initLocalSelected()` 函数 + `ref(initLocalSelected())`
- 改为 `ref(new Set())` + `watch(clients, ..., { immediate: true })`
- `immediate: true` 确保 watch 在 `setup()` 期间同步执行一次，此时若 `clients` 已有数据则正确初始化；若尚无数据则待数据到达后再次触发
- 初始化逻辑直接从 `list` 参数取值，不依赖 `props.selectedClientIds`

```js
const localSelected = ref(new Set());
watch(clients, (list) => {
  if (list.length === 0) return;
  if (localSelected.value.size === 0) {
    localSelected.value = list.length > 1
      ? new Set([rowKey(list[0])])
      : new Set(list.map(rowKey));
    emitSelection();
    return;
  }
  // 收敛逻辑...
}, { immediate: true });
```

---

## 2026-05-19 — 修复 collapse → re-expand 后 initLocalSelected 使用 stale props 不选首客户端

### 根因
`watch(clients)` 的延迟初始化路径调用 `initLocalSelected()`，此函数依赖 `props.selectedClientIds`（整个 map 对象）。经过 `InboundsPage → InboundList → ClientRowTable` 三层 prop 传递，Vue 在 collapse → re-expand 后的批处理更新中尚未将最新值送达组件，`initLocalSelected()` 以 stale 数据执行，产生 `Set{}`。

更具体的时序问题：`initLocalSelected()` 检查 `ids = props.selectedClientIds`（这是整个 `Record<inboundId, number[]>` 对象），`ids.length` 对对象为 `undefined`，条件恒为 `false`，因此**完全依赖** `clients.value`。但 `clients` computed 在 setup 阶段可能尚未就绪。当 `watch(clients)` 最终触发时，它又依赖 `initLocalSelected()` → `props.selectedClientIds`，而此时该 prop 可能是 stale 数据。

### 修复
`watch(clients)` 的空初始化路径改为直接从 `list` 参数（刚到达的 clients 数组）初始化，不依赖外部 prop：

```js
watch(clients, (list) => {
  if (list.length === 0) return;
  if (localSelected.value.size === 0) {
    localSelected.value = list.length > 1
      ? new Set([rowKey(list[0])])       // ← 直接从 list 取首客户端
      : new Set(list.map(rowKey));
    emitSelection();
    return;
  }
  // ... 收敛逻辑不变
});
```

---

## 2026-05-19 — 切断 @/utils ↔ @/i18n 循环依赖 + 静态导入 SubscriptionFormModal

### 循环依赖已彻底切断
`@/utils/index.js:3` 的 `import { t } from '@/i18n'` 已移除（替换为内联字符串），`@/i18n` → `@/utils` 的单向导入不再构成循环。

### 回退到静态导入
恢复 `InboundsPage.vue` 中 `SubscriptionFormModal` 的静态导入（移除 `defineAsyncComponent`）。由于循环依赖已切断，静态导入不再引起页面崩溃。

---

## 2026-05-19 — 切断 @/utils ↔ @/i18n 循环依赖，修复 async chunk ReferenceError

### 根因
`@/utils/index.js:3` 导入 `import { t } from '@/i18n'`，而 `@/i18n/index.js:3` 导入 `import { LanguageManager } from '@/utils'`，形成循环依赖。主 chunk 中模块排序恰巧正确，但 `defineAsyncComponent` 创建的独立 async chunk 中排序错误，导致 `Cannot access 'G' before initialization`。

### 修复
移除 `@/utils/index.js` 中的 `import { t } from '@/i18n'`，将唯一的 `t()` 调用替换为内联英文字符串：

```js
// 修改前
antMessage.error(t('subPortConflict', { port: m[1], names: m[2] }));
// 修改后
antMessage.error(`Port ${m[1]} conflict with enabled inbounds: ${m[2]}`);
```

该 `t()` 调用仅用于 API 端口冲突错误提示的本地化翻译，改为英文不影响功能逻辑。

---

## 2026-05-19 — 移除 useAllSetting 导入，消除 SubscriptionFormModal 循环依赖

### 根因
`SubscriptionFormModal.vue` 静态导入 `useAllSetting`（`@/pages/settings/useAllSetting.js`），该模块在 Rollup 打包时与 `@/models/setting.js` 等模块合并，产生循环变量引用。chunk 求值失败，`defineAsyncComponent` 的异步加载也无法渲染组件，`loadInbounds()` 未执行，入站列表为空。

### 修复
移除 `import { useAllSetting }` 及 `const { allSetting } = useAllSetting()` 调用。`useAllSetting` 仅用于构建订阅链接提示文字（`subLinkFor`），`subLinkFor` 改为固定格式的简易实现，不影响任何功能逻辑。

---

## 2026-05-19 — 恢复 SubscriptionFormModal 对话框（defineAsyncComponent）+ 恢复 exportAllSubs

### 问题
"导出订阅链接"被临时改为 `window.open('/panel/subscription')` 跳转到订阅页面，而非弹出创建订阅对话框。

### 修复
1. 用 `defineAsyncComponent` 异步加载 `SubscriptionFormModal`，避免静态导入导致的 Rollup 循环依赖
2. 恢复 `exportAllSubs` 函数为原来的 preselect 逻辑
3. 恢复行操作 `case 'subs'` 为原来的 `__subPreselectIds` + `subFormOpen`
4. 恢复模板中的 `<SubscriptionFormModal>` 组件

---

## 2026-05-19 — 修复 INIT 路径缺少 emitSelection 导致导出入站链接导出全部客户端

### 根因
`watch(clients) INIT` 设置 `localSelected = {firstClient}` 后未调用 `emitSelection()`。`selectedClientIds[id]` 保持 `onUpdateSelectedIds` 设置的 `[]`（空 = 全选语义）。`exportAllLinks` 读到空数组，导出所有客户端。

### 修复
INIT 末尾加回 `emitSelection()`。`toggleSelect` 的幂等性检查 `if (next === has) return;` 阻止了 mount 期 click 循环。

```js
if (localSelected.value.size === 0) {
  localSelected.value = ...;
  emitSelection();  // ← 加回
  return;
}
```

---

## 2026-05-19 — 修复 toggleSelect 幂等性检查：next === has 消除 mount 循环

### 根因
浏览器在程序化设置 `input.checked` 时仍会触发 `@click` 且 `isTrusted=true`。所有 checkboxes 的 mount 事件导致 `localSelected` 被反复修改。

### 修复
`toggleSelect` 中加入幂等性检查 `if (next === has) return;`：

```js
function toggleSelect(client, next) {
  const key = rowKey(client);
  const has = localSelected.value.has(key);
  if (next === has) return; // mount 期事件：checked 值与选中态一致 → 无操作
  // ...
}
```

mount 期间所有 checkbox 的 `:checked` 绑定值已匹配 INIT 后的 `localSelected`，`next === has` 均为 `true`，事件被静默忽略。用户点击时 `checked` 值翻转，`next !== has`，正常处理。

---

## 2026-05-19 — 修复 input[type=checkbox] @click + isTrusted 消除 mount 循环

### 根因
原生 `<input type="checkbox">` 的 `@click` 在 `:checked` 被 Vue 设置时也会触发（浏览器兼容行为）。`toggleSelect` 被批量调用，相互覆盖 `localSelected`。

### 修复
在 `toggleSelect` / `selectAll` 中加入 `event.isTrusted` 检查——只有浏览器原生用户点击事件（`isTrusted === true`）才被处理，程序化 `click`（设置 `checked` 属性触发的）被忽略：

```js
function toggleSelect(client, next) {
  if (!event?.isTrusted) return;
  // ...
}
function selectAll(next, e) {
  if (!e?.isTrusted) return;
  // ...
}
```

---

## 2026-05-19 — 修复 a-checkbox → 原生 input[type=checkbox] + @click 消除 mount 循环

### 根因
ant-design-vue 的 `a-checkbox` 和原生 `<input type="checkbox">` 均会在 mount 时通过 `input.click()` 或 `checked` 属性同步触发事件。`_ready` + `nextTick` 无效，因为事件在 mount 同步阶段已触发。

### 修复
将所有 `a-checkbox` 替换为原生 `<input type="checkbox">`，所有事件处理器从 `@change` 改为 `@click`：

```vue
<input type="checkbox" :checked="isSelected(client)"
  @click="(e) => toggleSelect(client, e.target.checked)" />
```

原生 `@click` 只在用户实际点击时触发，不受程序化 `checked` 设置影响。

---

## 2026-05-19 — 修复 nextTick + _ready guard 消除 ant-design-vue click 循环

### 根因
`@change` 改为 `@click` 后，ant-design-vue 的 `a-checkbox` 在 mount 时仍然会调用 native `input.click()` 触发 `@click` 事件。所有 checkbox 的 `toggleSelect` 被批量执行，相互覆盖 `localSelected`。

### 修复
新增 `_ready` ref，`nextTick` 后设为 `true`。`toggleSelect` / `selectAll` / `clearSelection` 检查 `_ready` 标志，mount 周期内拒绝执行。

```js
const _ready = ref(false);
nextTick(() => { _ready.value = true; });

function toggleSelect(client, next) {
  if (!_ready.value) return;
  // ...
}
```

---

## 2026-05-19 — 修复 ant-design-vue @change 改为 @click 消除 mount 循环

### 根因
ant-design-vue 的 `a-checkbox` 在组件挂载时会为所有 checkbox 触发 `@change` 事件（无论 `:checked` prop 值如何）。此前尝试的 `_initDone` 和 `_mounted` guard 都无效，因为事件在 `initDone`/`mounted` 标志设置后仍然触发。

### 修复
将所有 `@change` 替换为 `@click`：

| 位置 | 修改前 | 修改后 |
|------|--------|--------|
| 单个客户端 checkbox（desktop）| `@change="(e) => toggleSelect(client, e.target.checked)"` | `@click` |
| 单个客户端 checkbox（mobile）| `@change="(e) => toggleSelect(client, e.target.checked)"` | `@click` |
| 全选 header checkbox | `@change="(e) => selectAll(e.target.checked)"` | `@click` |

移除 `_initDone` ref 和所有相关 guard（不再需要）。

### 移除的调试日志
- `[CRT:watch]` 所有日志
- `[CRT:emitSelection]` stacktrace
- `[onUpdateSelectedIds]` 调试日志  
- `[onClientSel]` 调试日志

---

## 2026-05-19 — 修复 emitSelection 发射 [null] + ant-design-vue @change 挂载时批量触发循环

### Bug：emitSelection 发射 [null]
`emitSelection()` 使用 `client.clientId` 标识客户端，但 `Inbound.ClientBase` 构造函数没有 `clientId` 参数，`clientId` 始终为 `undefined`。导致：
- `onClientSelectionChange` 收到 `ids: [null]`
- `selectedClientIds[id] = [null]`
- 导出过滤 `genInboundLinks` 的 `filterSet.has(client.clientId)` 无法匹配

**修复**：`emitSelection()` 改用 `rowKey(client)` 的返回值（email / id / password / JSON），`genInboundLinks` 的过滤逻辑同步改为 `client.email || client.id || client.password` 匹配。

### Bug：ant-design-vue `a-checkbox` 挂载时所有 checkbox 触发 `@change`
`ClientRowTable` 挂载时，ant-design-vue 的 `a-checkbox` 会为每一个 checkbox 触发 `@change` 事件，导致 `toggleSelect` 被批量调用。这些调用相互覆盖 `localSelected`，最终导致:
- 所有客户端都被选中，然后又被取消
- 循环往复，无法稳定

**修复**：`_initDone` flag — `watch(clients, ..., { immediate: true })` 的 INIT 分支执行完毕后设置 `_initDone.value = true`，`toggleSelect` / `selectAll` / `clearSelection` 检查该 flag，挂载完成前拒绝执行。

### 修改文件

| 文件 | 修改 |
|------|------|
| `ClientRowTable.vue` | `emitSelection` 改用 `Array.from(localSelected.value)` 发射 rowKey 值；新增 `_initDone` ref + 守卫；移除 `onMounted` + `_mounted` |
| `inbound.js` | `genInboundLinks` 过滤条件从 `client.clientId` 改为 `client.email \|\| client.id \|\| client.password` |

---

## 2026-05-19 — 修复 watch(clients) 早期返回导致空初始化 / 添加客户端后首个客户端消失

### Bug 2：勾选入站后有概率无客户端被勾选

**根因**：`watch(clients)` 在 `localSelected` 为空时直接 `return`：
```js
// 旧代码
watch(clients, (list) => {
  if (localSelected.value.size === 0) return;  // ← 阻止了首次数据到达后的初始化
  ...
});
```
当客户端数据在组件 mount **之后**才到达时，`initLocalSelected()` 只在 `setup()` 阶段执行过一次（此时 `clients.value === []`），结果 `localSelected = Set{}`。数据到达后 watch 因空 Set 直接 return，永不初始化。

### Bug 1：创建第 2 个客户端后第 1 个客户端信息消失

**根因**：与 Bug 2 相同机制。`AddInboundClient` 成功后 `refresh()` 重新拉取入站列表，ant-design-vue 的 `rowSelection` 可能在刷新期间 emit `update:selected-ids`，触发 `onUpdateSelectedIds` 将 `selectedClientIds[id]` 设为 `[]`。此时如 `ClientRowTable` 未销毁重建，`localSelected` 旧值中的 `rowKey` 与新 clients 数组的 `rowKey` 不匹配时，`watch(clients)` 的收敛逻辑会删除不匹配的 key。如果此时 `localSelected` 恰为空（竞态），早期返回使初始化被跳过，视觉上表现为第 1 个客户端行消失。

### 修复

`watch(clients)` 改为：当 `localSelected` 为空且 clients 有数据时，调用 `initLocalSelected()`：

```js
watch(clients, (list) => {
  if (list.length === 0) return;
  if (localSelected.value.size === 0) {          // ← 不再直接 return
    localSelected.value = initLocalSelected();    // ← 延迟初始化
    emitSelection();
    return;
  }
  // 正常收敛逻辑...
});
```

---

## 2026-05-19 — 修复 ClientRowTable 自旋锁：移除 write-back watch 导致的 clientId=0 全选循环

### Bug 根因
`ClientRowTable` 的 `watch(selectedClientIds)` 是 re-entrant 的：
```
toggleSelect(clientC, true)
  → emitSelection() → [0]           // 所有 clients 共享 clientId=0，Set 去重后只有一个 0
  → parent.onClientSelectionChange({5, [0]})
  → selectedClientIds[5] = [0]
  → watch(selectedClientIds) fires
  → clients.filter(c => [0].includes(c.clientId))  → 匹配 ALL clients! (都是 0)
  → localSelected = Set{ c1, c2, c3 }              → 全选
  → 用户再 uncheck → 同样 loop → 永远无法取消
```

### 修复
移除 `watch(() => props.selectedClientIds, ...)` 回写。`localSelected` 只在组件创建时初始化一次，之后仅由用户交互（`toggleSelect`, `selectAll`, `clearSelection`）控制。父组件的 `selectedClientIds` 通过 `emitSelection()` 单向同步。

初始化时增加 duplicate-clientId 保护：
```js
if (matched.length === clients.length && clients.length > 1) {
  const unique = new Set(matched.map(c => c.clientId));
  if (unique.size === 1) {  // 所有 clients 共享同一个 clientId（典型值 0）
    return new Set([rowKey(clients[0])]);  // 回退到仅选第 1 个
  }
}
```

---

## 2026-05-19 — 入站多选框行为改进：多客户端仅预选第 1 个，手动勾选客户端自动选中入站

### 行为变更

| 场景 | 旧行为 | 新行为 |
|------|--------|--------|
| 选中入站（clients > 1） | 全部客户端 checkbox 勾选 | 仅第 1 个客户端 checkbox 勾选 |
| 手动勾选某个客户端 | 入站 checkbox 不联动 | 自动选中该入站 |
| 取消勾选全部客户端 | 入站 checkbox 不联动 | 自动取消选中该入站 |
| 单客户端入站 | 展开 / 不展开（无客户端列表）| 不展开（无操作变化）|

### 修改

| 文件 | 改动 | 行 |
|------|------|----|
| `ClientRowTable.vue` | `localSelected` 初始化和 watch：多客户端时仅预选第 1 个 | ~8 |
| `InboundsPage.vue` | 新增 `onClientSelectionChange` 函数：勾选/取消客户端时自动同步入站 checkbox | ~20 |
| `InboundsPage.vue` | `onUpdateSelectedIds` 重构：新选中入站时预设 `[]`（触发 ClientRowTable 选第 1 个） | ~10 |

### 数据流
```
选中入站(id=5, 3 clients)
  → onUpdateSelectedIds([..., 5])
  → selectedClientIds[5] = []
  → ClientRowTable watch → localSelected = Set{ firstClient.rowKey }
  → emitSelection() → [firstClientId]
```

```
手动勾选 client C
  → toggleSelect(C, true) → localSelected = Set{ C.rowKey }
  → emitSelection() → [C.clientId]
  → onClientSelectionChange({ inboundId:5, ids:[C.clientId] })
  → selectedInboundIds.includes(5)?→no → selectedInboundIds = [...prev, 5]  ✅ 自动选中入站
```

```
取消所有客户端
  → localSelected = Set{}
  → emitSelection() → []
  → onClientSelectionChange({ inboundId:5, ids:[] })
  → ids.length === 0 → 从 selectedInboundIds 移除 5  ✅ 自动取消入站
```

---

## 2026-05-19 — 修复 "malformed JSON" 根因：SQLite JSON_EACH(NULL) 和未保护的 .(string)

### Bug 根因
两个独立的 "malformed JSON" 触发源：

**1. SQLite JSON_EACH(NULL) — 主要根因**
`getAllEmailSubIDs()` 使用 `JSON_EACH(JSON_EXTRACT(settings, '$.clients'))` 遍历所有入站的客户端。
当 mixed/http/wireguard 等无 `"clients"` 键的入站存在时，`JSON_EXTRACT` 返回 NULL，`JSON_EACH(NULL)` 在 SQLite 中抛出 `"malformed JSON"`。
这个错误通过 `checkEmailsExistForClients` → `AddInboundClient` 显示给用户，但错误消息中没有明确上下文，看起来像是后端 JSON 解析出错。

**2. 未保护的 `oldSettings["method"].(string)` (line 1144)**
`AddInboundClient` 中 `oldSettings["method"].(string)` 无 `ok` 守卫。当旧入站设置中没有 `"method"` 键时返回 nil，`nil.(string)` panic。
此 panic 被 `defer/recover` 捕获后转换为 `"panic in AddInboundClient: interface conversion: interface {} is nil, not string"`。

### 修复

| 文件 | 修改 |
|------|------|
| `web/service/inbound.go:getAllEmailSubIDs()` | 替换 SQLite JSON_EACH 为纯 Go 迭代 — 读入所有入站，用 `json.Unmarshal` + `map[string]any` 安全解析，仅处理有 `"clients"` 键的入站 |
| `web/service/inbound.go:1144` | `oldSettings["method"].(string)` → `if m, ok := oldSettings["method"].(string); ok { ... }` |

### 验证
- 50 个入站（含 wireguard/mixed/http/tunnel/tun）+ 20 节点 + 20 订阅存在时
- `addClient` 对所有 5 个多客户端协议（vmess/vless/trojan/shadowsocks/hysteria）返回 `success=true`
- 所有页面正常加载

---

## 2026-05-19 — 修复 ClientRowTable 多客户端被识别成一个（rowKey 替代 clientId）

### Bug 根因
`ClientRowTable` 的选中状态使用 `client.clientId` 作为 Set 的唯一标识。当 settings JSON 缺少 `"clientId"` 字段时（如通过脚本创建的入站），所有客户端的 `clientId` 均为 `0`，Set 中只有一个条目，导致 checkerbox 只能同时选中/取消所有客户端。

### 修复
将选中状态的唯一标识从 `client.clientId` 改为 `rowKey(client)`，其回退链为 `email → id → password → JSON.stringify(client)`，保证跨客户端唯一。

| 函数 | 修改前 | 修改后 |
|------|--------|--------|
| `localSelected` 初始化 | `clients.value.map(c => c.clientId)` | `clients.value.map(rowKey)` |
| `watch(selectedClientIds)` | `new Set(ids)` (number) | `clients.value.filter(c => ids.includes(c.clientId)).map(rowKey)` |
| `isSelected(client)` | `localSelected.has(client.clientId)` | `localSelected.has(rowKey(client))` |
| `toggleSelect(client, next)` | `s.add/delete(client.clientId)` | `s.add/delete(rowKey(client))` |
| `selectAll(next)` | `clients.value.map(c => c.clientId)` | `clients.value.map(rowKey)` |
| `allSelected` / `someSelected` | `.every/some(c => local.has(c.clientId))` | `.every/some(c => local.has(rowKey(c)))` |
| `emitSelection()` | `Array.from(localSelected)` (clientId) | 通过 `rowKey` 筛选后 emit deduped clientId |
| `watch(clients)` 收敛 | `.map(c => c.clientId)` | `.map(rowKey)` |
| `confirmBulkDelete` | `local.has(c.clientId)` | `local.has(rowKey(c))` |

### 导出兼容性
`emitSelection()` 发出的仍是 deduped `clientId[]`，与 `genInboundLinks(selectedClientIds)` 兼容。当 `clientId` 全部为 `0` 时，partial selection 降级为全选（接受该限制，`ensureClientIdsInSettings` 会在首次保存后分配唯一 `clientId`）。

---

## 2026-05-19 — 修复 "新建客户端" malformed JSON 错误（前端 toString 多行 JSON 导致）

### Bug 根因
`ClientFormModal.vue:217` 中 `client.value.toString()` 默认 `format=true`，调用 `JSON.stringify(this.toJson(), null, 2)` 生成**带换行的多行 JSON**。
axios 将其序列化为 HTTP 请求体时，内层 JSON 的换行符 `\n` 经 outer JSON 转义后，Go 的 `json.Unmarshal` 无法正确解析，返回 "malformed JSON"。

### 修复
三处调用 `client.toString()` 的地方全部改为 `client.toString(false)`：
- `ClientFormModal.vue:217` — 添加/编辑单个客户端
- `ClientBulkModal.vue:165` — 批量添加客户端
- `InboundsPage.vue:412` — 切换客户端启用状态

`toString(false)` → `JSON.stringify(this.toJson())` → 紧凑 JSON，无换行。

### 验证
- `AddInboundClient` 后端在本次迭代已增加 type assertion `ok` 守卫 + `defer/recover`，不会再因 nil panic 产生 `malformed JSON`。
- 紧凑 JSON 格式的 POST body 可以被 Go `encoding/json` 正确解析。

---

## 2026-05-19 — 修复入站导出链接/导出订阅链接未按客户端粒度过滤

### Bug 1：通用操作 → 导出入站链接导出了选中入站的所有客户端

**根因**：`exportAllLinks()` 调用 `ib.genInboundLinks()` 遍历入站下 ALL 客户端（`inbound.js:2388-2406`），但 `rowSelection` 只跟踪入站 ID，不跟踪客户端 ID。

**修复**：
1. `ClientRowTable.vue` — 新增 `selectedClientIds` prop，通过 `localSelected` ref 和 `update:selected-client-ids` emit 将客户端选中状态暴露给父组件
2. `InboundList.vue` — 新增 `selectedClientIds` prop，透传给 `ClientRowTable`；接收 `update:selected-client-ids` 事件并向上 emit
3. `InboundsPage.vue` — 新增 `selectedClientIds` ref，`exportAllLinks()` 传入 `selectedClientIds` 过滤
4. `inbound.js:genInboundLinks()` / `dbinbound.js:genInboundLinks()` — 新增 `selectedClientIds` 参数，生成链接时按 `clientId` 过滤

### Bug 2：通用操作/行操作 → 导出订阅链接未按规则处理多客户端入站

**根因**：`exportAllSubs()` 只存入站 ID，导致 `SubscriptionFormModal` 的 `flatInboundList()` 展开多客户端入站时把所有客户端都放进已选列表。

**修复**：
1. `exportAllSubs()` — 构建 `__subPreselectIds` 时使用 `"inboundId:clientId"` 格式支持客户端级预选
2. 行操作 `subs` — 单客户端入站自动预选，多客户端入站不预选（`cCount > 1 ? [] : [id]`）
3. `SubscriptionFormModal.vue` — `__subPreselectIds` 解析逻辑同时支持 `number`（全入站）和 `"id:clientId"` 字符串（单客户端）

### 文件清单
- `frontend/src/pages/inbounds/ClientRowTable.vue` — 客户端选择状态 + emit
- `frontend/src/pages/inbounds/InboundList.vue` — selectedClientIds prop/emit
- `frontend/src/pages/inbounds/InboundsPage.vue` — selectedClientIds 管理 + export 函数
- `frontend/src/models/inbound.js` — genInboundLinks 客户端过滤参数
- `frontend/src/models/dbinbound.js` — genInboundLinks 客户端过滤参数
- `frontend/src/pages/subscription/SubscriptionFormModal.vue` — 预选解析支持客户端级

---

## 2026-05-19 — Subscription 入站选择器中 mixed/http/wireguard 不再展开为 account/peer 行

### Bug 根因
`extractInboundClients()` 在解析入站 settings 时除了处理标准 `clients[]`（vmess/vless/trojan/ss/hysteria），
还额外处理了 `accounts[]`（mixed/http）和 `peers[]`（wireguard），导致这些协议在订阅入站选择器中被拆成每 account/peer 一行。

实际上这些协议的后端 `GetLink()` 返回 `""`（不生成订阅链接），展开为多行是误导性的。

### 修复
移除 `accounts[]` 和 `peers[]` 的处理逻辑，使 mixed/http/wireguard 像 tunnel/tun 一样只显示为入站级别的单行。

### 文件
`frontend/src/pages/subscription/SubscriptionFormModal.vue` — extractInboundClients 函数

### 回退
恢复 `extractInboundClients()` 中 `settings.accounts` 和 `settings.peers` 的 for 循环。

---

## 2026-05-19 — 修复 expandedRowKeys 使用 isMultiUser() 协议判断导致单客户端也展开

### Bug 根因
`expandedRowKeys` 的 watcher 使用 `ib.isMultiUser()` 判断——该函数查的是**协议类型**（vmess/vless/trojan/hysteria 返回 true），而不是**实际客户端数量**，导致只有 1 个客户端的入站勾选后也会展开。

### 修复
改为 `props.clientCount[ib.id]?.clients > 1`，按实际客户端数判断。

### 文件
`frontend/src/pages/inbounds/InboundList.vue` — expandedRowKeys watcher

---

## 2026-05-19 — 修复 GetClients 自动写回 DB 导致客户端丢失/重复

### Bug 根因
`GetClients()` 在读取客户端列表时会自动分配 `clientId` 并**立即写回数据库**。`AddInboundClient` 传入的 `data` 仅包含新客户端，`GetClients(data)` 用只含新客户端的 settings 覆盖了 DB—原有客户端全部丢失，合并时变成两个相同的新客户端。

### 修复
1. `GetClients()` 只读不写 —— clientId 仅在内存中分配
2. `ensureClientIdsInSettings()` 添加到真正的保存点：
   - `AddInbound()` — 创建入站前
   - `UpdateInbound()` — 更新入站前
   - `AddInboundClient()` — 添加客户端前
   - `UpdateInboundClient()` — 更新客户端前

### 文件
| 文件 | 改动 |
|------|------|
| `web/service/inbound.go` | GetClients 移除 DB 写入；AddInbound/UpdateInbound/AddInboundClient/UpdateInboundClient 各加 ensureClientIdsInSettings 调用 |

---

## 2026-05-18 — 前端完成：InboundList 客户端展开 + 订阅表单客户端选择 + checkClientSubscriptions API

### 前端改动
#### ① InboundList.vue — 勾选多客户端入站自动展开客户端
- 新增 `expandedRowKeys` ref + `onExpand` handler
- `watch(() => props.selectedIds)` 监听勾选变化，自动展开/收起多客户端入行
- 客户端展开行与原有 `ClientRowTable` 联动

#### ② SubscriptionFormModal.vue — 客户端级别入站选择
- 新增 `extractInboundClients()` 解析入站的 `clients[]`/`accounts[]`/`peers[]` 提取 clientId
- 新增 `flatInboundList()` 将多客户端入站摊平为每客户端一个列表项
- 摊平后的列表项显示 `入站remark` + `客户端标识(email/user:xxx/key:xxx)`
- 编辑模式解析 `inboundId:clientId` 格式的 inboundIds 并匹配到摊平列表
- 保存时序列化为 `inboundId:clientId` 格式

#### ③ checkClientSubscriptions API 端点
- `GET /panel/api/inbounds/checkClientSubscriptions/:inboundId/:clientId`
- 返回 `{ affected: [...], toBeDeleted: [...] }` 订阅列表
- 修复 `parseCsvInboundIds` 兼容 `inboundId:clientId` 格式

### 文件
| 文件 | 改动 |
|------|------|
| `frontend/src/pages/inbounds/InboundList.vue` | 新增 expandedRowKeys、onExpand、selectedIds watcher |
| `frontend/src/pages/subscription/SubscriptionFormModal.vue` | extractInboundClients、flatInboundList、客户端级别列表渲染、inboundId:clientId 序列化/反序列化 |
| `web/controller/inbound.go` | 新增 checkClientSubscriptions 路由+handler；parseCsvInboundIds 支持 `inboundId:clientId` |

### 待完成（后续迭代）
1. InboundsPage.vue — 删除客户端确认对话框增强（显示受影响的订阅列表）
2. InboundsPage.vue — 删除入站确认对话框增强（区分 affected / toBeDeleted）
3. InboundList.vue — `forceDel` 触发客户端级别的订阅清理

---

## 2026-05-18 — 客户端级别订阅支持（clientId + inboundId:clientId）

### ① 后端 ClientID 自动分配
`database/model/model.go` Client struct 新增 `ClientID int`（per-inbound 自增 1‑based 编号，永不重复）。
`inbound.go` 的 `GetClients()` 自动分配缺失的 clientId 并写回数据库；
新增 `ensureClientIdsInSettings()` 处理 `clients[]`/`accounts[]`/`peers[]`；
新增 `GetEmailForClientId()` 根据 clientId 获取可读标识。

### ② inboundIds 格式升级
旧格式：`"1,2,3"`（bare inbound ID）
新格式：`"1:2,1:3,4:1"`（inboundId:clientId），也可混用 bare ID `"5"`

`subscription.go` 新增 `SubClientRef` 结构体、`ParseSubClientRefs()`、`joinSubClientRefs()`、
`RemoveClientFromSubscriptions()`（按 clientId 清理）、`CheckClientSubscriptions()`（查询验证）。
所有现有函数保持向后兼容。

### ③ tryAggregateSub 升级
`subController.go` 的 `tryAggregateSub` 现在解析 `SubClientRef`，支持按 clientId 过滤客户端。
移除旧的 `parseSubInboundIds`。

### 文件
| 文件 | 改动 |
|------|------|
| `database/model/model.go` | Client 新增 `ClientID int` |
| `web/service/inbound.go` | GetClients auto-assign clientId；新增 ensureClientIdsInSettings、GetEmailForClientId |
| `web/service/subscription.go` | 新增 SubClientRef、ParseSubClientRefs、RemoveClientFromSubscriptions、CheckClientSubscriptions |
| `sub/subController.go` | tryAggregateSub 改用 SubClientRef 解析；移除旧的 parseSubInboundIds |

### 待完成（前端）
1. InboundList.vue — 勾选多客户端入站时自动展开客户端列表
2. SubscriptionFormModal.vue — 选择入站选项卡支持客户端级别显示
3. InboundsPage.vue — 删除客户端确认对话框增强
4. `checkClientSubscriptions` API 端点注册

### 回退
1. 恢复 `database/model/model.go` Client 定义移除 ClientID
2. 恢复 `web/service/inbound.go` GetClients 为旧版
3. 恢复 `web/service/subscription.go` 为旧版 parseInboundIds
4. 恢复 `sub/subController.go` tryAggregateSub 为 bare ID 遍历

---

## 2026-05-18 — SubId 输入框 + 三列纵向对齐 + 密码输入改为密码类型

### ① Row 2/3 列数统一为 12+12
启用开关（Row 2）、更新间隔（Row 3）、过期时间（Row 4）的左侧边缘全部对齐在 column 12/24。

### ② SubId 输入框
- 新建时自动生成 16 位 base62 随机 SubId（匹配后端算法）
- 编辑时显示已有 SubId
- 可手动修改
- 保存时 `payload` 包含 `subId`

### ③ 密码输入改为密码类型
- `<a-input-password>` 替代 `<a-input-search>`
- 默认显示实心圆圈，位数与实际位数无关
- 右侧眼睛图标可切换显示明文
- "随机生成"按钮保留
- 编辑时不清理密码，显示已有密码

### 文件
| 文件 | 改动 |
|------|------|
| `frontend/src/pages/subscription/SubscriptionFormModal.vue` | 模板行布局重构（12+12）；`generateSubId()`；`a-input-password`；编辑时保留密码 |
| `web/service/subscription.go` | `Update` 方法 `updates` 新增 `sub_id` |

### 回退
1. 恢复 Row 2/3 的原始列划分
2. 删除 `generateSubId()` 和 `form.subId` 相关代码
3. 恢复 `<a-input-search>` 和 `password: ''` 清零

---

## 2026-05-18 — 两个开关统一 vertical 布局 + 标题/备注 hint

### ① Inbounds 选项卡两个开关统一垂直布局
**根因**：`<a-form-item>` 在无 `<a-form>` 父级时，ant-design-vue v4 的 standalone 默认布局行为不确定，导致 auto-include 和 sync-order 两个开关渲染不一致（auto-include 文字在上/开关在下，sync-order 文字和开关并排）。

**修复**：用 `<a-form layout="vertical">` 包裹两个开关的 `<a-form-item>`，强制统一为垂直布局。

### ② 标题/备注 hint 文字
- 标题下方灰色提示："对客户端展示的订阅标题" (zh-CN) / "Title shown to clients in subscription info" (en-US)
- 备注下方灰色提示："面板内订阅备注" (zh-CN) / "Internal remark for the panel" (en-US)

### 文件
| 文件 | 改动 |
|------|------|
| `frontend/src/pages/subscription/SubscriptionFormModal.vue` | Inbounds 选项卡开关外层加 `<a-form layout="vertical">`；标题/备注下方加 `.form-hint` |
| `web/translation/en-US.json` | 新增 `subTitleHint`、`subRemarkHint` |
| `web/translation/zh-CN.json` | 新增 `subTitleHint`、`subRemarkHint` |

### 回退
1. 移除 `<a-form layout="vertical">` 包裹层
2. 删除标题/备注下方的 `.form-hint` 元素
3. 删除翻译文件中的 `subTitleHint`、`subRemarkHint`

---

## 2026-05-18 — 订阅模块 5 项修改

### ① 流量列颜色：绿/红/紫 + 移除信息图标
- 用量 < 配额 → 绿色 `green`
- 用量 >= 配额 → 红色 `red`
- 配额为 0（无限） → 紫色 `purple`
- 移除 quota 右边的 `InfoCircleOutlined` 信息符号

### ② CallCount 正确自增 + 404 不记录
- `subscriptionService` 新增 `IncrementCallCount()` 方法，使用 `gorm.Expr("call_count + 1")` 原子自增
- 只在 `tryAggregateSub` 成功路径调用，User-Agent 不匹配（404）或 subId 不存在（400）时不会增加
- `UpdateLastUsedAt` 同理：404/400 不更新

### ③ 列名翻译
- `subLastOnline` → `subLastOnlineTime`（en-US: "Last online time", zh-CN: "上次在线时间"）
- 其他 11 种语言使用 vue-i18n fallback 到 en-US

### ④ 常规选项卡布局
- Row 1: [标题 (span 12)] [备注 (span 12)]
- Row 2: [返回格式 (span 8)] [更新间隔 (span 8)] [启用开关 (span 8)]

### ⑤ 排序开关样式统一
- `subSyncOrder` 的 switch 去掉多余 `<div>` 包装，与 `subAutoIncludeAll` 保持完全一致的 `a-form-item` 样式

### 文件
| 文件 | 改动 |
|------|------|
| `sub/subController.go` | `UpdateLastUsedAt` → `IncrementCallCount` + `UpdateLastUsedAt` |
| `web/service/subscription.go` | 新增 `IncrementCallCount()` 方法，加 `gorm` import |
| `frontend/src/pages/subscription/SubscriptionPage.vue` | 新增 `trafficTagColor()`，列模板重写，移除 InfoCircleOutlined，列名改 `subLastOnlineTime` |
| `frontend/src/pages/subscription/SubscriptionFormModal.vue` | General 选项卡两行布局重排，subSyncOrder 开关样式简化为 `a-form-item` 标准 |
| `web/translation/en-US.json` | `subLastOnline` → `subLastOnlineTime` |
| `web/translation/zh-CN.json` | `subLastOnline` → `subLastOnlineTime` |

### 回退
1. 恢复 `sub/subController.go` 为只调 `UpdateLastUsedAt`
2. 删除 `web/service/subscription.go` 的 `IncrementCallCount()` 和 `gorm` import
3. 恢复 `SubscriptionPage.vue` 流量列为旧版双层 `a-popover`
4. 恢复 `SubscriptionFormModal.vue` General 选项卡原始布局
5. 恢复 `SubscriptionFormModal.vue` subSyncOrder 的 `<div>` 包装样式
6. 恢复 `en-US.json` / `zh-CN.json` 的 `subLastOnlineTime` → `subLastOnline`

---

## 2026-05-18 — 时间选择器三项优化

### ① 默认时间改为当前时间，每次开关刷新
初始值 `ref(0)` → `ref(dayjs().hour()/minute()/second())`，开关每次 toggle 都重置到当前时间。

### ② @change → @blur 校验
之前每次按键都校验，导致无法输入完整时间。改为失去焦点时才检查合法性。

### ③ Vue <transition name="tf"> 平滑动画
Opacity 淡入淡出 + translateY(-4px)，0.2s/0.15s。

### 文件
`SubscriptionFormModal.vue` — 初始值、`@blur`、`<transition>`、CSS keyframes

---

## 2026-05-18 — 日期选择器移除 OK 按钮

### 修复：时间面板 OK 按钮无法隐藏
**根因**：ant-design 日期选择器的时间面板下拉框通过 `getPopupContainer` 默认渲染到 `document.body`。Vue scoped CSS 的选择器（`.sub-expiry-picker .ant-picker-ok`）被注入 `data-v-xxx` 属性限定，无法匹配 body 层级的元素。`:need-confirm` 和 `:show-time.needConfirm` 在此版本中不支持。

**修复**：`:global(.ant-picker-ok) { display: none !important; }` — 全局无作用域限制的 CSS 覆盖。同时移除了无效的 `needConfirm` props，改为纯 `show-time`。

### 文件改动
- `SubscriptionFormModal.vue` — 移除 `need-confirm`/`:show-time="{ needConfirm }"`；新增 `:global(.ant-picker-ok) { display: none }`

---

## 2026-05-18 — 日期选择器多语言：ant-design locale 对象 + a-config-provider

### 修复：日历表头/星期/Now 按钮在所有语言下显示英文
**根因**：`a-date-picker` 的 UI 文字（月份名 May→五月、星期 Su→日、"Now"→此刻）数据源是 ant-design 的 locale 模块，不是 dayjs。`dayjs.locale()` 仅影响 dayjs 自己的格式化方法，不影响组件渲染的日历表头。

**修复**：导入 ant-design Vue v4 的 12 种语言 locale 对象，通过 `a-config-provider :locale` 注入到 `a-date-picker`：

```javascript
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import jaJP from 'ant-design-vue/es/locale/ja_JP';
// ... 12 种语言
```

| 语言 | antd locale | 日历表头 | 星期 | Now 按钮 |
|------|------------|---------|------|---------|
| zh-CN | zh_CN | 五月 | 一/二/三… | 此刻 |
| ja-JP | ja_JP | 5月 | 月/火/水… | 現在 |
| es-ES | es_ES | mayo | lu/ma/mi… | Ahora |
| ... | ... | ... | ... | ... |

### 文件改动
- `SubscriptionFormModal.vue:19-32` — 新增 12 个 ant-design locale import
- `SubscriptionFormModal.vue:89-97` — 新增 `antdLocaleMap` + `antdLocale` computed
- `SubscriptionFormModal.vue:538-540` — `a-date-picker` 包裹在 `a-config-provider :locale` 内

---

## 2026-05-18 — 日期选择器多语言：:key 强制重挂载 + dayjs locale

### 修复：切换语言后日期选择器仍显示英文
**根因**：`a-date-picker` 在挂载时创建内部 dayjs 实例，`dayjs.locale()` 仅影响**新**实例。面板切换语言后 watcher 更新了全局 locale，但已挂载的 date-picker 内部实例不受影响。

**修复**：`<a-date-picker :key="i18nLocale.value">` — locale 变化时 Vue 销毁并重建组件，新组件使用当时的 dayjs 全局 locale。

### 文件改动
- `SubscriptionFormModal.vue:538` — `a-date-picker` 添加 `:key="i18nLocale.value"`

验证：所有页面正常加载（50 入站/20 节点/20 订阅）

---

## 2026-05-18 — UA select 上拉框间隙消除

### 修复：从输入框移向上拉框过程中上拉框消失
- `getPopupContainer` 在 `.ua-select-wrap` 内渲染上拉框
- CSS `margin-top/bottom: -4px` 消除间隙
- 150ms `setTimeout` debounce 延迟关闭
- 移除冗余 `open="false"`

### 文件改动
`SubscriptionFormModal.vue` — `uaTimer`/`onUaEnter`/`onUaLeave`；CSS 负边距；移除 `open="false"`
`CHANGELOG.md` — 本条目

---

## 2026-05-17 — 10 项优化：移动端适配 + 删除警告 + 订阅数列(i18n待补)

### 已完成

| # | 项目 | 状态 |
|---|------|------|
| 1 | 移动端排序模式隐藏其他按钮 | ✅ |
| 2 | 移动端订阅表单上下间距 | ✅ |
| 3 | 移动端禁用拖拽，仅用按钮排序 | ✅ |
| 4 | 订阅表单协议/备注互换，备注大字协议小字 | ✅ |
| 5 | 移动端隐藏拖拽排序符号 | ✅ |
| 7 | 删除入站时订阅提示换行格式化 | ✅ |
| 9 | 入站列表订阅数列（`subCountMap` computed） | ✅ 已计算，列展示待接入 |
| 10 | 订阅启用状态变化同步订阅数 | ✅ 计算基于 `allSubs`，随 `fetchAllSubs` 更新 |

### 已完成（第 2 轮）

| # | 项目 | 状态 |
|---|------|------|
| 6 | 切换选项卡滚动位置保持，关闭重置 | ✅ `scrollPos` watcher |
| 8 | 完整 i18n 翻译键（13 语言） | ✅ flat `sub*` keys + SubscriptionPage 全部替换 |
| 9 列 | 订阅数列接入 InboundList 表格列 | ✅ prop + column + mobile card view |
| — | Subscription → Subscriptions | ✅ en-US sidebar label |
| — | 订阅列表页全部中文化替换 | ✅ 统计、表格头、按钮、消息框全部 i18n |
| — | 订阅对话框标题/按钮 i18n | ✅ 创建/编辑标题 + 保存/取消 |
| — | 入站导出菜单 i18n | ✅ 导出链接/订阅链接 3 处替换 |

### i18n 修复记录
- **根因**：vue-i18n `legacy: false` + `useI18n()` 组合不解析点号嵌套键（如 `pages.subscription.remark`）
- **修复**：全部改用 flat key（如 `subRemark`、`subFormat`）|

### 文件改动概览

| 文件 | 改动 |
|------|------|
| `SubscriptionFormModal.vue` | 模板添加 `isMobileWidth` 检查、i18n `t()` 调用、协议/备注互换、移动端 CSS |
| `InboundList.vue` | 移动端卡片视图隐藏非排序按钮、`!reorderMode` 模板包围 |
| `InboundsPage.vue` | `useSubscription` + `subCountMap` computed；`confirmDelete` 格式化 |
| `en-US.json` / `zh-CN.json` | 需补充 `pages.subscription.*` 键 |

---

## 2026-05-17 — Pointer Events 替换 HTML5 DnD（滚轮/触摸自然生效）

### 方案
HTML5 DnD 在拖拽期间禁用 `wheel` 事件。Pointer Events（`pointerdown`/`pointermove`/`pointerup`）不会禁用任何输入，滚轮、触摸、笔等所有输入在拖拽期间都正常派发。

**核心逻辑**：
1. `@pointerdown` 记录起始位置、启动拖拽
2. `pointermove`（document 级）→ `e.clientY` 逐行匹配 → `rowReorderById` / `splice`
3. `pointerup` → 清理状态
4. 5px 拖动阈值区分点击和拖拽
5. `touchAction: 'none'` 防止浏览器默认触摸行为
6. `userSelect: 'none'` 防止拖拽时文字选中

### 保留 HTML5 DnD 代码
两处均注释保留了 `draggable`、`@dragstart`、`@dragover`、`@drop`、`@dragend` 的原代码及对应函数，可随时切换回 HTML5 DnD。

### 删除
- `wheelReorderHandler` 及 `{ plusive: false }` 监听器（不再需要）

| 文件 | 改动 |
|------|------|
| `InboundList.vue:415-510` | `onRowPointerDown/Move/Up` + `cleanupDragState` + `pointerDrag`；HTML5 DnD 函数保留为空壳；`reorderRowProps` 改为 `onPointerdown` + `touchAction:none` |
| `SubscriptionFormModal.vue:47-166` | `onPointerDown/Move/Up` + `pointerDrag`；模板 `@pointerdown` 替换 `@dragstart`/`@dragover`/`@dragend`/`@drop`；HTML5 DnD 函数保留为空壳；删除 `removeWheelHandler` |
| `SubscriptionFormModal.vue 模板` | `@dragover.prevent="onDragOverContainer"` 删除；`draggable` 属性删除 |

### 回退
- 取消注释 `reorderRowProps` 中的 HTML5 DnD 行，注释 `onPointerdown` 行；恢复模板中的 `@dragstart`/`@dragover`/`@drop`/`@dragend` 及容器级 `@dragover`

---

## 2026-05-17 — 桌面端滚轮辅助排序 + 订阅触发区 10%

### 新增：拖拽中滚轮滚动同时排序行
在 `onRowDragStart`/`onDragStart` 时挂载 `wheel` 监听器，`onRowDrop`/`onDragEnd`/`onDrop` 时卸载。滚轮每滚动一步：
1. `scrollTop += deltaY` 滚动容器
2. `elementFromPoint(e.clientX, e.clientY)` 获取鼠标下的目标元素
3. 查找最近的行（`.ant-table-row` / `.inbound-item`）
4. 执行 `rowReorderById` 或 splice 重排

| 文件 | 新增变量 | 改动点 |
|------|---------|--------|
| `InboundList.vue:415-460` | `wheelReorderHandler` | `onRowDragStart` 挂载，`onRowDrop` 卸载 |
| `SubscriptionFormModal.vue:47-114` | `wheelReorderHandler` + `removeWheelHandler()` | `onDragStart` 挂载，`onDrop`/`onDragEnd` 卸载 |

### 修改：订阅触发区 20%→10%
```diff
- return { idleTrigger: Math.min(200, Math.max(80, Math.round(h * 0.2))) };
+ return { idleTrigger: Math.min(200, Math.max(80, Math.round(h * 0.1))) };
```
对 380px 容器：76px → **38px**。

### 回退
- 移除 `wheelReorderHandler` 挂载/卸载代码；订阅 `0.1` → `0.2`

---

## 2026-05-17 — 移除 InboundList 自动滚动；订阅触发区 30%→20%

### 删除：InboundList 自动滚动全部代码
彻底删除约 170 行 scroll 相关逻辑——变量、函数、拖拽事件中的调用全部移除。`onRowDragStart`/`onRowDragOver`/`onRowDrop` 恢复为纯 reorder。

### 修改：订阅触发区 30%→20%
```diff
- idleTrigger: Math.min(200, Math.max(80, Math.round(h * 0.3)))
+ idleTrigger: Math.min(200, Math.max(80, Math.round(h * 0.2)))
```
对 380px 容器：114px → **76px**，触发区缩小 33%，中立区扩大。

### 文件改动

| 文件 | 改动 |
|------|------|
| `InboundList.vue:415-506` | 删除 `onRowDragStart` 中的 scroll 容器代码；删除 `scrollRAF`/`scrollDir`/`scrollContainerEl`/`scrollContainerDragHandler` 等变量；删除 `findScrollContainer`/`findDistEl`/`getScrollThresholds`/`scrollTick`/`updateScroll`/`removeTableBodyDragHandler` 六个函数 |
| `InboundList.vue:558-600` | 删除 `reorderGuard`；`onRowDragOver` 恢复为纯 reorder；`onRowDrop` 删除 scroll 清理代码 |
| `SubscriptionFormModal.vue:59` | `0.3` → `0.2` |

### 回退
- 恢复 InboundList 所有 auto-scroll 变量和函数
- 恢复订阅 `0.2` → `0.3`

---

## 2026-05-17 — 速度曲线改为指数衰减：贴边慢（t=0→2300ms），边界快（t=1→300ms）

### 改进：从立方曲线改为指数衰减曲线，反转速度方向
**问题**：原公式 `delay = 300 + 5000 × t³` 让 `t=0`（贴边）最快（300ms/行→147px/s），`t=1`（边界）最慢（5300ms→8px/s）。用户到边缘想精细控制，结果一下子冲过头。

**方案**：改为指数衰减曲线 `delay = 300 + 2000 × (1-t)⁴`：
- 贴边（`t=0`）：`1-t=1` → `1⁴=1` → `delay=2300ms` → **19px/s** ⏳（慢速可控）
- 中区（`t=0.5`）：`1-t=0.5` → `0.5⁴=0.0625` → `delay=425ms` → 104px/s
- 边界（`t=1`）：`1-t=0` → `0⁴=0` → `delay=300ms` → **147px/s** 🔥（快速跨行）

慢速区从原来最后 100px（触发区后半段）**扩大到整个上半段**（t<0.5 都是慢速），且首 tick 仅 2.3 秒即可感知页面在滚动。

| 位置 | 旧（立方） | 新（指数衰减） |
|------|-----------|-------------|
| 贴边（t=0） | 300ms → **147px/s 🔥** | **2300ms → 19px/s ⏳** |
| 中区（t=0.5） | 925ms → 48px/s | 425ms → 104px/s |
| 边界（t=1） | 5300ms → 8px/s ⏳ | **300ms → 147px/s 🔥** |

### 文件改动

| 文件 | 改前 | 改后 |
|------|------|------|
| `InboundList.vue:480` | `300 + 5000 * Math.pow(t, 3)` | `300 + 2000 * Math.pow(1 - t, 4)` |
| `SubscriptionFormModal.vue:70` | `300 + 5000 * Math.pow(t, 3)` | `300 + 2000 * Math.pow(1 - t, 4)` |

### 回退
- 恢复 `300 + 5000 * Math.pow(t, 3)`

---

## 2026-05-17 — 修复：InboundList 距离测量与滚动执行分离（findDistEl vs findScrollContainer）

### 修复：updateScroll 距离测量用错容器
**根因**：`updateScroll(e)` 中 `topDist = y - rect.top` 和 `botDist = rect.bottom - y` 使用 `findScrollContainer()` 返回的容器做距离测量。当该容器为 `<html>` 时，`rect.top = 0`（浏览器顶端），`topDist` 把表格上方 250px 的顶栏/统计卡片也计入触发区，导致上边缘误触发偏移；`rect.bottom` 可能返回全高，下边缘距离` botDist` 巨大，始终不触发。

**修复**：把"距离测量基准元素"和"滚动执行目标元素"拆分为两个独立函数。

| 函数 | 用途 | 目标元素 |
|------|------|---------|
| `findDistEl()` | 距离测量（`topDist`/`botDist`）+ 高度（`idleTrigger`） | `.ant-table` → 表格可视区 |
| `findScrollContainer()` | 执行滚动（`.scrollTop`） | 不变（`.ant-table-body` → `#content-layout` → `<html>`） |

| 文件 | 改动 |
|------|------|
| `InboundList.vue:462-466` | 新增 `findDistEl()` |
| `InboundList.vue:468-472` | `getScrollThresholds` 用 `findDistEl()` |
| `InboundList.vue:486-503` | `updateScroll` 距离测自 `findDistEl()`，滚动执行自 `findScrollContainer()` |

### 回退
- 恢复 `updateScroll` 为单一 `findScrollContainer` 同时做距离和滚动

---

## 2026-05-17 — 修复：容器高度用 .clientHeight 代替 .getBoundingClientRect().height

### 修复：findScrollContainer 落到 `<html>` 时 .height 返回全高（3000px）
**根因**：`getBoundingClientRect().height` 对 `<html>` 返回**全部内容高度**（含溢出）。当表格无 `scroll:y` 时 `.ant-table-body` 不存在，容器探测落到 `<html>`，`h = 3000px` → `idleTrigger = 600px` → 上下触发区各占 600px、中间重叠 120px。

**修复**：改用 `clientHeight`——对 `<html>` 返回视口高度，对 `<div>` 返回可见高度，两种情况下都正确。

```diff
- const h = el.getBoundingClientRect().height;
+ const h = el.clientHeight;
```

### 影响

| 位置 | 改前（.height） | 改后（.clientHeight） | 效果 |
|------|---------------|---------------------|------|
| 入站列表 | `el.getBoundingClientRect().height` | `el.clientHeight` | 触发区从 600→~324px，中立区恢复 |
| 订阅表单 | `subScrollContainer.getBoundingClientRect().height` | `subScrollContainer.clientHeight` | 无变化（订阅表单的容器一直是正确的 div） |

### 回退
- 恢复 `getBoundingClientRect().height`

---

## 2026-05-17 — 修复：scroll-distance 守卫导致闪现/不跟随 → 改为 rAF 帧守卫

### 修复：44px 距离守卫有延迟 → rAF 帧守卫无延迟不锁死
**scroll-distance 守卫的问题**：`Math.abs(scrollTop - lastReorderScrollTop) >= 44px` 导致重排被推迟到滚动满一行后，产生"行静止→44px后闪现到鼠标位置"的现象。滚动停止后距离差可能卡住"不足44px"，重排永不触发。

**rAF 帧守卫方案**：每帧最多一次重排，下一帧自动解锁，60fps 跟随零延迟。

```javascript
let reorderGuard = false; // rAF 帧守卫：每帧最多一次重排

if (!reorderGuard) {
  rowReorderById(dragItemId, targetRecord.id);
  reorderGuard = true;
  requestAnimationFrame(() => { reorderGuard = false; });
}
```

| 旧 scroll-distance 守卫 | 新 rAF 帧守卫 |
|------------------------|--------------|
| 44px 延迟 → "不跟随+闪现" | **0 延迟，逐帧跟随** |
| 滚动停止后可能锁死 | rAF 下一帧自动解锁 |
| 需追踪容器 scrollTop | 只需一个 boolean |

### 文件改动

| 文件 | 改动 |
|------|------|
| `InboundList.vue` `onRowDragOver` | `lastReorderScrollTop` 距离条件 → `reorderGuard` rAF 帧守卫 |
| `InboundList.vue` `onRowDrop` | `lastReorderScrollTop=0` → `reorderGuard=false` |
| `InboundList.vue` `onRowDragStart` | 同上 |
| `InboundList.vue` 模块变量 | `let lastReorderScrollTop=0` → `let reorderGuard=false` |

### 回退
- 恢复 `lastReorderScrollTop` + scroll-distance 条件

---

## 2026-05-17 — 修复：拖拽行不跟随鼠标 + drop 后 RAF 未停

---

## 2026-05-17 — 修复：拖拽行来回跳动 + 触底无法停止（先 scroll 后 reorder）

### 修复：滚动中触发 reorder 形成反馈循环
**根因**：`onRowDragOver` 先 `rowReorderById` 再 `updateScroll`。重排+重绘+滚动同时发生 → DOM 布局持续抖动 → `@dragover` 的 targetRecord 每次都是新元素 → 拖拽项持续"追逐"鼠标 → 不停重排不断滚动 → 无法停止 + 行跳动。

**修复**：调换执行顺序——先 `updateScroll(e)` 更新滚动方向，再检查 `scrollDir === 0` 时才允许 `rowReorderById`。滚动中完全跳过重排，切断反馈循环。

| 文件 | 改前顺序 | 改后顺序 |
|------|---------|---------|
| `InboundList.vue:554-561` | reorder → scroll | scroll → reorder（仅 `scrollDir===0`） |
| `SubscriptionFormModal.vue:95-103` | splice → scroll | scroll → splice |

### 回退
- 恢复 `onRowDragOver` 和 `onDragOver` 为原执行顺序

---

## 2026-05-17 — 修复：InboundList 滚动容器查找（.ant-table-body 不存在时的兜底）

### 修复：InboundList auto-scroll 查不到 .ant-table-body 导致空操作
**根因**：`<a-table :scroll="{ x: 1000 }">` 没有设置 `scroll.y`，ant-design v4 因此**不生成** `.ant-table-body` div。三个 scroll 函数中的 `document.querySelector('.ant-table-body')` 全部返回 null → `getScrollThresholds()` 兜底 200px 但实际从未执行 scrollTop。用户看到的"快速滚动"是浏览器的原生行为或页面重排错觉。

**修复**：新增 `findScrollContainer()` 函数——按优先级查找可滚动容器：
1. `.ant-table-body`（存在且有 `overflow-y: auto/scroll` 时）
2. `#content-layout`（InboundsPage 的滚动区域）
3. `document.scrollingElement || document.documentElement`（页面级兜底）

同时将 `scrollContainerEl` 缓存在模块变量中，避免每帧重复查询。

| 文件 | 改动 |
|------|------|
| `InboundList.vue:441-450` | 新增 `findScrollContainer()` 三优先级查找 |
| `InboundList.vue:435-470` | `getScrollThresholds()`、`scrollTick()`、`updateScroll()` 均使用 `findScrollContainer()` / `scrollContainerEl` |
| `InboundList.vue:420-431` | `onRowDragStart` 刷新 `scrollContainerEl` 并挂载容器级 handler |
| `InboundList.vue:560-566` | `removeTableBodyDragHandler` 改为使用 `scrollContainerEl` |

### 回退
- 恢复 `getScrollThresholds` 等三处为 `document.querySelector('.ant-table-body')`；删除 `findScrollContainer` 和 `scrollContainerEl`

---

## 2026-05-17 — 容器级 @dragover 补空白区域 + InboundList 触发区 cap 400→600

### 修复：下边缘空白区域无 @dragover 导致滚动速度锁死
**根因**：item 级的 `@dragover.prevent` 绑定在 `.inbound-item` / ant-table `<tr>` 上。item 之间 2px margin 和最后一个 item 下方的空白区域**不触发**事件 → `scrollDir`/`scrollDist` 锁死在最后值 → 鼠标已离开触发区但滚动持续。下边缘尤其明显（splice 重排后鼠标容易落到间隙）。

**修复**：在容器层也监听 `@dragover`，只更新滚动方向不做 splice/reorder。

| 位置 | 改前 | 改后 |
|------|------|------|
| 订阅表单 `.inbound-list` | 只有 item 级 `@dragover` | 新增容器级 `@dragover.prevent="onDragOverContainer"` |
| 入站列表 `.ant-table-body` | 只有行级 `@dragover` | `onRowDragStart` 时通过 `addEventListener` 附加容器级处理器，`onRowDrop` 时移除 |

### 改进：InboundList idleTrigger cap 400→600
对 2000px 表格：触发区从 400px（20%）→ **600px（30%）**，慢速区间翻倍，立方曲线加速度有更充分的空间展开。

### 提取共享函数
| 文件 | 新函数 | 用途 |
|------|--------|------|
| `SubscriptionFormModal.vue` | `subUpdateScroll(container, clientY)` | item 级 + 容器级共用 |
| `InboundList.vue` | `updateScroll(e)` | 行级 + 容器级共用 |

### 回退
- 删除容器级 `@dragover` 处理器；`idleTrigger` cap 改回 400

---

## 2026-05-17 — 自动滚动改为纯位置驱动（无状态机、无方向锁定）

### 改进：去掉状态机，每次 onDragOver 只看鼠标当前位置
**方案**：删除 `scrollDir` 状态机、`release` 迟滞释放、方向锁定、对侧守卫。每次 `onDragOver` 独立判断：
- `topDist < idleTrigger` → 上滚，速度 = `f(topDist / idleTrigger)`
- `botDist < idleTrigger` → 下滚，速度 = `f(botDist / idleTrigger)`
- 离开触发区 → **立即停止**（无需等 release）

**效果**：鼠标在触发区内微调即可连续改变速度，不会"越过快慢分界线"；离开触发区即停，无回滚可能。

| 维度 | 旧状态机 | 新纯位置 |
|------|---------|---------|
| 方向切换 | 需释放→空闲→对侧触发 | 鼠标跨中线即切 |
| 停止条件 | 必须离开触发区 + 跨越释放区 | 离开触发区即停 |
| 回滚风险 | 有 | **无** |
| 速度控制 | 被方向锁定"困住" | 鼠标微调连续改变 |
| 代码量 | 方向锁定 + 迟滞 + 对侧守卫 ≈ 50行 | **≈ 20行** |

### 删除的变量/逻辑
- `subScrollDir` / `scrollDir` 持久方向状态 → 改为每次 onDragOver 覆盖的临时 `dir`
- `release` 阈值 → 删除（`getScrollThresholds` 不再返回）
- 方向锁定（if/else if/else 链）→ 删除
- `subLastDir` / 对侧守卫 → 删除

### 文件改动

| 文件 | 改动 |
|------|------|
| `SubscriptionFormModal.vue:48-121` | `onDragOver` 纯位置判断；`getSubScrollThresholds` 只返回 `idleTrigger`；`subScrollTick` 仅作 rAF 执行器 |
| `InboundList.vue:422-540` | 同上；`onRowDragOver` 纯位置判断 |

### 回退
- 恢复 `scrollDir` 状态机 + `release` 阈值 + if/else if/else 方向锁定链 + 对侧守卫

---

## 2026-05-17 — 慢速平滑滚动：rAF 逐像素代替 setTimeout 跳行

### 改进：消除顿挫感 + 入站列表速度变化可感知
**方案**：将 `setTimeout(scrollTick, delay)` + `scrollTop += dir × ROW_H`（跳一行）改为 `requestAnimationFrame(scrollTick)` + `scrollTop += dir × pxPerMs × delta`（逐像素）。每帧根据 `delta` 时间差和 `pxPerMs` 速度计算微小位移，帧率无关，任意速度下平滑无跳变。

同时扩大 InboundList 的 `idleTrigger` 上限：200px → **400px**，使高大表格（50 条时 ~2000px）也能覆盖足够触发范围（20% 高度），让立方曲线加速度有空间展开。

| 文件 | 改动 |
|------|------|
| `SubscriptionFormModal.vue:48-120` | `setTimeout`/`subTimerId` → `requestAnimationFrame`/`subRAF`；`subScrollTick(timestamp)` 用 `pxPerMs * delta` 逐像素；`subLastTs` 帧时间追踪 |
| `InboundList.vue:422-452` | 同上 rAF 改造；`idleTrigger` cap 200→400 |
| `InboundList.vue:498-528` | `scrollTimerId` → `scrollRAF`；`clearTimeout` → `cancelAnimationFrame` |

### 速度对比（px/s，平滑滚动）

| 位置 | 旧（跳行，34/44px 一顿） | 新（逐像素，无顿挫） |
|------|------------------------|-------------------|
| 贴边（t=0, 300ms） | 113 / 147 px/s | 113 / 147 px/s ✅ |
| 区内 50%（t=0.5, 925ms） | 37 / 48 px/s | 37 / 48 px/s ✅ |
| 触发边界（t=1, 5300ms） | 6.4 / 8.3 px/s | 6.4 / 8.3 px/s ✅ |

速度值不变，但呈现方式从"每 delay ms 跳 34/44px"变为"每帧平滑移动不足 2px"，顿挫感完全消除。

### 回退
- 恢复 `setTimeout(scrollTick, delay)` + `container.scrollTop += dir * ROW_H`；`idleTrigger` cap 改回 200

---

## 2026-05-17 — 修复：订阅表单 subScrollTick 滚错了容器（左侧→右侧）

### 修复：subScrollTick / getSubScrollThresholds 使用 document.querySelector 取了错误的 .inbound-list
**根因**（抓包日志确认）：模板中有两个 `.inbound-list`（左侧可用入站 + 右侧已选入站），`document.querySelector('.inbound-list')` 返回**第一个匹配**即**左侧**容器。`subScrollTick()` 滚动左侧容器，`getSubScrollThresholds()` 以左侧容器高度计算阈值。同时 `onDragOver()` 通过 `e.currentTarget.closest('.inbound-list')` 获取正确的右侧容器来计算方向逻辑。

两者不一致导致：左侧面板不断滚动 → 整个组件 layout 抖动 → `@dragover` 捕获到的 v-for `index` 持续跳变（日志显示 `dragIdx: 9→index: 17`, `dragIdx: 25→index: 30`……）→ splice 将拖拽项从近顶处移到远处 → 用户看到"整个列表跳到末尾"。

**修复**：新增模块变量 `subScrollContainer`，由 `onDragOver` 保存右侧容器引用。`subScrollTick` 和 `getSubScrollThresholds` 均使用该变量，不再调用 `document.querySelector`。

| 文件 | 改动 |
|------|------|
| `SubscriptionFormModal.vue:48-120` | 新增 `subScrollContainer`；`getSubScrollThresholds` 用 `subScrollContainer`；`subScrollTick` 用 `subScrollContainer`；`resetSubScroll` 清空 `subScrollContainer` |

### 回退
- 恢复 `getSubScrollThresholds` 和 `subScrollTick` 为 `document.querySelector('.inbound-list')`；删除 `subScrollContainer`

---

## 2026-05-17 — 修复：拖拽自动滚动方向反转（回滚）

### 修复：鼠标离开边缘后自动滚动方向反转
**根因**：触发区 `trigger = h × 0.5` 与释放区 `release = h × 0.65` 的数学设计缺陷。对于容器高度 `h`，上下两个 trigger 区之和恰好等于 `h`，**不存在中立区**。当鼠标从上方 release 区移出时，`botDist = h - release = h × 0.35`，永远小于 `trigger = h × 0.5`，必然立即激活下侧滚动 → 方向反转（回滚）。

**方案**：三层防护——
1. **方向锁定**：活跃滚动时只检查同侧的 release 条件，完全不检查对侧 edge
2. **空闲态收缩 trigger**：空闲态使用 `idleTrigger = h × 0.3`（min 80px, max 200px），保证容器中间有中立区
3. **对立区守卫**：release 条件满足时检查对侧是否仍在 idleTrigger 内，若在则不停止滚动，继续按原方向滚

| 文件 | 改动 |
|------|------|
| `SubscriptionFormModal.vue:48-113` | 拆分 `idleTrigger`/`release`；direction-locked scrollDir 逻辑；闲态用 `idleTrigger`，活跃态只检同侧 release |
| `InboundList.vue:422-536` | 同上完全一致的架构 |

### 回退
- 恢复 `getScrollThresholds()` 返回 `{trigger, release}`（单值），恢复 `if/else if` 链式方向检查

---

## 2026-05-17 — 修复：开启 autoIncludeAllEnabled 时自动排序（两者应完全独立）

### 修复：autoIncludeAllEnabled 不应触发排序
**根因**：`syncInboundsWithAutoInclude()` 按 `allInbounds`（API sort_order 顺序）迭代添加新入站。当 `selectedInbounds` 为空（新建订阅）时，所有入站按 API 顺序添加，看起来像"按入站列表顺序排序"。同时 `onSave` 中的 `selectedInbounds.value = allInbounds.value.filter(...)` 完全替换选中列表，丢失所有手动排序。

**原则**：两个开关必须完全独立——
- **始终包含所有启用入站**只负责增删：确保所有已启用入站在选中列表，所有已禁用入站不在列表。`绝不排序`。
- **始终按入站列表排序**只负责排序：将当前选中列表按入站列表顺序排序。`绝不增删`。

| 文件 | 改动 |
|------|------|
| `SubscriptionFormModal.vue:244-263` | `syncInboundsWithAutoInclude()` 重写：先移除已禁用，再追加新入站（`for ib of allInbounds` 迭代用于查找缺失项，但现有项顺序完全保留） |
| `SubscriptionFormModal.vue:300-303` | `onSave` 中 `autoIncludeAllEnabled` 改为调用 `syncInboundsWithAutoInclude()` 而非替换整个列表 |

### 回退
- 恢复 `syncInboundsWithAutoInclude()` 旧实现；恢复 `onSave` 中的 `allInbounds.value.filter(...)` 替换

### 修复：后端 Update 未包含两个开关字段
**根因**：`web/service/subscription.go:Update()` 的 `updates` map 缺少 `sync_with_inbound_order` 和 `auto_include_all_enabled`。编辑订阅时这两个字段被提交但被后端忽略，数据库始终保留旧值。用户在 UI 中点击开关后保存，重新打开一看开关还是之前的状态 → "无法手动关闭/打开"。

**修复**：在 `updates` map 中加入 `sync_with_inbound_order` 和 `auto_include_all_enabled`。

### 修复：前端 `watch(allInbounds)` 条件嵌套
**根因**：`watch(allInbounds)` 的 deep watcher 中 `sortByInboundOrder()` 被嵌套在 `if (form.autoIncludeAllEnabled)` 内部。当只有 `syncWithInboundOrder` 开启而 `autoIncludeAllEnabled` 关闭时，`allInbounds` 变化不会触发排序。

**修复**：将两个条件拆分为独立的 `if` 语句。

| 文件 | 改动 |
|------|------|
| `web/service/subscription.go:70-87` | `updates` map 新增 `sync_with_inbound_order`、`auto_include_all_enabled` |
| `SubscriptionFormModal.vue:269-272` | `watch(allInbounds)` 拆分 `if (form.autoIncludeAllEnabled)` 和 `if (form.syncWithInboundOrder)` |

### 回退
- 恢复 `subscription.go` 的 `updates` map（去掉两个字段）
- 恢复 `SubscriptionFormModal.vue` 的嵌套 `if`

---

## 2026-05-17 — 方案 B：自动滚动改为动态比例触发区 + 立方曲线速度

### 改进：触发区按容器高度 50% 动态计算，速度改为立方曲线
**方案**：从固定 250px 触发区改为**动态比例**——`getScrollThresholds()` 实时查询容器高度，触发区 = `min(400, max(150, height × 0.5))`，释放区 = `min(550, max(200, height × 0.65))`。速度从线性插值改为**立方曲线**：`delay = 300 + 5000 × t³`。

| 鼠标位置 | 旧速度（线性 800~3500） | 新速度（立方 300~5300） |
|---------|----------------------|---------------------|
| 贴边（t≈0） | 800ms | **300ms** 🔥 |
| 区内 25%（t=0.25） | 1475ms | **378ms** |
| 区内 50%（t=0.5） | 2150ms | **925ms** |
| 区内 75%（t=0.75） | 2825ms | **2409ms** |
| 触发边界（t=1） | 3500ms | **5300ms** ⏳ |

**效果**：立方曲线使 `t<0.6` 区域速度均 <1400ms，仅靠边缘 20-30% 区域才急剧加速。大部分触发区感觉偏慢，鼠标越靠近边缘速度感越强，加速度极其明显。

| 文件 | 改动 |
|------|------|
| `InboundList.vue:425-446` | 移除 `SCROLL_TRIGGER/SCROLL_RELEASE` 常量；新增 `getScrollThresholds()` 动态阈值函数；`scrollTick` 改为立方曲线 `300+5000×t³` |
| `InboundList.vue:507-519` | `onRowDragOver` 使用 `getScrollThresholds()` 获取动态 `{trigger, release}` |
| `SubscriptionFormModal.vue:52-73` | 移除 `SUB_SCROLL_TRIGGER/SUB_SCROLL_RELEASE`；新增 `getSubScrollThresholds()`；`subScrollTick` 立方曲线 |
| `SubscriptionFormModal.vue:86-97` | `onDragOver` 使用 `getSubScrollThresholds()` |

### 回退
- 恢复固定 `SCROLL_TRIGGER=250`、`SCROLL_RELEASE=350`、线性 `800 + t*2700`；移除 `getScrollThresholds()` 和 `getSubScrollThresholds()`

---

## 2026-05-17 — 修复：wireguard 入站导致页面不停 Loading（secretKey 非 base64 引发 atob 异常）

### 修复：wireguard 入站导致前端 JS 异常
**根因**：wireguard 入站的 `settings.secretKey` 设为 `"SECRET-KEY-1"`，包含 `-` 字符不在 base64 字母表中。前端 `Inbound.fromJson()` → `WireguardSettings` 构造函数 → `Wireguard.generateKeypair(secretKey)` → `keyFromBase64()` → `atob("SECRET-KEY-1")` 抛出 `InvalidCharacterError`，导致 `setInbounds` 中途崩溃，`fetched` 永不为 `true`，页面卡在 loading。

**修复**：移除 wireguard settings 中的 `secretKey` 和 `address` 字段，只保留 `peers`。前端构造函数在 `secretKey` 为 `undefined` 时会自动调用 `Wireguard.generateKeypair()` 生成有效密钥。

| 文件 | 改动 |
|------|------|
| `seed_data.ps1` | Wireguard settings 从 `{"peers":[...],"secretKey":"SECRET-KEY-1","address":"10.0.0.1/24"}` 改为 `{"peers":[...]}` |

### 回退
- 恢复 `secretKey` 字段（但必须使用有效 base64）

---

## 2026-05-17 — 预置测试数据：50 入站 + 20 节点 + 20 订阅

### 新增：测试数据自动生成脚本
**方案**：通过 API 批量创建测试数据，使用 PowerShell 脚本（`seed_data.ps1`）。入站各 5 个共 10 种协议，节点 20 个，订阅 4 种格式各 5 个。

### 修复：hysteria 入站创建失败（empty client ID）
**根因**：hysteria 协议验证要求客户端 JSON 包含 `auth` 字段(`client.Auth`)，但测试脚本仅提供 `password` 字段。

| 文件 | 改动 |
|------|------|
| `seed_data.ps1` | hysteria 设置中 `clients[].password`→`clients[].auth`；移除 hysteria 客户端的 `password` 字段 |

### 测试数据
| 类型 | 数量 | 说明 |
|------|------|------|
| 入站 | 50 | vmess/vless/trojan/shadowsocks/wireguard/hysteria/mixed/http/tunnel/tun 各 5，端口 10001~10050 |
| 节点 | 20 | Node‑1 ~ Node‑20 |
| 订阅 | 20 | Sub‑1 ~ Sub‑20，base64/json/clash/text 各 5 |

### 回退
- 无（纯数据操作，删除数据库即可）

---

## 2026-05-17 — 边缘滚动长区三段速（250px触发区 + 800~3500ms连续速度）

### 修复：边缘触发区仍然太短，两段速加速度不可感知
**方案**：触发区从 140 扩到 **250px**，释放区从 200 扩到 **350px**。`scrollTick` 使用**连续速度**线性插值（800~3500ms），三个区间即可感知加速度：
- 0~80px（近边）：800~1520ms/行（最快）
- 80~170px（中区）：1520~2430ms/行
- 170~250px（边界）：2430~3500ms/行（最慢）

| 文件 | 改动 |
|------|------|
| `InboundList.vue:426-437` | `TRIGGER` 140→250, `RELEASE` 200→350, 两段速→连续速度公式 `800 + (scrollDist/250) * 2700` |
| `SubscriptionFormModal.vue:52-63` | `SUB_TRIGGER` 140→250, `SUB_RELEASE` 200→350, 同连续速度公式 |

### 回退
- 恢复 `TRIGGER` 140、`RELEASE` 200、两段速 1500/3000ms

---

## 2026-05-17 — 修复：tunnel settings 尾部垃圾数据导致 JSON.parse 异常

### 修复：入站页 loading（数据问题而非代码问题）
**根因**：tunnel 入站的 settings 字段值为 `{}10042,tunnel,{}10043...`（CSV 行未正确换行导致多条数据合并）。PowerShell 的 `ConvertFrom-Json` 宽容忽略尾部垃圾，但浏览器 `JSON.parse('{}10042...')` 严格抛出 SyntaxError，`setInbounds` 中途失败，`fetched` 永不为 `true`。

**修复**：`forceDel` 删除 ID 41，重新创建 settings=`{}` 的 tunnel 入站。

| 文件 | 操作 |
|------|------|
| 数据 | `forceDel` 删除 ID 41，重新创建 10041 tunnel（settings=`{}`）|

### 回退
- 无（纯数据操作）

---

## 2026-05-17 — scrollTick rAF→setTimeout（修复入站页加载异常）

### 修复：入站页 loading（rAF timestamp 参数引发 JS 编译问题）
**根因**：`requestAnimationFrame` 的 `timestamp` 参数在某些环境下未被正确传递，或 minifier 对 `scrollTick(timestamp)` 产生编译异常，导致 JavaScript 运行时出错。

**修复**：切换到 `setTimeout(scrollTick, SCROLL_DELAY)`，不依赖 timestamp 参数，帧率无关。

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:422-437` | `rAF`+`timestamp` → `setTimeout`；`scrollTimer` → `scrollTimerId` |
| `frontend/.../InboundList.vue:507-508` | `requestAnimationFrame` → `setTimeout`；`cancelAnimationFrame` → `clearTimeout` |
| `frontend/.../SubscriptionFormModal.vue:48-67` | 同模式：`subRAF` → `subTimerId`；rAF → `setTimeout` |
| `frontend/.../SubscriptionFormModal.vue:85-86` | 同模式更新 |
| `frontend/.../SubscriptionFormModal.vue:88` | `resetSubScroll` 更新 |

### 回退
- 恢复 `requestAnimationFrame` + `timestamp` 版本

---

## 2026-05-17 — 滚动 D+E 方案（rAF 时间戳节流 + 扩大触发区）

### 修复：边缘滚动速度太快、边缘长度太短
**方案 D+E**：触发区从 50px 扩到 80px、释放阈值从 90 扩到 120；`frameSkip` 帧跳计数改为 `timestamp` 时间戳节流，固定 1200ms 滚动一行（0.83 行/秒），帧率无关。

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:422-440` | 删除 `scrollDist`/`scrollFrame`；新增 `scrollTimer`/`SCROLL_DELAY=1200`/`scrollTick(timestamp)` 时间戳节流；`SCROLL_TRIGGER` 50→80；`SCROLL_RELEASE` 90→120 |
| `frontend/.../InboundList.vue:510-512` | 删除 `scrollDist = ...`；`scrollTimer = 0` 重置 |
| `frontend/.../SubscriptionFormModal.vue:48-67` | 同模式：`subScrollDist`/`subScrollFrame` → `subScrollTimer`/`SUB_SCROLL_DELAY=1200`/`subScrollTick(timestamp)`；阈值 50→80、90→120 |
| `frontend/.../SubscriptionFormModal.vue:88-89` | 删除 `subScrollDist = ...`；`subScrollTimer = 0` 重置 |

### 回退
- 恢复原 `frameSkip` 帧跳计数方案和 50/90 阈值

---

## 2026-05-17 — JS 注入 style 方式实现 hover 抑制（避免 CSS 编译问题）

### 修复：入站列表排序拖拽 hover 抑制（JS 注入方案）
**方案**：通过 `document.createElement('style')` 动态注入 CSS，拖拽开始注入、结束移除，完全绕过 Vue scoped CSS + lightningcss 编译流程。

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:400-410` | 新增 `injectDragStyle()` / `removeDragStyle()` 函数 |
| `frontend/.../InboundList.vue:412-415` | `onRowDragStart` 调用 `injectDragStyle()` |
| `frontend/.../InboundList.vue:507` | `onRowDrop` 调用 `removeDragStyle()` |
| `frontend/.../InboundList.vue:379-382` | `confirmReorder` / `cancelReorder` 调用 `removeDragStyle()` |

### 回退
- 删除 `injectDragStyle`/`removeDragStyle` 函数及所有调用点

---

## 2026-05-17 — 非 scoped 方式恢复 :global() CSS（hover 抑制）

### 修复：入站列表排序拖拽 hover 抑制
**方案**：将 CSS 从 `<style scoped>` 移到非 scoped `<style>` 块，避免 lightningcss 编译异常。

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:1257-1264` | **新增** 非 scoped `<style>` 块，恢复 `.reorder-active` hover 抑制 CSS |

### 回退
- 删除非 scoped `<style>` 块即可

---

## 2026-05-17 — 移除 :global() CSS（修复入站页加载异常）

### 修复：入站页 loading（`:global()` 导致 CSSOM 异常）
**根因**：`<style scoped>` 中的 `:global(.reorder-active .ant-table-tbody .ant-table-row > td)` 经 lightningcss 处理后产生无效 CSS，浏览器构造 CSSOM 时失败，JavaScript 运行时异常。

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:1257-1262` | 删除 `:global()` hover 抑制 CSS，恢复页面正常加载 |

### 回退
- 无（仅为代码删除，恢复前版本即可）

---

## 2026-05-17 — 边缘滚动降速（40~60帧）+ 订阅表单新增自动滚动

### 修复：边缘滚动太快
**方案 C**：`frameSkip` 范围从 15~35 展宽到 40~60 帧。

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:419` | `frameSkip = max(15,…)` → `max(40, round((1-progress)*20+40))`（40~60帧 ≈ 1~1.5行/秒）|
| `frontend/.../SubscriptionFormModal.vue:48-86` | **新增** `subScrollTick()` + `onDragOver` 中自动滚动逻辑（阈值 50/90，40~60帧，`SUB_ROW_H=34`）|
| `frontend/.../SubscriptionFormModal.vue:57-58` | `onDragEnd`/`onDrop` 调用 `resetSubScroll()` 停止滚动 |
| `frontend/.../SubscriptionFormModal.vue:407` | `@dragover.prevent` 传 `$event` |

### 回退
- 回退 `frameSkip` 公式；删除订阅表单的 `subScrollTick` 和 scroll 逻辑

---

## 2026-05-17 — 入站列表排序拖拽时 :hover 抑制（:global 方式）

### 修复：入站列表排序拖拽时 hover 显示干扰
**根因**：入站列表在排序拖拽期间无 CSS 抑制 `<td>` 的 `:hover` 效果，hover 时 `<td>` 背景变化导致行 A 与行 C 样式不一致。

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:1257-1261` | 新增 `:global(.reorder-active .ant-table-tbody .ant-table-row > td) {:bg transparent}` 和 `:global(:hover > td)` 抑制 hover |

### 回退
- 移除新增的 `:global()` CSS 规则

---

## 2026-05-17 — 回退文字颜色改动的浅色误改

### 修复：回退不必要的文字颜色改动
`itemStyle()` 中的 `color: #ffffff` 和 `--hl-text` 影响浅色模式可读性，且用户认为拖动高亮的蓝色背景已足够清晰，不需要修改文字颜色。回退到只保留背景色。

| 文件 | 改动 |
|------|------|
| `frontend/.../SubscriptionFormModal.vue:86-89` | 移除 `color: #ffffff` 和 `--hl-text` CSS 变量设置 |
| `frontend/.../SubscriptionFormModal.vue:524` | `.move-btn` 恢复原始 `color` |

---

## 2026-05-17 — 深色/超暗拖拽行文字颜色自动调整为白色

### 新增：高亮行文字颜色自适应
**背景**：深色/超暗模式下，拖拽高亮行背景较亮，默认亮色文字在亮蓝背景上对比度不足。

| 文件 | 改动 |
|------|------|
| `frontend/.../SubscriptionFormModal.vue:86-89` | `itemStyle()` 高亮行在暗色/超暗模式下设置 `color: #ffffff` + CSS 变量 `--hl-text: #ffffff` |
| `frontend/.../SubscriptionFormModal.vue:524` | `.move-btn { color: var(--hl-text) }`，按钮颜色跟随父级高亮状态 |

### 回退
- 移除 `itemStyle()` 中 `color` 和 `--hl-text` 设置；恢复 `.move-btn` 原有 color

---

## 2026-05-17 — 移除 !important，改用 :hover 变体（特异性提升）

### 修复：每行异常亮色底色（第21次引入的 `!important` 导致）
**根因**：`background: #fafafa !important` 强制每行使用亮白背景，配合 `border: none`，所有行无分隔地堆在一起形成亮色块。

| 文件 | 改动 |
|------|------|
| `frontend/.../SubscriptionFormModal.vue:488-492` | 移除 `!important`；新增 `.is-dragging-inbounds .inbound-item.selected:hover { background: #fafafa }`（特异性 0,5,0 > 全局 hover 的 0,4,0） |

### 回退
- 恢复 `!important`，移除 `:hover` 变体

---

## 2026-05-17 — 回退 border-bottom → border: none !important

### 修复：拖拽时每行出现异常亮色底色
**根因**：`border-bottom: 1px solid #e8e8e8`（无 `!important`）与 `:hover` 的 `border-color: #1890ff`（相同特异性 0,4,0，`:hover` 定义在后）冲突，`:hover` 胜出使底部边框变蓝。左右无边框使 `#fafafa` 背景更突出。

| 文件 | 改动 |
|------|------|
| `frontend/.../SubscriptionFormModal.vue:488-491` | 恢复 `border: none !important`，移除 `border-bottom` |

### 回退
- 恢复回 `border-bottom` 版本

---

## 2026-05-17 — 拖拽 border:none → border-bottom 保留分隔线

### 修复：拖拽时多行融合成大片异常亮色
**根因**：`border: none !important` 移除了行间所有边框分隔，`#fafafa` 背景的行在视觉上融合成一片，看起来像是亮色块。

| 文件 | 改动 |
|------|------|
| `frontend/.../SubscriptionFormModal.vue:488-491` | `border: none !important` → `border-top/left/right: none !important; border-bottom: 1px solid #e8e8e8` |

### 回退
- 恢复为 `border: none !important`

---

## 2026-05-17 — 浅色模式拖拽时 :hover 背景覆盖（`!important` 修复）

### 修复：浅色模式拖拽时非高亮行依然有异常底色
**根因**：Vue 3 scoped CSS 为 `.is-dragging-inbounds .inbound-item.selected` 和 `.inbound-item.selected:hover` 均附加了 `[data-v-xxx]`，两者特异性**相同**(0,4,0)。`:hover` 规则定义在后，其 `background: #f0f5ff` 覆盖了 `.is-dragging-inbounds` 的 `background: #fafafa`。深色/超暗模式因多一个 `.sub-form-dark` 父选择器(0,5,0)而不受影响。

| 文件 | 改动 |
|------|------|
| `frontend/.../SubscriptionFormModal.vue:490` | `background: #fafafa` → `background: #fafafa !important`，强制覆盖 `:hover` |

### 回退
- 移除 `!important`

---

## 2026-05-17 — 拖拽时非高亮行 `background: ''` → `undefined` 修复

### 修复：拖拽过程中非高亮行底色异常
**根因**：`itemStyle()` 对非高亮行返回 `background: ''`（空字符串），浏览器解析为 `background-color: transparent`，覆盖了 CSS 类的 `background: #fafafa`，导致非高亮行底色透明露出面板背景。

| 文件 | 改动 |
|------|------|
| `frontend/.../SubscriptionFormModal.vue:78-89` | `itemStyle()` 重构：非高亮行不设置 `background`/`border`（由 CSS 类控制），高亮行仅设置 `background`+`outline` |

### 回退
- 恢复 `itemStyle()` 为条件表达式设置空字符串的旧版本

---

## 2026-05-17 — 修复入站页加载异常（wireguard/mixed/http/tunnel/tun settings 格式）

### 修复：入站列表页一直 loading
**根因**：wireguard 使用 `peers`、mixed/http 使用 `accounts`、tunnel/tun 无客户端，但测试数据使用了通用的 `{"clients":[...]}` 格式，导致 `Inbound.fromJson()` 处理这些协议时抛出异常，`fetched` 永远为 `false`，页面卡在 loading 状态。

| 文件 | 涉及 |
|------|------|
| 数据 | 50 个入站的 settings 格式均已修正（wireguard → `peers`、mixed/http → `accounts`、tunnel/tun → `{}`、其余 → `clients`）|
| `frontend/src/models/inbound.js` | 各协议 Settings 的 fromJson 方法需接受非标准格式（已由项目原始代码覆盖）|

### 测试数据

| 类型 | 数量 | 说明 |
|------|------|------|
| 入站 | 50 | vless/vmess/trojan/shadowsocks/wireguard/hysteria/mixed/http/tunnel/tun 各 5 |
| 节点 | 20 | Node‑1 ~ Node‑20 |
| 订阅 | 20 | Sub‑1 ~ Sub‑20，base64/json/clash/text |

### 回退
- 删除 50 个入站，重建时使用正确的 settings 格式

---

## 2026-05-17 — 移除有问题的 :deep() CSS，修复入站页加载异常

### 修复：入站列表页始终 loading
**根因**：`<style scoped>` 中 `.reorder-active :deep(.ant-table-row > td)` 经 Vue scoped 编译 + lightningcss 压缩后产生无效 CSS，导致 JS 运行时异常，整个 InboundList 组件无法渲染。

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:1260-1262` | 删除 `:deep(.ant-table-row > td) { background-color: transparent !important }` |

### 回退
- 恢复 `:deep()` CSS

---

## 2026-05-17 — 拖拽行视觉统一（:hover→所有行 border:none）

### 修复：拖拽过程中不同行边框/底色不一致
**根因**：CSS 仅覆盖 `:hover`/`:active`/`:focus` 的 `border: none`，非伪类状态行仍有 `1px solid #e8e8e8` 边框，`:hover` 行还有 `background: #f0f5ff` 底色差异。

| 文件 | 改动 |
|------|------|
| `frontend/.../SubscriptionFormModal.vue:486-488` | `.is-dragging-inbounds .inbound-item.selected { border: none !important }` 取消伪类区分，拖拽期间所有行统一无边框 |

### 回退
- 恢复伪类限定 `:hover, :active, :focus` 版本

---

## 2026-05-17 — 深色/超暗拖拽白边残留（border-color→border:none）

### 修复：深色/超暗模式下拖拽后旧位行显示白色边框
**根因**：拖拽 CSS 中 `border-color: #e8e8e8 !important` 是浅色模式适用的灰色，在深色背景（`#383838`/`#222`）上显示为"白色边框"。

| 文件 | 改动 |
|------|------|
| `frontend/.../SubscriptionFormModal.vue:488-489` | `border-color: #e8e8e8 !important` → `border: none !important`，拖拽期间彻底移除所有模式的边框 |

### 回退
- 恢复 `border-color: #e8e8e8 !important`

---

## 2026-05-17 — 拖拽白边/色差修复

### 修复：
1. **被拖拽行白边**：蓝色高亮 `background: #d6e9ff` 之上叠加了默认 `border: 1px solid #e8e8e8`（灰色边框在蓝底上呈现"白边"）
2. **原位置行色差**：`background: inherit !important` 使 hover 时背景继承父级而非默认 `#fafafa`

| 文件 | 改动 |
|------|------|
| `frontend/.../SubscriptionFormModal.vue:83` | `itemStyle()` 高亮时设 `border: 'none'`，去掉灰色边框 |
| `frontend/.../SubscriptionFormModal.vue:484-488` | CSS 去掉 `background: inherit !important`，仅保留 `border-color: #e8e8e8 !important`，行背景保持默认 |

### 回退
- 回退 `itemStyle` 中 `border: 'none'`；恢复 `background: inherit !important`

---

## 2026-05-17 — 拖拽蓝边残留 + `!important` 强制覆盖 + `:focus` 处理

### 修复：拖拽后旧位行蓝边残留
**根因**：`is-dragging-inbounds` 时，`border-color: #1890ff` 来自 `:hover` 伪类，之前 CSS 因 scoped 转换后特异性不足/`!important` 缺失未能覆盖。
**修复**：加 `!important` + 增加 `:focus` 覆盖。

| 文件 | 改动 |
|------|------|
| `frontend/.../SubscriptionFormModal.vue:484-488` | CSS 改为 `background: inherit !important; border-color: #e8e8e8 !important;`；新增 `:focus` 伪类 |

### 回退
- 移除 `!important` 和 `:focus` 规则

---

## 2026-05-17 — 拖拽时目标行蓝色高亮 + :active 残留清除

### 修复：
1. **拖拽时目标行无蓝色高亮**：`itemStyle()` 中 `!isDraggingInbounds` 阻止了拖拽期间 `subDraggedIdx` 高亮
2. **原始行 `:active` 残留**：`mousedown` 触发 `:active`，HTML5 DnD 消费 `mouseup` 后未清除

| 文件 | 改动 |
|------|------|
| `frontend/.../SubscriptionFormModal.vue:79` | `itemStyle` 移除 `!isDraggingInbounds.value &&`，拖拽期间 `subDraggedIdx` 行持续显示蓝色高亮 |
| `frontend/.../SubscriptionFormModal.vue:483-484` | CSS 新增 `.is-dragging-inbounds .inbound-item.selected:active { background: inherit }` 禁用 `:active` 残留 |
| `frontend/.../SubscriptionFormModal.vue:147` | `watch(props.open)` 中强制 `isDraggingInbounds.value = false` 复位 |

### 回退
- 回退 `itemStyle` 中 `showHighlight` 条件；回退 `:active` CSS 规则

---

## 2026-05-17 — 浅色 hover 恢复蓝色框 + 拖拽禁用 hover（三模式）

### 修复：
1. **浅色 hover 回归蓝色框**：之前改为 `#e8e8e8` 纯灰色，用户要求恢复 `background: #f0f5ff; border-color: #1890ff`
2. **拖拽时禁用 hover（三模式）**：`is-dragging-inbounds` class + CSS `.inbound-item:hover { background: inherit !important }` 覆盖浅色/黑暗/超暗所有模式
3. **拖拽时原始位置高亮残留**：改用 `itemStyle()` 函数显式访问 `.value`，避免 Vue 模板 ref 自动解包失效

| 文件 | 改动 |
|------|------|
| `frontend/.../SubscriptionFormModal.vue:488-490` | hover 恢复 `background: #f0f5ff; border-color: var(--ant-primary-color, #1890ff)` |
| `frontend/.../SubscriptionFormModal.vue:73-91` | 新增 `itemStyle()` 函数替代模板内联 style，显式访问 `.value`；`isDragDark` computed 重构避免冗余 |

### 回退
- 回退 `itemStyle()` 函数为模板内联 `:style`；回退 hover CSS 值

---

## 2026-05-17 — 订阅入站拖拽时禁用 hover

### 修复：订阅表单入站选择拖拽时 hover 干扰
**根因**：右侧已选入站列表使用 `<div>` 而非 ant-table，`<style scoped>` 可正确匹配，但拖拽时不额外禁用 hover 导致视觉干扰。

| 文件 | 改动 |
|------|------|
| `frontend/.../SubscriptionFormModal.vue:67` | 新增 `isDraggingInbounds` ref |
| `frontend/.../SubscriptionFormModal.vue:47-57` | `onDragStart`/`onDragEnd`/`onDrop` 管理 `isDraggingInbounds` |
| `frontend/.../SubscriptionFormModal.vue:376` | `.panel-box` 动态绑定 `is-dragging-inbounds` class |
| `frontend/.../SubscriptionFormModal.vue:478-480` | CSS `.is-dragging-inbounds .inbound-item:hover { background: inherit !important }` |

### 回退
- 回退 `isDraggingInbounds` ref、class 绑定和 CSS 规则

---

## 2026-05-17 — :deep() 穿透 scoped + mouseleave 强制清除 hover

### 修复：hover 高亮一直不消失
**根因**：
1. Vue `<style scoped>` 给 `.ant-table-row > td` 添加 `[data-v-xxxxx]` 属性选择器，ant-table 的 `<td>` 没有此属性，CSS 永不生效
2. HTML5 DnD 期间 `mouseleave` 不触发，`drop` 后 `:hover` 停留在原始 DOM 节点上

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:1259-1262` | `.reorder-active .ant-table-tbody .ant-table-row > td` → `.reorder-active :deep(.ant-table-row > td)` 穿透 scoped 边界 |
| `frontend/.../InboundList.vue:500-509` | `onRowDrop` 追加 `document.querySelectorAll('.ant-table-row').forEach(r => r.dispatchEvent(new MouseEvent('mouseleave')))` 强制清除 hover |

### 回退
- 回退 CSS 为普通 `.ant-table-row > td`；回退 `onRowDrop` 中的 `mouseleave` dispatch

---

## 2026-05-17 — hover 完全禁用 + 滚动降速至1~2行/秒

### 修复：
1. **hover 背景干扰拖拽判断**：`:hover` 伪类仍通过 ant-table CSS 渗透，蓝/灰色背景覆盖用户看不清拖拽目标行
2. **边缘滚动太快**：`frameSkip` 30~60 帧仍在边缘时约 2 行/秒，用户觉得太快

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:1259-1262` | CSS 新增 `.reorder-active .ant-table-tbody .ant-table-row:hover > td` 覆盖 `:hover` 状态 |
| `frontend/.../InboundList.vue:419` | `frameSkip` 范围从 15~35 改为 `Math.max(30, round((1-progress)*30+30))` = 30~60 帧 → 约 1~2 行/秒 |

### 回退
- 回退 CSS `:hover > td` 规则和 `frameSkip` 公式

---

## 2026-05-17 — 超暗底色修复 + hover 去蓝盒 + 滚动再降速

### 修复：
1. **超暗模式 reorder 底色变亮**：`reorderRowProps` 固定背景 `#252526` 在超暗模式下应为 `#0c0e12`
2. **订阅入站 hover 显示蓝色框**：`.inbound-item.selected:hover` 设置 `background: #f0f5ff` + `border-color: #1890ff`，用户希望仅是变深（不显示蓝框）
3. **边缘滚动太快**：`frameSkip` 范围 8~18 帧仍太快

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:441-445` | `reorderRowProps` 检测 `is-ultra` class，超暗用 `#0c0e12` |
| `frontend/.../SubscriptionFormModal.vue:478` | `inbound-item.selected:hover` 去掉 `border-color`/蓝背景，纯变深 `#e8e8e8` |
| `frontend/.../SubscriptionFormModal.vue:524` | 超暗 `selected:hover` 改为 `#333` |
| `frontend/.../InboundList.vue:419` | `frameSkip` 范围从 8~18 改为 15~35（~2~4 行/秒） |

### 回退
- 回退 `isUltra` 检测逻辑；回退 hover CSS；回退 `frameSkip` 值

---

## 2026-05-17 — 行背景全覆盖 + 慢速逐行滚动

### 修复：
1. **`:active`/`:hover` 色残留**：CSS `td` 层面覆盖 + `<tr>` 未设固定背景，`:active` 在 DOM 复用时随节点迁移到新数据行
2. **边缘滚动太快**：`frameSkip=1` 时每帧滚动一行（~60行/秒）

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:441-454` | `reorderRowProps` 非拖拽行也设固定背景（浅色 `#fff`/深色 `#252526`），`:active`/`:hover` 无法覆盖 |
| `frontend/.../InboundList.vue:1251-1254` | CSS 改为 `.ant-table-row > td { background-color: transparent !important }` + 全行固定背景，双重保护 |
| `frontend/.../InboundList.vue:418-420` | `frameSkip = max(8, round((1-progress)*10+8))`（8~18帧 ≈ 3~7行/秒），大幅降低滚动速度 |

### 回退
- 回退 `reorderRowProps` 非拖拽行背景设置；回退 `scrollTick` frameSkip 公式

---

## 2026-05-17 — 逐行滚动 + CSS td 全面覆盖

### 修复：
1. **`:active`/`:hover` 残留**：`<td>` 级别背景覆盖不彻底，Vue DOM 复用时 `:active` 状态随节点迁移
2. **边缘滚动不精准**：像素级滚动无法准确定位到具体某行

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:1251-1256` | CSS 收缩为单条 `.reorder-active .ant-table-tbody .ant-table-row td { background: transparent !important }`，全面阻止所有 td 背景渗透（含 ant-table 奇偶行色）|
| `frontend/.../InboundList.vue:406-420` | `scrollTick` 改为逐行滚动：`SCROLL_ROW_H = 44`，`frameSkip = max(1, round((1-progress)*9+1))`（距边缘越近→跳帧越少→滚动越快），每次跳帧滚动一整行 |

### 回退
- 回退 CSS `.ant-table-tbody .ant-table-row td` 规则和 `scrollTick` 逐行逻辑

---

## 2026-05-17 — 自动滚动速度动态化 + :active 修复 + 超暗去蓝底

### 修复：
1. **`:hover`/`:active` 渗透**：ant-table 的 `<td>` 元素有独立 hover/active 背景，之前只覆盖 `<tr>` 无效
2. **超暗选中入站背景带蓝**：`#1e2228` 含蓝色调
3. **拖拽边缘滚动太慢**：固定速度 10px/frame，远/近边缘无区别

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:1244-1249` | CSS 改为 `.reorder-active .ant-table-row td, :hover td, :active td, :focus td { background: transparent !important }` 精准阻止 `<td>` 渗透 |
| `frontend/.../InboundList.vue:409-414` | `scrollTick` 新增 `scrollDist` 记录距边缘距离，速度公式 `max(3, progress * 47)`（距边缘越近→越快，3~50px/frame）；阈值扩至 `TRIGGER=50`/`RELEASE=90` |
| `frontend/.../InboundList.vue:473-483` | `onRowDragOver` scroll 段更新 `scrollDist` |
| `frontend/.../SubscriptionFormModal.vue:523-524` | 超暗 `selected` 背景 `#1e2228`→`#222`，`selected:hover` `#242830`→`#2a2a2a` |

### 回退
- 回退 CSS `.reorder-active td` 规则；回退 `scrollTick` 速度公式和阈值；回退颜色值

---

## 2026-05-17 — :active/:hover 残留 + 超暗 panel-box 去蓝底

### 修复：HTML5 DnD :active 状态残留 + 超暗模式 panel-box 蓝色调
**根因**：
1. HTML5 DnD `dragstart` 触发 ant-table 行的 `:active` 伪类，`mouseup` 被 DnD API 消费，`drop` 后 `:active` 未清除，旧位行保持激活色
2. CSS `:hover` 在内置 ant-table 样式中优先级高于 inline style
3. 超暗模式 `panel-box` 背景 `#121418` 带蓝色调，`rgba(24,144,255,0.3)` 在其上对比度不足

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:486-495` | `onRowDrop` 追加 `window.getSelection()?.removeAllRanges()` 清除选择状态 |
| `frontend/.../InboundList.vue:1244-1245` | 新增 CSS `.reorder-active .ant-table-row:active,:hover { background: inherit !important }` 防止伪类覆盖 |
| `frontend/.../InboundList.vue:791` | 表格容器加 `:class="'reorder-active': reorderMode"` |
| `frontend/.../SubscriptionFormModal.vue:520` | 超暗 `panel-box` 背景 `#121418`→`#111`（纯黑），边框 `#333`→`#444` |
| `frontend/.../SubscriptionFormModal.vue:385` | 超暗透明度 `0.3`→`0.5` |

### 回退
- 回退 `reorder-active` CSS 规则、回退 `panel-box` 颜色、回退透明度值

---

## 2026-05-17 — 拖拽高亮残留修复 + 深色/超暗背景加深

### 修复：拖拽停止后旧位残色 + 深色/超暗背景不够明显
**根因**：
1. `onRowDrop` 中 `draggedRowId=null` 后表格不重渲染（`reorderData` 引用不变），`reorderRowProps` 仍返回旧样式
2. HTML5 DnD `click-and-hold` 触发 ant-table `:active` 状态残留
3. 深色模式 `rgba(24,144,255,0.25)` 对比度不足

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:486-491` | `onRowDrop` 追加 `reorderData.value = [...reorderData.value]` 强制响应式更新 + `document.activeElement?.blur()` 清除 `:active`/`:focus` 状态 |
| `frontend/.../InboundList.vue:432` | 深色背景 `0.25`→`0.45` |
| `frontend/.../SubscriptionFormModal.vue:56-57` | `onDragEnd`/`onDrop` 追加 `selectedInbounds.value = [...selectedInbounds.value]` + `blur()` |
| `frontend/.../SubscriptionFormModal.vue:385` | 超暗 `0.15`→`0.3`，暗色 `0.25`→`0.45` |

### 回退
- 回退 `onRowDrop`/`onDragEnd`/`onDrop` 中的 spread + blur 逻辑；回退背景透明度值

---

## 2026-05-17 — 拖拽高亮：outline 空字符串→none + 深色/超暗适配

### 修复：outline 残留（实线框）+ 深色模式字色
**根因**：
1. `outline: isDragged ? '2px dashed #1890ff' : ''` — 空字符串不删除 CSS outline，浏览器保留旧值，拖拽停止后旧位残留虚线框
2. `background: '#d6e9ff'` 在深色模式下背景过亮，文字/图标仍为浅色看不清

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:430-443` | `outline: ''`→`outline: 'none'`，`outlineOffset: '0'`；`background` 根据 `props.isDarkTheme` 使用 `rgba(24,144,255,0.25)`（深色）或 `#d6e9ff`（浅色） |
| `frontend/.../SubscriptionFormModal.vue:71-73` | 新增 `isDragDark` computed（0=浅色/1=暗色/2=超暗） |
| `frontend/.../SubscriptionFormModal.vue:383-388` | `outline: ''`→`outline: 'none'`；`background` 根据 `isDragDark` 使用 `rgba(24,144,255,0.15/0.25)` 或 `#d6e9ff` |

### 回退
- 回退 `reorderRowProps` 中的 `outline`/`outlineOffset`/`background` 逻辑到旧版

---

## 2026-05-17 — 方向锁定修复（每次 splice 都更新方向）

### 修复：`if (dragDirection === 0)` 方向锁定
**根因**：`dragDirection` 仅在首次 splice 时赋值。用户先向下拖拽后改为向上，方向仍为 `1`（向下），指示线继续显示在物品下方而非上方，反之亦然。

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:466-471` | 移除 `if (dragDirection === 0)` 守卫，每次 splice 都重新计算方向 |
| `frontend/.../SubscriptionFormModal.vue:80-85` | 同上，移除 `if (subDragDir === 0)` |

### 回退
- 恢复两处 `if (dragDirection === 0)` / `if (subDragDir === 0)` 守卫

---

## 2026-05-17 — 删除指示线 CSS transition（消除时间差偏移）

### 修复：指示线 CSS transition 导致位移感知错觉
**根因**：`transition: top 0.08s/0.06s ease` 使指示线以动画方式滑到新位置（80ms），而物品通过 `splice` 即时跳转。用户看到物品已到位但指示线还在半路，感觉"指示线比物品下落幅度更大"。

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:794` | 删除 `transition:top 0.08s ease` |
| `frontend/.../SubscriptionFormModal.vue:397` | 删除 `transition:top 0.06s ease` |

### 回退
- 恢复两个文件的 `transition:top` 属性

---

## 2026-05-17 — 方向感知拖拽指示线（首次+后续追踪）

### 修复：指示线方向感知（InboundList + SubscriptionFormModal）
**背景**：拖拽指示线在首次移动时位置错误，后续移动时线不跟随方向贴行。

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:461-483` | `updateIndicator` 重写：`dragDirection` 状态机（0→±1），首次 splice 用 `prevDraggedIdx` 定侧，后续用 `newIdx` 定侧 |
| `frontend/.../SubscriptionFormModal.vue:73-96` | `onInboundDragOver` 重写：`subDragDir` 状态机，逻辑同上 |

### 回退
- 回退 `updateIndicator` 和 `onInboundDragOver` 到上一版

---

## 2026-05-17 — 拖拽指示线统一 + 入站列表 Math.floor→Math.round

### 修复：指示线行内显示 + 初始位置怪异
**背景**：入站列表排序和订阅入站选择器的拖拽指示线会出现在行内部、从非表格位置闪现进入。

| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:455-465` | `updateIndicator` 改为 `Math.round(relY / ROW_H)` + `Math.max(0, Math.min(gapIdx, reorderData.length)) * ROW_H` |
| `frontend/.../SubscriptionFormModal.vue:69-83` | 已使用 `Math.round`，确认逻辑正确 |

### 回退
- 回退 `InboundList.vue` 的 `updateIndicator` 到 `Math.floor` 版本

---

## 2026-05-17 — 链接生成规则统一 + UI 修复

### 新增：resolveAddress / resolvePort 公共方法
**背景**：后端订阅链接（text/base64/JSON/Clash）生成的地址/端口与前端"导出入站链接"不一致。配置了 externalAddr/externalPort 的入站，订阅链接地址错误。

| 文件 | 改动 |
|------|------|
| `sub/subService.go:590-609` | **新建** `resolveAddress()`（externalAddr→node→Listen→host）+ `resolvePort()`（externalPort→inbound.Port）|
| `sub/subService.go:230-560` | 5 个协议生成器（vmess/vless/trojan/shadowsocks/hysteria）统一替换 `resolveInboundAddress`+`inbound.Port` 为 `resolveAddress`+`resolvePort` |
| `sub/subService.go:390-400` | Shadowsocks method 加 `ok` 守卫；password 从 `clients[clientIndex].Password` 读取 + settings 顶层覆盖 |

### 修复：tryAggregateSub 客户端遍历
| 文件 | 改动 |
|------|------|
| `sub/subController.go:461-500` | `recover()` 从入站级别改为客户端级别；添加 `enabledCount` 统计入站数 |

### 修复：订阅入站数同步
| 文件 | 改动 |
|------|------|
| `frontend/.../SubscriptionPage.vue` | +allInbounds ref + loadInbounds() + 每 5 秒刷新 + computed 过滤已启用入站 |

### 修复：入站列表拖拽指示线
| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue` | +isDraggingRows ref；指示线 `v-if="reorderMode && isDraggingRows"`；updateIndicator 基于容器坐标 |

### 修复：订阅入站拖拽指示线方向/位置
| 文件 | 改动 |
|------|------|
| `frontend/.../SubscriptionFormModal.vue` | 用 `Math.round(relY / ROW_H)` 统一计算插入位置，不再区分上下方向 |

### 回退
- 回退 `resolveAddress`/`resolvePort`：删除 `sub/subService.go:590-609`，恢复 `resolveInboundAddress` 原逻辑，5 个协议生成器改回 `resolveInboundAddress`+`inbound.Port`
- 回退入站数同步：从 `SubscriptionPage.vue` 删除 `loadInbounds`/`setInterval`/`enabledIds` 过滤
- 回退指示线：恢复原始指示线逻辑

---

## 2026-05-16 — 聚合订阅系统（10 个子任务）

### 新增功能：聚合订阅（替代旧客户端级 subId）

**背景**：旧版订阅每个客户端自动生成 subId，一个链接只返回单个客户端。需要一个链接聚合多个入站的多个客户端。

**方案**：新建 `subscriptions` 表 + 完整 CRUD + 聚合端点。旧 subId 仍然保留，新系统 `/sub/{subId}` 先查 subscriptions 表再回退旧版。

### 子任务 1：Subscription 数据模型 + 迁移
| 文件 | 改动 |
|------|------|
| `database/model/model.go:163-184` | **新建** Subscription struct（含 InboundIds/Format/Password/ExpiryTime/SyncWithInboundOrder/AutoIncludeAllEnabled/LastUsedAt 等） |
| `database/db.go:90` | +AutoMigrate Subscription |

### 子任务 2：Subscription 后端 Service + Controller
| 文件 | 改动 |
|------|------|
| `web/service/subscription.go` | **新建** — GetAll/GetById/GetBySubId/GetByInboundId/Create/Update/SetEnable/Delete/UpdateLastUsedAt/RemoveInboundId |
| `web/controller/subscription.go` | **新建** — list/get/add/update/del/setEnable 6 端点 |
| `web/controller/api.go:88-91` | +路由组 `/panel/api/subscription` + `subscriptionController` 字段 |

### 子任务 3：入站关联订阅（删除/启用检查）
| 文件 | 改动 |
|------|------|
| `web/controller/inbound.go:127-137` | 新增 `checkInboundSubscriptions` 端点（GET） |
| `web/controller/inbound.go:139-172` | 修改 `delInbound`：有关联订阅时返回警告列表，不移除 |
| `web/controller/inbound.go:174-190` | 新增 `forceDelInbound` 端点：强制删除 + 清理订阅引用 |
| `web/controller/inbound.go:192-210` | 新增 `parseCsvInboundIds` |
| `web/controller/inbound.go:80-85` | 新增 `subscriptionService` 包级别变量 + 修改 `setInboundEnable` 返回订阅引用 |

### 子任务 4：聚合订阅端点（sub server）
| 文件 | 改动 |
|------|------|
| `sub/subController.go:108-127` | `subs()`：先查聚合订阅；浏览器（Accept:text/html）→ 静态 HTML 页面（含复制按钮、深色模式）；curl → 纯内容 |
| `sub/subController.go:331-389` | **重写** `tryAggregateSub`：返回 `tryAggregateSubResult`（Content/Format/InboundCount/Remark/SubId）。按 `sub.Format` 输出（text/base64/json/clash）。支持 `autoIncludeAllEnabled`（取全部已启用）/ `syncWithInboundOrder`（按 sort_order 重排）。`recover()` 防 panic。更新 LastUsedAt |
| `sub/subController.go:17` | +`"html"`、`"github.com/mhsanaei/3x-ui/v3/logger"` 导入 |
| `sub/sub.go:237` | +设置 `subscriptionService` |

### 子任务 5：前端订阅列表页
| 文件 | 改动 |
|------|------|
| `frontend/subscription.html` | **新建** — 页面 HTML |
| `frontend/vite.config.js` | +`panel/subscription` 路由 + `subscription` rollup entry |
| `frontend/src/entries/subscription.js` | **新建** — 入口（i18n + Antd + mount）|
| `frontend/src/pages/subscription/SubscriptionPage.vue` | **新建** — 统计卡片 + 表格列表 + 复制/编辑/删除操作 + 过期自动禁用（`watch(subscriptions, { deep: true })`）+ 受 `subEnable` 控制 + 日期跟随 locale 和时区 |
| `frontend/src/pages/subscription/useSubscription.js` | **新建** — fetchAll/create/update/remove/setEnable |
| `frontend/src/pages/subscription/SubscriptionFormModal.vue` | **新建** — 3 选项卡（常规/选择入站/信息）+ 入站选择器 + 拖拽排序 + 双开关 + 拖拽指示线 + 深色/超暗模式 |
| `frontend/src/components/AppSidebar.vue` | +`link` 图标 + `subscription` 菜单项（在 nodes 和 settings 之间）|
| `frontend/src/utils/cron-parser.js` | **新建** — `cronToNatural` + `cronToDescription` |
| `frontend/src/models/setting.js` | +`xrayAutoUpdate`/`xrayUpdateCron`/`subUriScheme`/`subUriAddress`/`subUriPort`/`subUriPath` |
| `web/controller/xui.go:100-103` | +`/subscription` 页面路由 |
| `web/translation/zh-CN.json` | +`"subscription": "订阅"` |
| `web/translation/en-US.json` | +`"subscription": "Subscription"` |

### 子任务 6：入站多选 + 创建订阅联动
| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:87-90` | +`selectedIds` prop + `update:selected-ids` emit |
| `frontend/.../InboundList.vue:800-806` | +`row-selection` 到 `<a-table>` |
| `frontend/.../InboundsPage.vue:125-143` | +selectedInboundIds + subFormOpen + SubscriptionFormModal 导入 |
| `frontend/.../InboundsPage.vue:155-172` | `exportAllSubs` → 弹出创建订阅模态框（预填选中入站）|
| `frontend/.../InboundsPage.vue:196-200` | 行操作"导出订阅设置"→ 创建订阅 |
| `frontend/.../InboundsPage.vue:280` | +`<SubscriptionFormModal>` 模板 |

### 子任务 7：入站排序模式增强
| 文件 | 改动 |
|------|------|
| `frontend/.../InboundList.vue:483-566` | **新增** `reorderColumns`/`reorderRowProps`/`moveRow`/`indicatorTop`/`updateIndicator`/`onRowDragOver`（含指示线 + 实时 splice + 迟滞滚动）/`onRowDrop`（重置指示线） |
| `frontend/.../InboundList.vue:789-830` | **重写** reorder 模板：`<div>` 包裹 `<a-table>` + 拖拽指示线（蓝色 2px + transition:top 0.08s）+ ↑↓ 按钮 |
| `frontend/.../InboundList.vue:792` | `confirmReorder` +`message.success(t(...))` + `await nextTick()` |
| `frontend/.../InboundList.vue:2` | +`nextTick`、`message` import |
| `frontend/.../InboundList.vue:1207-1208` | +暗色模式 reorder row 样式 |
| 删除 old:413-471 | 删除重复的 `onRowDragOver`/`onRowDrop`/`onCardDrag*` 函数 |
| `web/controller/inbound.go:167` | `delInbound` reorder 响应 msg 改为空串（避免 HttpUtil 自动弹"Reorder successful"）|

### 子任务 8：远程节点设置同步 + 节点选项卡
| 文件 | 改动 |
|------|------|
| `web/service/node.go:125-186` | +`buildNodeRequest`/`FetchRemoteSettings`/`PushRemoteSettings` |
| `web/controller/node.go:120-145` | +`fetchSettings`/`pushSettings` 端点 |
| `frontend/.../NodeFormModal.vue` | **重写**为四选项卡（节点信息/面板设置/Xray设置/Telegram机器人配置）。添加模式仅显示第一选项卡。编辑模式从远程节点拉取设置 + 保存时推回 |

### 子任务 9：Xray 更新设置
| 文件 | 改动 |
|------|------|
| `web/entity/entity.go:90-91` | +`XrayAutoUpdate bool`、`XrayUpdateCron string` |
| `web/service/setting.go:83-84` | defaultValueMap + `"xrayAutoUpdate": "true"`、`"xrayUpdateCron": "0 30 2 * * *"` |
| `web/job/xray_update_job.go` | **新建** — 定时检查版本、自动更新 |
| `web/web.go:330-337` | +注册 XrayUpdateJob |
| `web/service/server.go:86-97` | `GetCurrentXrayVersion()`、`UpdateXray` 版本比对 |

### 子任务 10：面板设置改版
| 文件 | 改动 |
|------|------|
| `frontend/.../GeneralTab.vue:18-110` | **重写**时区输入框 → 可搜索下拉框 + UTC 偏移排序 + 格式 `Asia/Shanghai (UTC+8)` + 默认从浏览器获取 |
| `frontend/.../SettingsPage.vue:115-125` | 安全警告标题/各条改用 `t('pages.settings.security.xxx')` |
| `frontend/.../SubscriptionGeneralTab.vue` | **重写** — 删除 JSON/Clash 开关；subURI 改为分段配置（协议/地址/端口/路径）；subEnable 开关 control slot 内显示订阅链接提示；链接使用 subPort |
| `frontend/.../SubscriptionFormatsTab.vue` | 删除 Clash path/URI 设置项 |
| `frontend/.../SettingsPage.vue:126-155` | +恢复 Formats 选项卡（删除前误删的导入/tabSlugs/模板）|
| `web/entity/entity.go:78-81` | +`SubUriScheme`/`SubUriAddress`/`SubUriPort`/`SubUriPath` |
| `frontend/.../setting.js:85-88` | +subUriScheme/Address/Port/Path 默认值 |
| `web/translation/zh-CN.json` | +安全警告翻译 + gregorian/jalalian/reorderSuccess；措辞"广为人知"→"过于常见" |
| `web/translation/en-US.json` | +安全警告/gregorian/jalalian/reorderSuccess 翻译 |
| `frontend/.../SubscriptionGeneralTab.vue` | 编码开关描述改为"订阅服务返回的内容默认将采用 Base64 编码" |

### 回退
#### 聚合订阅整体回退
1. 从 `model.go` 删除 Subscription struct
2. 从 `db.go` 去掉 Subscription AutoMigrate
3. 删除 `web/service/subscription.go`
4. 删除 `web/controller/subscription.go`
5. 回退 `web/controller/api.go` 去掉路由注册
6. 回退 `sub/subController.go` 恢复旧版 subs()，删除 tryAggregateSub
7. 回退 `sub/sub.go` 去掉 subscriptionService 设置
8. 删除 `frontend/subscription.html` + `src/entries/subscription.js` + `src/pages/subscription/`
9. 回退 `AppSidebar.vue` 删除菜单项、`vite.config.js` 删除入口/路由、`xui.go` 删除路由
10. 回退 `InboundList.vue` 删除 reorderColumns/indicator/移动行，恢复原 a-table
11. 回退 `InboundsPage.vue` 删除 SubscriptionFormModal 相关
12. 回退 `inbound.go` 删除 checkSubscriptions/forceDel

#### 节点选项卡回退
- 回退 `node.go` 删除 FetchRemoteSettings/PushRemoteSettings
- 回退 `nodeController.go` 删除 fetchSettings/pushSettings 端点
- 回退 `NodeFormModal.vue` 恢复单表单

#### Xray 更新回退
- 删除 `xray_update_job.go`，回退 `entity.go`/`setting.go`/`web.go`/`server.go`

#### 面板设置回退
- 回退 `GeneralTab.vue` 时区改回 `<a-input>`
- 回退 `SubscriptionGeneralTab.vue` 恢复旧布局
- 删除 `entity.go` 的 subUri* 字段
- 回退 `setting.js` 删除默认值
- 回退 `SettingsPage.vue` 删除 Formats 选项卡恢复

## 2026-05-16 — 前端序号列 + 手动排序 + 6 级 Protocol 排序

### 改动

| 功能 | 说明 |
|------|------|
| **序号列** | 桌面 `#` 列、移动端卡片标题改用 `index+1`，不再显示数据库 ID |
| **手动排序** | 工具栏「排序」→ 拖拽卡片重排 → 确认/取消。后端新增 `sort_order` 字段、`POST /panel/api/inbounds/reorder` 接口 |
| **Protocol 6 级排序** | 点击 Protocol 列头：协议类型 > 传输方式 > 安全层 > ECH PQ > MLDSA65 > ECH 密钥 |

### 文件

| 文件 | 说明 |
|------|------|
| `database/model/model.go` | 新增 `SortOrder int` |
| `web/service/inbound.go` | `GetInbounds` 加 `ORDER BY sort_order`；新增 `ReorderInbounds` |
| `web/controller/inbound.go` | 新增 `POST /panel/api/inbounds/reorder` |
| `frontend/.../InboundList.vue` | 桌面 # 列、排序按钮、拖拽逻辑、6 级 protocol 排序 |
| `web/translation/*.json` | 新增 `sort`/`confirmSort`/`cancelSort` |
| `frontend/.../axios-init.js` | 拦截器加 JSON Content-Type 判断 |
| `frontend/.../InboundList.vue` | `@change` 改回直接函数引用 |

### 回退
- 删 `sort_order` 字段、删 Reorder API 路由、删前端排序相关代码

---

## 2026-05-16 — Panel Settings 默认值调整

| 设置 | 改前 | 改后 | 文件 |
|------|------|------|------|
| `traffic_reset` | `never` | `monthly` | `model.go` 默认值 + `InboundFormModal.vue` `freshDbForm` |
| `subEmailInRemark` | `true` | `false` | `setting.go` 种子数据 |

---

## 2026-05-16 — 导出所有链接增加 Include Email 开关

`exportAllLinks` 弹出独立模态框（非 TextModal），顶部显示 Include Email 开关（默认跟随面板设置），切换后实时重新生成链接。

### 文件
- `frontend/.../InboundsPage.vue` — 新增 `showExportModal`/`exportIncludeEmail`/`rebuildExportContent` + 模板
- `frontend/.../useInbounds.js` — `subSettings` 新增 `subEmailInRemark`
- `web/translation/*.json` — 新增 `exportAllLinks`/`includeEmail`

### 回退
- 删 InboundsPage.vue 中 export 相关逻辑、模板中的 `a-modal`
- 删 useInbounds.js 中 `subEmailInRemark`

---

## 2026-05-16 — 对外地址 & 对外端口

### 功能
编辑入站表单新增"对外地址"和"对外端口"，覆盖导出链接中的地址和端口。

### 规则
- **对外地址**：面板监听域名非空时显示下拉框（面板域名/自定义/空），空时显示输入框
- **TLS 开关**：Trojan/Hysteria 强制开不可关；VMess/VLESS/HTTP/Mixed 可选；Shadowsocks/Tunnel/WireGuard 隐藏
- **对外端口**：仅可反向代理的协议显示；留空=原端口；列表 Port 列有值时显示 `port (对外端口)`

### 文件

| 文件 | 说明 |
|------|------|
| `database/model/model.go` | 新增 `ExternalAddr`/`ExternalAddrTls`/`ExternalPort` |
| `frontend/.../dbinbound.js` | 构造函数默认值；`cloneProps` 后 `0→null` |
| `frontend/.../inbound.js` | 构造函数 + `_resolveAddr` + `genAllLinks` 使用外部地址/端口 |
| `frontend/.../InboundFormModal.vue` | 对外地址/端口 UI + `fetchWebDomain` + watcher |
| `web/service/inbound.go` | `UpdateInbound` 复制 external 字段 |
| `frontend/.../InboundList.vue` | Port 列渲染外部端口 |

### 修复的 Bug
- `UpdateInbound` 未复制 external 字段（已补上）
- Vue watcher 异步导致保存时值未同步（改为 `flush: 'sync'`）
- `watch(props.open)` 重置了 `loadFromDbInbound` 已设好的值（已移入 else）

### 回退
- 删 3 个 DB 字段、删前端表单 UI、恢复 `_resolveAddr`/`genAllLinks` 原逻辑

---

## 2026-05-15 — 修复远程节点 Tag 冲突（见上）

### Problem
远程节点与本地节点同端口入站 tag 冲突 → `UNIQUE constraint failed: inbounds.tag`

### Solution
tag 约束改为 `(tag, node_id)` 复合唯一索引

### Files Modified
| File | Change |
|------|--------|
| `database/model/model.go:64-66` | Tag: `unique` → `uniqueIndex:idx_tag_node`; NodeID: 加入同一索引 |
| `database/db.go:191-198` | 新增 `migrateInboundIndexes()` 删除旧索引 |
| `web/service/inbound.go:1572-1738` | `tagToCentral` → `centralKeys`（复合键） |
| `web/service/port_conflict.go:268-278` | `tagExists` 加 `AND node_id IS NULL` |

### Rollback
Revert 4 个文件的改动，删除 `migrateInboundIndexes()`，恢复 `tagToCentral` 映射。
