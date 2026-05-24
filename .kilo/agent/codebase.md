---
description: 3X-UI 代码库参考代理
mode: all
---
# 3X-UI 代码库参考（AI 助手用）

## 目录结构

```
3x-ui/
├── main.go                    # 入口，命令行参数，子命令
├── config/config.go           # 路径、版本、常量
├── database/
│   ├── db.go                  # InitDB、AutoMigrate、种子数据、索引迁移
│   └── model/
│       ├── model.go           # Inbound、Node、User、Setting、ApiToken、Subscription 等
│       └── model_test.go      # 模型测试
├── logger/                    # 结构化日志
├── util/                      # 工具函数（json、crypto、common、netsafe）
├── sub/                       # 订阅链接服务（新旧两套共存在 subController）
│   ├── sub.go                 # Server 结构体，initRouter 注册路由 + 设置 subscriptionService
│   ├── subController.go       # subs() 处理器：先查聚合订阅，再回退旧客户端 subId
│   ├── subService.go          # 客户端级 subId 查找 + 链接生成
│   ├── subJsonService.go      # JSON 格式订阅
│   └── subClashService.go     # Clash 格式订阅
├── xray/
│   ├── config.go              # Xray Config 结构体
│   ├── inbound.go             # InboundConfig 结构体
│   ├── process.go             # 启动/停止 xray 进程
│   ├── api.go                 # gRPC 客户端
│   ├── traffic.go             # Traffic/ClientTraffic
│   └── client_traffic.go      # ClientTraffic 结构体
├── web/
│   ├── web.go                 # Server 结构体、cron 调度
│   ├── controller/
│   │   ├── api.go             # APIController、Bearer 认证、路由组挂载（含 subscription）
│   │   ├── inbound.go         # 入站 CRUD + checkSubscriptions/forceDel 端点
│   │   ├── server.go          # 服务器状态/控制
│   │   ├── node.go            # 节点 CRUD + fetchSettings/pushSettings
│   │   ├── subscription.go    # **新建** 订阅 CRUD 6 个端点
│   │   ├── setting.go         # 设置 + API 令牌
│   │   └── xui.go             # SPA 页面路由（含 /subscription）
│   ├── service/
│   │   ├── inbound.go         # InboundService
│   │   ├── xray.go            # XrayService
│   │   ├── node.go            # NodeService + FetchRemoteSettings/PushRemoteSettings
│   │   ├── subscription.go    # **新建** SubscriptionService CRUD + GetByInboundId + UpdateLastUsedAt + RemoveInboundId
│   │   ├── setting.go         # 设置键值 + xrayAutoUpdate/xrayUpdateCron getter/setter
│   │   └── ...                # tg bot、geo、ldap 等
│   ├── runtime/               # 运行时抽象
│   ├── job/
│   │   ├── xray_update_job.go # **新建** 定时检查并更新 Xray
│   │   ├── node_traffic_sync_job.go
│   │   ├── node_heartbeat_job.go
│   │   └── ...
│   ├── middleware/security.go
│   ├── session/
│   ├── websocket/
│   └── entity/entity.go       # AllSetting 结构体（含 xrayAutoUpdate/xrayUpdateCron/subUriScheme 等）
├── frontend/src/
│   ├── pages/
│   │   ├── inbounds/          # 入站列表 + row-selection 多选 + 排序模式（div 指示线 + ↑↓按钮）
│   │   ├── settings/          # 设置页（含 SubscriptionGeneralTab / SubscriptionFormatsTab）
│   │   ├── nodes/             # 节点页（NodeFormModal 四选项卡）
│   │   ├── xray/              # Xray 配置页（含"更新"面板 + cron 自然语言描述）
│   │   ├── subscription/      # **新建** 订阅管理模块
│   │   │   ├── SubscriptionPage.vue      # 订阅列表 + 过期自动禁用
│   │   │   ├── SubscriptionFormModal.vue # 创建/编辑订阅（3 选项卡 + 入站选择器 + 双开关）
│   │   │   └── useSubscription.js       # CRUD composable
│   │   └── ...
│   ├── utils/
│   │   ├── cron-parser.js     # **新建** Cron 自然语言描述函数
│   │   └── ...
│   ├── entries/subscription.js # **新建** 订阅模块入口
│   └── models/setting.js       # AllSetting 类（含 xrayAutoUpdate/subUriScheme 等）
```

## 核心数据模型（database/model/model.go）

### Inbound
```go
type Inbound struct {
    Id                   int
    UserId               int
    Up/Down/Total/AllTime int64
    Remark, Enable, ExpiryTime
    TrafficReset, LastTrafficResetTime
    ClientStats          []xray.ClientTraffic  // has-many
    SortOrder            int    // 排序序号（默认 999999999）
    Listen, Port, Protocol
    Settings, StreamSettings, Sniffing
    Tag                  string   `gorm:"uniqueIndex:idx_tag_node;not null"`
    NodeID               *int     `gorm:"uniqueIndex:idx_tag_node;index"`
}
```

### Subscription（**新增**）
```go
type Subscription struct {
    Id                    int
    SubId                 string  // 随机 16 位 base62
    Enable                bool
    Format                string  // text | base64 | json | clash
    Password              string
    InboundIds            string  // 逗号分隔的入站 ID，顺序即输出顺序
    ExpiryTime            int64   // 0 = 永不过期
    ShowInfo              bool
    EmailInRemark         bool
    Title, SupportUrl, ProfileUrl, Announce string
    UpdateInterval        int     // 小时
    Remark                string
    SyncWithInboundOrder  bool    // 始终按入站列表排序
    AutoIncludeAllEnabled bool    // 始终包含所有启用入站
    LastUsedAt            int64
    CreatedAt, UpdatedAt  int64
}
```

### Node（**新增字段**）
```go
type Node struct {
    Id, Name, Remark, Scheme, Address, Port, BasePath
    ApiToken, Enable, AllowPrivateAddress
    Status, LastHeartbeat, LatencyMs
    XrayVersion, CpuPct, MemPct, UptimeSecs, LastError
    // 无额外订阅设置字段——订阅设置通过 API 实时拉取/推送
}
```

## Subscription 完整数据流

### 聚合订阅流程
```
创建订阅 → POST /panel/api/subscription/add
  → SubscriptionService.Create() → 生成 16 位 subId → 写入 subscriptions 表
  → 返回 subId 用于构造订阅 URL: {subURI}{subId}?pwd={password}

订阅请求 → GET /sub/{subId}[?pwd=xxx]
  → subController.subs()
    1. tryAggregateSub() → 查 subscriptions 表
      → 校验: subEnable / Enable / ExpiryTime / Password
      → 解析 InboundIds → 可选 autoIncludeAllEnabled（取全部已启用）
      → 可选 syncWithInboundOrder（按 sort_order 重排）
      → 遍历入站 → GetClients → GetLink 生成全部客户端链接（含 recover 防 panic）
      → 按 sub.Format 格式化输出（text/base64/json/clash）
      → 更新 LastUsedAt
    2. 浏览器访问（Accept: text/html）→ 返回精美静态 HTML 页
    3. curl 访问 → 返回纯内容
    4. 未找到 → 回退旧客户端 subId 逻辑

删除入站 → POST /panel/api/inbounds/del/{id}
  → 如果被订阅引用 → 返回关联订阅列表
  → forceDel → 自动从订阅中移除该 ID / 删除仅含此入站的订阅
```

### 聚合订阅端点（subController.go）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/sub/{subId}` | GET | 聚合订阅（先查）+ 旧版客户端（回退）|
| `/sub/{subId}?pwd=xxx` | GET | 带密码验证 |
| `/panel/api/subscription/list` | GET | 订阅列表 |
| `/panel/api/subscription/get/:id` | GET | 单个订阅 |
| `/panel/api/subscription/add` | POST | 创建订阅 |
| `/panel/api/subscription/update/:id` | POST | 更新订阅 |
| `/panel/api/subscription/del/:id` | POST | 删除订阅 |
| `/panel/api/subscription/setEnable/:id` | POST | 开关订阅 |

### ⚠️ SubscriptionFormModal v-if 陷阱（2026-05-20 已修复）
`InboundsPage.vue` 中 `SubscriptionFormModal` 曾使用 `v-if="subFormOpen"`，导致组件挂载时 `props.open` 已是 `true`，Vue 3 的 `watch(() => props.open, ...)` 不视其为变化，`loadInbounds()` 永不执行，选择入站页面为空白。
**修复**：移除 `v-if`，使用 `v-model:open`，与 `SubscriptionPage.vue` 保持一致。

### ⚠️ InboundsPage 必须绑定 selectedIds（2026-05-20 已修复）
`InboundsPage.vue` 必须向 `<InboundList>` 传递 `:selected-ids`、`:selected-client-ids`、`@update:selected-ids`、`@update:selected-client-ids` 四个绑定，否则多选框无法选中。同时需要声明 `selectedIds` ref 和 `selectedClientIds` ref 用于 `exportAllSubs()` 的预选构建。

### ⚠️ applyClientStatsEvent 不能覆盖 enable（2026-05-20 已修复）
`useInbounds.js` 的 `applyClientStatsEvent` 中 `if (typeof upd.enable === 'boolean') ib.enable = upd.enable` 会导致启用开关 WebSocket 竞态——批量冲掉其他入站的 enable 状态。流量广播只应更新 up/down/total 字段。

### ⚠️ enable 开关必须 emit toggle-enable 触发 shallowRef 渲染（2026-05-20 已修复）
`onSwitchEnable` 中 `dbInbound.enable = next` 对 `shallowRef` 不触发渲染。必须 emit `toggle-enable` 让父组件执行 `dbInbounds.value = [...dbInbounds.value]`。

### ⚠️ ClientRowTable 第二个 watch 已被删除（2026-05-20 已修复）
`ClientRowTable.vue` 的 `watch(() => props.selectedClientIds, ...)` 中 `localSelected.size === 0` 无法区分"用户主动清空"和"未初始化"，导致取消勾选第一个客户端后被自动重选。该 watch 已删除，`watch(clients, { immediate: true })` 已足以处理初始化。

### ⚠️ ClientRowTable 必须加动态 :key 以便重选客户端（2026-05-20 已修复）
`InboundList.vue` 使用 `expandCounter` reactive 对象，每次展开行时递增计数。两个 `<ClientRowTable :key="'crt-' + record.id + '-' + expandCounter[id]">` 确保收起后重新展开时组件重建，`watch(clients, {immediate:true})` 重新 INIT 选中第一个客户端。

### ⚠️ onClientSelectionChange 必须同步清理 selectedIds（2026-05-20 已修复）
`InboundsPage.vue` 的 `onClientSelectionChange` 中当 `ids.length === 0` 时必须从 `selectedIds` 中移除该入站，否则取消所有客户端后入站多选框仍然保持选中。该修复已应用。

### 入站关联订阅端点（inboundController.go）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/panel/api/inbounds/checkSubscriptions/:id` | GET | 返回引用此入站的订阅列表 |
| `/panel/api/inbounds/forceDel/:id` | POST | 强制删除入站（同时清理订阅引用）|

### 远程节点设置同步端点（nodeController.go）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/panel/api/nodes/fetchSettings/:id` | POST | 从远程节点拉取面板设置 |
| `/panel/api/nodes/pushSettings/:id` | POST | 推送设置到远程节点 |

## 入站排序模式（InboundList.vue）

### 桌面端 reorder 模式
1. **启用排序**：点击"排序"按钮 → `reorderMode=true` → 显示 div 覆盖层
2. **拖拽行**：HTML5 DnD + `onRowDragOver` 实时 splice 重排（无 lastTargetId 防抖）
3. **拖拽指示线**：蓝色 2px 虚线外框（行高亮方案，位于 `<tr>` 级别）+ `outline: 2px dashed #1890ff`
4. **↑↓ 按钮**：每行右侧 ↑/↓ 按钮进行相邻交换
5. **行拖拽**：Pointer Events（`pointerdown`/`pointermove`/`pointerup`），滚轮/触摸自然生效。5px 阈值区分点击和拖拽，`touchAction:none` + `userSelect:none` 阻止浏览器默认行为。HTML5 DnD 代码注释保留，可随时切换回。
   - **触发区**：`idleTrigger = min(600, max(80, h × 0.3))`，高大表格可达 600px
   - 每次 `onRowDragOver` 独立判定：`topDist < idleTrigger` → 上滚，`botDist < idleTrigger` → 下滚，否则停止
   - 无 `release`、无方向锁定、无迟滞——鼠标离开触发区即停，跨中线即切换方向
   - **动态容器查找**：`findScrollContainer()` 按优先级查找可滚动容器——① `.ant-table-body`（scroll.y 表）、② `#content-layout`（页面级）、③ `document.scrollingElement`（兜底）。缓存在 `scrollContainerEl` 中
   - **容器级 @dragover**：提取 `updateScroll(e)` 供行级和容器级共用。`onRowDragStart` 时通过 `addEventListener` 在 `findScrollContainer()` 返回的元素上附加 `@dragover`，`onRowDrop` 时 `removeEventListener`
   - `requestAnimationFrame` 驱动，**逐像素平滑**（`scrollTop += dir × pxPerMs × delta`）
   - **速度公式**——指数衰减 `delay = 300 + 2000 × (1-t)⁴`，`pxPerMs = ROW_H / delay`，其中 `t = scrollDist / idleTrigger`
     - 贴边（t=0, scrollDist=0）：**2300ms → 19 px/s** ⏳ 慢速可控
     - 区内 50%（t=0.5）：**425ms → 104 px/s**
     - 触发边界（t=1, scrollDist=idleTrigger）：**300ms → 147 px/s** 🔥 快速跨行
   - 指数衰减使慢速区覆盖触发区前半段（t<0.5 都是慢速），而旧立方曲线在 t<0.5 时是快速区，体验颠倒。
   - 每帧移动 < 2px，完全无跳变；鼠标微调即可在快慢之间无缝切换
6. **Hover 抑制**：`dragstart` 时 JS 动态注入 `<style>` 覆盖 `.ant-table-row td` 的 `:hover` 背景，`drop` 时移除
7. **拖拽后清理**：`blur()` + `removeAllRanges()` + `mouseleave` dispatch 清除 `:active`/`:focus`/`:hover` 残留
8. **确认**：`POST /panel/api/inbounds/reorder` → 设置 `sort_order`
9. **取消**：从 `snapshotBeforeReorder` 快照恢复

## 订阅编辑双开关行为

**⚠️ 后端注意**：`web/service/subscription.go:Update()` 的 `updates` map **必须**包含 `sync_with_inbound_order` 和 `auto_include_all_enabled` 两个字段，否则编辑订阅时开关值不会被保存。

**⚠️ 前端注意**：`watch(allInbounds)` 的 deep watcher 中 `sortByInboundOrder()` 和 `syncInboundsWithAutoInclude()` 是两个独立逻辑，不应嵌套在同一个 `if` 块中。

**⚠️ 两个开关必须完全独立**：

| 开关 | 负责 | 不负责 |
|------|------|--------|
| `autoIncludeAllEnabled` | 确保所有启用入站被选中、所有禁用入站被移除 | **绝不排序**、绝不改变现有顺序 |
| `syncWithInboundOrder` | 将当前选中列表按入站列表顺序排序 | **绝不增删入站** |

`syncInboundsWithAutoInclude()` 应先 filter 移除已禁用项（保留顺序），再遍历 `allInbounds` 追加真正缺失的项。`onSave` 中 `autoIncludeAllEnabled` 分支应调用 `syncInboundsWithAutoInclude()` 而非 `allInbounds.value.filter(...)` 替换整个列表。

两个开关可同时开启：

| 开关 | 打开时行为 |
|------|-----------|
| **始终包含所有启用入站** | 自动添加所有已启用入站、移除已禁用入站；✕ 按钮隐藏；拖拽和 ↑↓ 保留 |
| **始终按入站列表排序** | 立即按入站列表排序；拖拽手柄和 ↑↓ 按钮隐藏；蓝色序号圆圈保留；新建入站时自动排序 |

**共存时**：两个都打开 → 拖拽手柄/↑↓/✕ 按钮均隐藏。autoIncludeAllEnabled 决定"谁在列表"，syncWithInboundOrder 决定"顺序"。

**后端生成时**：`tryAggregateSub` 中先处理 autoIncludeAllEnabled（取全部已启用），再处理 syncWithInboundOrder（按 sort_order 重排 ID 数组）。

## Xray Config - 更新设置

在 BasicsTab.vue 的"常规配置"和"统计"之间新增"更新"面板：
- **保持最新版本**：开关，默认打开
- **定时更新时间**：cron 输入框 + 自然语言描述（`cron-parser.js`）
- 后端 `web/job/xray_update_job.go` 根据 `xrayUpdateCron` 定时检查 GitHub 最新版本并自动更新

## 面板设置变更

### 时区选择器
- 从 `<a-input>` 改为 `<a-select :show-search>` 可搜索下拉框
- 列出所有 IANA 时区，按 UTC 偏移从 -12 到 +14 排序
- 显示格式：`Asia/Shanghai (UTC+8)`
- 默认从浏览器获取实际时区

### 安全警告 i18n
- 所有警告文字使用 `t('pages.settings.security.xxx')`
- zh-CN 翻译：过于常见（不再用"广为人知"）
- 标题："安全警告" / "面板可能存在风险"

### 订阅设置 - 反向代理 URI
- 从单行输入框改为分段配置：协议/地址/端口/路径
- 后端 entity.go 新增 `subUriScheme/Address/Port/Path`
- 前端模型 setting.js 新增对应字段

### 订阅设置 (Formats)
- 删除 Clash path/URI 设置项
- 保留 JSON fragment/noises/mux/rules 设置

## 后端链接生成规则（subService.go）

### 地址/端口解析（`resolveAddress` / `resolvePort`）

```go
// resolveAddress 完整的地址优先级链
func (s *SubService) resolveAddress(inbound *model.Inbound) string {
    stream := unmarshalStreamSettings(inbound.StreamSettings)
    1. externalAddr (StreamSettings 顶层)       // 新增，匹配前端行为
    2. Node.Address (如果 nodeID 非空)
    3. inbound.Listen (非空且非 0.0.0.0)
    4. s.address (请求 host)
}

// resolvePort 端口优先级
func (s *SubService) resolvePort(inbound *model.Inbound) int {
    stream := unmarshalStreamSettings(inbound.StreamSettings)
    1. externalPort (> 0)                       // 新增，匹配前端行为
    2. inbound.Port
}
```

5 个协议生成器统一调用 `s.resolveAddress(inbound)` / `s.resolvePort(inbound)`，与前端 `genAllLinks` 行为一致。

### Shadowsocks method/password 兼容
- `method`：优先 `settings["method"]`（settings 顶层），缺省 `chacha20-ietf-poly1305`
- `password`：默认取 `clients[clientIndex].Password`，`settings["password"]` 有值则覆盖
- 所有类型断言加 `ok` 守卫，不再 panic

### `tryAggregateSub` 客户端遍历（`subController.go`）
- `recover()` 从入站级别改为**客户端级别**，每个 `GetLink`/`GetJsonForClient`/`GetClashForClient` 独立守护
- 入站查询/`GetClients` 无 recover，失败直接 `continue`
- `enabledCount` 统计已启用入站数，用于浏览器页面显示

## 前端拖拽指示线（InboundList.vue + SubscriptionFormModal.vue）

### 入站列表排序拖拽（行高亮方案）
- `draggedRowId` ref：拖拽开始时设为 `record.id`，停止时清空 `null`
- `reorderRowProps` 中根据 `draggedRowId.value === record.id` 设置内联样式：
  - 浅色模式：`background: '#d6e9ff'`，深色模式：`background: 'rgba(24,144,255,0.45)'`
  - `outline: '2px dashed #1890ff'`（非拖拽时 `outline: 'none'` + `outlineOffset: '0'` 显式清除）
- 方向追踪已删除（行高亮方案不依赖方向逻辑）
- `onRowDragOver`：仅执行 `rowReorderById` + 自动滚动，无指示线计算
- **Hover 抑制**：JS 动态注入 `<style>`（`injectDragStyle()` / `removeDragStyle()`），`dragstart` 注入、`drop`/`cancel` 移除，完全绕过 Vue scoped CSS + lightningcss 编译问题

**⚠️ 容器引用陷阱**：`getSubScrollThresholds()` 和 `subScrollTick()` 曾用 `document.querySelector('.inbound-list')`，但模板中有两个 `.inbound-list`（左侧可用、右侧已选），querySelector 返回左侧。修复方案：用模块变量 `subScrollContainer` 保存由 `onDragOver` 通过 `e.currentTarget.closest('.inbound-list')` 获取的正确引用。

**⚠️ 自动滚动架构**：当前为纯位置驱动（无状态机）——`subScrollDir` 不是持久状态，每次 `onDragOver` 根据鼠标位置覆盖。不要试图恢复 `release`/迟滞/方向锁定，这些已被证明会引发回滚和"困住"滚动方向的问题。

### 订阅入站选择器客户端展开规则

`extractInboundClients(ib)` 决定每个入站在选择器中展开为几行：
- **`settings.clients[]`**（vmess/vless/trojan/shadowsocks/hysteria/hysteria2）：展开为每客户端一行（带 `email` 或 `auth:` 标签）
- **`settings.accounts[]`**（mixed/http）：**忽略**，只显示 1 行入站级行
- **`settings.peers[]`**（wireguard）：**忽略**，只显示 1 行入站级行
- **无客户端数组**（tunnel/tun）：显示 1 行入站级行

**设计理由**：mixed/http/wireguard 的后端 `GetLink()` 返回 `""`（不生成订阅链接），展开为每 account/peer 一行对用户是误导性的。2026-05-19 移除 accounts[] 和 peers[] 处理，使它们与 tunnel/tun 行为一致。

### 客户端级别选择（导出/订阅用）

`selectedClientIds` 是一个 `Record<inboundId, number[]>` 对象，跟踪多客户端入站内哪些 `clientId` 被勾选：

- **数据流**：`InboundsPage.selectedClientIds` → `InboundList:selected-client-ids` → `ClientRowTable:selected-client-ids`
- **ClientRowTable** 使用 `localSelected` ref 驱动每行 checkbox，通过 `update:selected-client-ids` emit 变化
- `clientId` 是 `model.Client` 的 `clientId` 整数字段（settings 解析得到），在同一入站内自增不重复
- **默认行为**：当 `selectedClientIds[inboundId]` 为 `undefined`/空数组时，视为"全选"（向后兼容）
- **导出时过滤**：`genInboundLinks()` 接受 `selectedClientIds[]` 参数，只生成匹配 `clientId` 的链接
- **订阅预选支持**：`exportAllSubs()` 的 `__subPreselectIds` 支持 `number`（全入站）和 `"inboundId:clientId"` 混合格式

### Client.toString() — 必须用 false（紧凑 JSON）

`Inbound.ClientBase.toString(format=true)` 默认 `format=true`，生成 pretty-print JSON（含换行和缩进）。
当此字符串嵌入 POST body 的 JSON 字段时（`settings: \`{"clients": [\${client.toString()}]\}`），axios 序列化后内层换行符导致 Go 无法解析，返回 "malformed JSON"。

**规则**：所有涉及 `client.toString()` 嵌入 JSON body 的地方必须传 `false`：
```js
settings: `{"clients": [${client.value.toString(false)}]}`,
```

三处已修复：
- `ClientFormModal.vue:217`
- `ClientBulkModal.vue:165`
- `InboundsPage.vue:412`

### Client.clientId — 始终为 undefined（ClientBase 无该属性）

`Inbound.ClientBase` 构造函数没有 `clientId` 参数，所以 `client.clientId` 始终为 `undefined`。代码中用 `rowKey(client)`（回退链 `email → id → password → JSON.stringify(client)`）作为唯一标识：

- `emitSelection()` → `Array.from(localSelected.value)` 发射 rowKey 值
- `genInboundLinks(filter)` → `client.email || client.id || client.password` 匹配过滤
- `toggleSelect` / `selectAll` / `clearSelection` — 全部使用 `rowKey(client)`
- 模板 `isSelected(client)` → `localSelected.value.has(rowKey(client))`

### ant-design-vue checkbox — 用 @click 替代 @change

`a-checkbox` 的 `@change` 在组件挂载时会为所有 checkbox 触发，无论 `:checked` prop 值如何。必须使用 `@click` 替代 `@change`，因为 `@click` 只在用户实际点击时触发：

```vue
<a-checkbox :checked="isSelected(client)"
  @click="(e) => toggleSelect(client, e.target.checked)" />
```

`Inbound.ClientBase.toString(format=true)` 默认 `format=true`，生成 pretty-print JSON（含换行和缩进）。
当此字符串嵌入 POST body 的 JSON 字段时（`settings: \`{"clients": [\${client.toString()}]\}`），axios 序列化后内层换行符导致 Go 无法解析，返回 "malformed JSON"。

**规则**：所有涉及 `client.toString()` 嵌入 JSON body 的地方必须传 `false`：
```js
settings: `{"clients": [${client.value.toString(false)}]}`,
```

三处已修复：
- `ClientFormModal.vue:217`
- `ClientBulkModal.vue:165`
- `InboundsPage.vue:412`

### 订阅入站选择器拖拽
- `subDraggedIdx` ref + `isDraggingInbounds` ref（拖拽期间 `true`，复位时 `false`）
- `itemStyle(index)` 函数返回内联样式：`subDraggedIdx === index` 时持续蓝色高亮（浅色 `#d6e9ff` / 暗色 `rgba(24,144,255,0.45)` / 超暗 `rgba(24,144,255,0.5)` + 蓝色虚线 `outline`）
- 拖拽期间 CSS `.is-dragging-inbounds .inbound-item.selected:hover,:active,:focus { border: none !important; }` 禁用 hover/active/focus 边框（浅色/暗色/超暗均适用）
- `:active` 残留由 `!important` 强制覆盖 + `onDragStart` 和 `watch(props.open)` 中 `isDraggingInbounds=false` 复位
- **自动滚动** — **纯位置驱动 + 容器级 @dragover + 容器引用 + rAF 逐像素平滑**（与 InboundList 同架构）：
  - **⚠️ 执行顺序**：`onDragOver` **必须先 `subUpdateScroll` 再 `splice`**（与 InboundList 保持一致）
  - 触发区 `idleTrigger = min(200, max(80, h × 0.1))`（10% 容器高度）
  - **容器级 @dragover**：提取 `subUpdateScroll(container, clientY)` 供 item 级和容器级共用。右侧 `.inbound-list` 模板上添加 `@dragover.prevent="onDragOverContainer"`，覆盖 item 间隙和末尾空白区域
  - **容器引用**：⚠️ 模板中有两个 `.inbound-list`（左侧可用 + 右侧已选），`document.querySelector('.inbound-list')` 返回左侧。必须由 `onDragOver` 通过 `e.currentTarget.closest('.inbound-list')` 获取右侧引用并保存在模块变量 `subScrollContainer` 中。`getSubScrollThresholds()` 和 `subScrollTick()` 均使用 `subScrollContainer`，不得重新 querySelector。
  - `requestAnimationFrame` 驱动，**逐像素平滑**（`subScrollContainer.scrollTop += dir × pxPerMs × delta`）
  - **速度公式**：`pxPerMs = SUB_ROW_H / (300 + 2000 × (1-t)⁴)`，指数衰减，与 InboundList 一致
- 拖拽方向：每次 splice 根据 `newIdx > prevDraggedIdx` 重新计算，支持拖拽中自由切换方向

## 订阅模块入站数同步
- `SubscriptionPage.vue` 新增 `allInbounds` ref + `loadInbounds()`
- 每 5 秒自动刷新入站列表（`setInterval`）
- `tableData` computed 中动态过滤已启用的入站 ID 计算 `inboundCount`

## Cron → 自然语言（cron-parser.js）

`cronToDescription(expr, action)`：
- 支持 6 字段（含秒）和 5 字段 cron
- 支持 @every, @daily, @hourly 等预设
- 示例：`0 30 2 * * *` → `每天 2:30 定时更新 Xray`

## 黑暗模式支持

| 级别 | 背景色 | 模态框背景 |
|------|--------|-----------|
| 黑暗（is-dark） | `#1e1e1e` | `colorBgElevated: #2d2d30` |
| 超暗（is-ultra） | `#050505` | `colorBgElevated: #141414` |

订阅模态框通过 `isDarkModal` / `isUltraModal` 检测页面 class，绑定 `.sub-form-dark` / `.sub-form-ultra` class 到 `<a-modal>`。深色模式仅覆写非 ant-design 元素（panel-box, inbound-item, scrollbar 等），ant-design 组件由 ConfigProvider 的 `darkAlgorithm` 自动处理。

## 日期格式

`formatTs()` 使用 `toLocaleString(i18nLocale, { timeZone, hour12: false })`：
- 时区从 `allSetting.timeLocation` 读取（"Local" 自动回退到浏览器时区）
- 跟随面板当前语言 locale

## Docker 本地测试

```bash
# 构建测试镜像（不含 xray）
docker build -t 3x-ui-test -f Dockerfile.test \
  --build-arg BUILDPLATFORM=linux/amd64 --build-arg TARGETARCH=amd64 .

# 运行（双端口：面板 2053 + 订阅 2096）
docker run -d --name 3xui-test -p 9300:2053 -p 2096:2096 \
  -e XUI_ENABLE_FAIL2BAN=false 3x-ui-test

### ⚠️ inbounds.js 必须动态导入 @/i18n（2026-05-20 已修复）
`frontend/src/entries/inbounds.js` 中 `@/i18n` 必须是动态 `import()` 而非静态 `import`。静态导入会导致 `@/i18n` 并入 inbounds 主 chunk，使 `@/utils` 对 `@/i18n` 的动态 `import()` 失效，产生循环依赖 → `Cannot access 'G' before initialization`。

### ⚠️ toInbound() 中 JSON.parse 必须加 try/catch（2026-05-20 已修复）
`dbinbound.js` 的 `toInbound()` 中 `JSON.parse(this.settings)` 如果抛出异常（测试数据或手动编辑导致 settings 损坏），会导致 `setInbounds()` 中断、`fetched` 永远为 `false`、页面一直 loading。三个 `JSON.parse`（settings、streamSettings、sniffing）均已包裹 try/catch。

### ⚠️ onSwitchEnable 必须用 JSON 而非 FormData（2026-05-20 已修复）
`InboundList.vue` 的 `onSwitchEnable` 曾用 `FormData` 发送 { enable: next }。Go 服务端的 `c.ShouldBind(f)` 对 multipart/form-data 的 boolean 字段绑定不可靠，导致 `f.Enable` 始终为 false，DB 不被更新。改为直接传 `{ enable: next }` 对象，axios 序列化为 URL-encoded 格式即可正常绑定。

### ⚠️ a-switch 必须加动态 :key 避免行复用缓存（2026-05-20 已修复）
`InboundList.vue` 的 `<a-switch>` 必须加 `:key="'sw-' + record.id + '-' + record.enable"`。`a-table` 行复用时 `a-switch` 的内部 checked 缓存不跟随 prop 更新，导致 enable 显示灰色但 DB 数据正确。

### ⚠️ AddInbound 需防御性写入 enable（2026-05-20 已修复）
`web/service/inbound.go` 的 `AddInbound` 中 `tx.Save(inbound)` 在 WAL 模式下可能因写入可见性问题导致部分入站的 `enable` 未被正确持久化。必须在 `tx.Save` 后追加 `tx.Model().Where(...).Update("enable", inbound.Enable)`。

### ⚠️ 行操作导出订阅链接按客户端数决定预选策略（2026-05-21 已修改）
`InboundsPage.vue` 的 `case 'subs'`：单客户端⇒`"inboundId:clientId"` 格式预选；多/零客户端⇒`[]` 空选。`exportAllSubs()`（工具栏按钮）从 `selectedClientIds`（email 字符串）构建 `emailToClientId` 映射后转为数字 `clientId` 预选。

### ⚠️ 编辑订阅时单客户端入站 key 回退查找（2026-05-21 已修复）
`SubscriptionFormModal.vue` 编辑回读时，`flatInboundList` 对 1 客户端入站生成 `inbound-{id}` key。保存写 `"id:clientId"`，回读时先用 `clientItemKey`（`client-{id}-{clientId}`）查找，找不到回退到 `inboundItemKey`。

# 访问 http://localhost:9300/panel  admin/admin
# 订阅 http://localhost:2096/sub/{subId}?pwd=xxx
```

## 代码修改后的文档维护

| 优先级 | 文件 | 说明 |
|--------|------|------|
| 高 | `.kilo/功能修改记录.md` | 记录所有功能新增/调整的背景、方案、改动清单、回退方式 |
| 中 | 本文件（codebase.md） | 数据模型、API 端点、目录结构、流程设计 |
| 低 | `AGENTS.md` | 项目约定、构建方式、架构变更 |
