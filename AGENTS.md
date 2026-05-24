# 3X-UI 项目 AI 助手指南

## 概述
3X-UI 是一个基于 Go 的 Xray-core 代理管理面板。使用 SQLite 存储、Gin HTTP 路由、GORM ORM。前端为 Vue.js（独立构建）。

## 架构
- `main.go` — 入口，启动 Web 服务器 + 子命令
- `database/` — SQLite 配置、GORM 模型、迁移
  - `db.go` — `InitDB()`、模型自动迁移、种子数据
  - `model/model.go` — 所有数据模型（Inbound、Node、User、Setting 等）
- `web/` — HTTP 层
  - `web.go` — 服务器初始化、定时任务注册、运行时管理器
  - `controller/` — Gin 处理器（inbound、node、server、setting、api）
  - `service/` — 业务逻辑（inbound、xray、node、setting 等）
  - `runtime/` — 运行时抽象（本地 xray gRPC、远程节点 HTTP）
  - `job/` — 定时任务（流量同步、心跳、xray 运行检查）
- `xray/` — Xray-core 进程管理、gRPC API 客户端、配置生成
- `frontend/` — Vue.js SPA（编译到 dist/，通过 go:embed 嵌入）

## 多节点架构（中央面板 + 远程节点）
- **中央面板**管理多个远程 3X-UI 节点
- 每个远程节点运行独立的 3X-UI 实例
- 中央面板通过 HTTP API 轮询远程节点，使用 Bearer token 认证
- `NodeTrafficSyncJob`（每 5 秒）从节点拉取入站列表 + 流量
- `NodeHeartbeatJob`（每 5 秒）检查节点存活
- 远程节点通过 `api_tokens` 表认证（设置 → API 令牌）

## 构建 & 测试
- Go 版本: >= 1.26.3
- 构建: `go build ./...`
- 测试（需要 CGO 用于 sqlite3 测试）: `go test -count=1 ./...`
- 测试（跳过数据库）: `go test -count=1 $(go list ./... | grep -v /service/)`
- 单包测试: `go test -count=1 -v -run 'TestName' ./web/service/`

## 数据库
- SQLite WAL 模式（`_journal_mode=WAL&_busy_timeout=10000`）
- 迁移: GORM AutoMigrate + 手动索引迁移（`db.go`）
- 种子数据: `history_of_seeders` 表追踪已执行的 seeding

## 约定
- 入站 tag 生成规则: `inbound-{port}` 或 `inbound-{listen}:{port}`
- `node_id IS NULL` = 本地入站；`node_id = N` = 属于远程节点 N
- `(tag, node_id)` 是复合唯一索引（由全局唯一 tag 改为）
- 测试使用临时 sqlite 数据库，需要 `CGO_ENABLED=1`

## 修改代码后的文档维护

每次修改代码后，必须更新以下文档（按优先级排序）：

| 优先级 | 文件 | 何时更新 |
|--------|------|----------|
| 高 | `.kilo/功能修改记录.md` | 新增功能时追加条目，调整已有功能时更新对应条目的内容 |
| 中 | `.kilo/agent/codebase.md` | 数据模型、同步流程、API 路由、项目结构变更时 |
| 低 | `AGENTS.md` | 项目约定、构建方式、架构变更时 |

### 规则 1：每次代码改动后同步文档

每次代码修改完成后，**必须**依次同步以下三份文档：
1. `.kilo/agent/codebase.md` — 更新数据模型、API 端点、流程、组件结构等
2. `.kilo/CHANGELOG.md` — 按时间倒序追加条目，包含根因、改动文件清单、回退步骤
3. `.kilo/功能修改记录.md` — 追加修复记录或新增功能章节

### 规则 2：构建后预设测试数据

每次 Docker 构建测试网页后，**必须**预先创建以下测试数据：

| 类型 | 数量 | 说明 |
|------|------|------|
| 入站 | 各 5 种 | vmess / vless / trojan / shadowsocks / wireguard / hysteria / mixed / http / tunnel / tun 每种 5 个 = 50 个 |
| 节点 | 20 | Node‑1 ~ Node‑20 |
| 订阅 | 20 | Sub‑1 ~ Sub‑20，覆盖 base64 / json / clash / text 四种格式 |

使用 PowerShell 脚本通过 API 批量创建，登录凭据 `admin / admin`。

### 规则 2b：所有新增 UI 文本必须支持多语言

每次为前端界面新增任何用户可见的文字（包括按钮、标签、提示、列标题、错误消息、占位符等），**必须**：

1. 在 `en-US.json` 和 `zh-CN.json` 中添加对应的 flat key（使用 `sub` 前缀代替嵌套 `pages.subscription.*`，因为 vue-i18n `legacy: false` + `useI18n()` 组合不解析点号嵌套键）
2. 对于模板中的文字，使用 `{{ t('subKeyName') }}` 或 `:label="t('subKeyName')"` 或 `:title="t('subKeyName')"` 替换硬编码文本
3. 对于脚本中的文字（消息、提示、确认框），使用 `t('subKeyName')` 替换
4. 在 `en-US.json` 中必须始终提供英文翻译（回退基准语言）
5. 在 `zh-CN.json` 中提供中文翻译
6. **其他 11 种语言也必须添加对应的 flat key**，值必须翻译成对应的语言（英文可以作为回退机制，但是不能只有英文，必须有对应语言的翻译），键必须存在，不得留空。运行 `python add_keys.py` 可批量添加

### 规则 3：每次改完代码后必须检查页面加载

每次 Docker 构建并部署后，**必须**执行以下检查：

1. 启动容器后等待至少 5 秒（`Start-Sleep 5`）
2. 用 PowerShell 测试面板主页是否能登录（`POST /login`）
3. 测试所有页面是否能正常返回 200：
   - `/panel/inbounds`（**优先检查**，最容易出问题）
   - `/panel/settings`
   - `/panel/subscription`
   - `/panel/nodes`
   - `/panel/xray`
4. 测试关键 API 是否能正常返回数据：
   - `GET /panel/api/inbounds/list` → `success=true`
5. 检查页面 Content-Length：
   - **2485B**（含数据）或 **1426B**（SPA 壳无数据）
   - 如果返回 1426B，说明 JavaScript 执行出错，必须排查代码
6. 使用 `$?` 或 try/catch 捕获异常而非管道 `Out-Null`
