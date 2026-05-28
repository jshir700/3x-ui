$ErrorActionPreference = "Stop"

$zhTW = "S:\我的云端硬盘\Apps\Linux\3X-UI\3x-ui\web\translation\zh-TW.json"
$zhCN = "S:\我的云端硬盘\Apps\Linux\3X-UI\3x-ui\web\translation\zh-CN.json"

function Replace-Check {
    param([ref]$Content, [string]$Old, [string]$New, [string]$Label)
    if ($Content.Value.Contains($Old)) {
        $Content.Value = $Content.Value.Replace($Old, $New)
        Write-Host "  OK: $Label" -ForegroundColor Green
        return $true
    } else {
        Write-Host "  NOT FOUND: $Label ($Old)" -ForegroundColor Yellow
        return $false
    }
}

# ============================================================
# Process zh-TW.json
# ============================================================
Write-Host "`n========== Processing zh-TW.json ==========" -ForegroundColor Cyan
$content = [System.IO.File]::ReadAllText($zhTW, [System.Text.UTF8Encoding]::new($false))
$original = $content
$twCount = 0

# --- QR 碼 spacing ---
if (Replace-Check ([ref]$content) 'QR碼' 'QR 碼' 'QR碼 -> QR 碼 (all occurrences)') { $twCount++ }

# --- noData ---
if (Replace-Check ([ref]$content) '無數據' '無資料' 'noData: 無數據 -> 無資料') { $twCount++ }

# --- half-width commas in Chinese (lines 159, 161) ---
if (Replace-Check ([ref]$content) '區塊,tag 為' '區塊，tag 為' 'xrayMetricsHint comma 1') { $twCount++ }
if (Replace-Check ([ref]$content) 'metrics_out,listen 為' 'metrics_out，listen 為' 'xrayMetricsHint comma 2') { $twCount++ }
if (Replace-Check ([ref]$content) '11111,然後重啟 xray' '11111，然後重啟 xray' 'xrayMetricsHint comma 3') { $twCount++ }
if (Replace-Check ([ref]$content) '區塊,列出要探測' '區塊，列出要探測' 'xrayObservatoryHint comma 1') { $twCount++ }
if (Replace-Check ([ref]$content) 'tag,然後重啟 xray' 'tag，然後重啟 xray' 'xrayObservatoryHint comma 2') { $twCount++ }

# --- lines 240-242: file/device/restore ---
if (Replace-Check ([ref]$content) '.db 文件到您的設備' '.db 檔案到您的裝置' 'exportDatabaseDesc: 文件->檔案, 設備->裝置') { $twCount++ }
if (Replace-Check ([ref]$content) '"importDatabase": "恢復"' '"importDatabase": "還原"' 'importDatabase: 恢復->還原') { $twCount++ }
if (Replace-Check ([ref]$content) '上傳設備中的 .db 文件以從備份恢復資料庫' '上傳裝置中的 .db 檔案以從備份還原資料庫' 'importDatabaseDesc: 設備->裝置, 文件->檔案, 恢復->還原') { $twCount++ }

# --- line 275: defaultCatchAll ---
if (Replace-Check ([ref]$content) '兜底匹配其餘' '全面匹配其餘' 'defaultCatchAll: 兜底匹配其餘->全面匹配其餘') { $twCount++ }

# --- line 370: missing ) in telegramDesc ---
if (Replace-Check ([ref]$content) 'userinfobot"', 'userinfobot）"' 'telegramDesc: add missing )') { $twCount++ }

# --- lines 392-395: 連接 -> 連線 in toast messages ---
if (Replace-Check ([ref]$content) '入站連接已成功更新' '入站連線已成功更新' 'toast: 連接->連線 (update)') { $twCount++ }
if (Replace-Check ([ref]$content) '入站連接已成功建立' '入站連線已成功建立' 'toast: 連接->連線 (create)') { $twCount++ }
if (Replace-Check ([ref]$content) '入站連接已成功刪除' '入站連線已成功刪除' 'toast: 連接->連線 (delete)') { $twCount++ }

# --- line 437: 外部端口 -> 外部埠 ---
if (Replace-Check ([ref]$content) '"externalPort": "外部端口"' '"externalPort": "外部埠"' 'externalPort: 端口->埠') { $twCount++ }

# --- lines 592-596: clients auth/reverse labels ---
if (Replace-Check ([ref]$content) '"auth": "认证"' '"auth": "認證"' 'clients.auth: 认证->認證') { $twCount++ }
if (Replace-Check ([ref]$content) '"hysteriaAuth": "Hysteria 认证"' '"hysteriaAuth": "Hysteria 認證"' 'clients.hysteriaAuth: 认证->認證') { $twCount++ }
if (Replace-Check ([ref]$content) '"reverseTag": "反向标签"' '"reverseTag": "反向標籤"' 'clients.reverseTag: 标签->標籤') { $twCount++ }

# --- line 707: loadingRemoteSettings ---
if (Replace-Check ([ref]$content) '正在从远程节点加载设置...' '正在從遠端節點載入設定...' 'loadingRemoteSettings: SC->TC') { $twCount++ }

# --- line 757: Telegram API server ---
if (Replace-Check ([ref]$content) 'Telegram API 服务器' 'Telegram API 伺服器' 'telegramAPIServer: 服务器->伺服器') { $twCount++ }

# --- lines 970-971: bridge/portal ---
if (Replace-Check ([ref]$content) '"bridge": "桥接"' '"bridge": "橋接"' 'outbound.bridge: 桥接->橋接') { $twCount++ }
if (Replace-Check ([ref]$content) '"portal": "门户"' '"portal": "門戶"' 'outbound.portal: 门户->門戶') { $twCount++ }

# --- lines 1065-1067: restart Xray ---
if (Replace-Check ([ref]$content) '"restartConfirmTitle": "重启 Xray？"' '"restartConfirmTitle": "重啟 Xray？"' 'restartConfirmTitle: SC->TC') { $twCount++ }
if (Replace-Check ([ref]$content) '"restartConfirmDesc": "使用已保存的配置重新加载 Xray 服务。"' '"restartConfirmDesc": "使用已儲存的配置重新載入 Xray 服務。"' 'restartConfirmDesc: SC->TC') { $twCount++ }
if (Replace-Check ([ref]$content) '"restartOutput": "Xray 重启输出"' '"restartOutput": "Xray 重啟輸出"' 'restartOutput: SC->TC') { $twCount++ }

# --- line 1360: 風俗 -> 自訂 ---
if (Replace-Check ([ref]$content) '🔢 風俗' '🔢 自訂' 'tgbot.custom: 風俗->自訂') { $twCount++ }

# ============================================================
# BATCH EDIT SECTION (zh-TW)
# ============================================================
Write-Host "`n--- Batch Edit Section (zh-TW) ---" -ForegroundColor Cyan

$batchEdits = @(
    @('"batchEditKeepOriginal": "保持原样"', '"batchEditKeepOriginal": "保持原樣"', 'KeepOriginal'),
    @('"batchEditKeepClientOriginals": "保持每个客户端的原有设置"', '"batchEditKeepClientOriginals": "保持每個客戶端的原有設定"', 'KeepClientOriginals'),
    @('"batchEditNotSet": "未设置"', '"batchEditNotSet": "未設定"', 'NotSet'),
    @('"batchEditNoMatchingInbounds": "没有匹配的入站"', '"batchEditNoMatchingInbounds": "沒有匹配的入站"', 'NoMatchingInbounds'),
    @('"batchEditPartialError": "部分入站更新失败"', '"batchEditPartialError": "部分入站更新失敗"', 'PartialError'),
    @('"batchEditHttpCamouflage": "HTTP 伪装"', '"batchEditHttpCamouflage": "HTTP 偽裝"', 'HttpCamouflage'),
    @('"batchEditHost": "主机"', '"batchEditHost": "主機"', 'Host'),
    @('"batchEditPath": "路径"', '"batchEditPath": "路徑"', 'Path'),
    @('"batchEditServiceName": "服务名称"', '"batchEditServiceName": "服務名稱"', 'ServiceName'),
    @('"batchEditSeed": "种子"', '"batchEditSeed": "種子"', 'Seed'),
    @('"batchEditHeaderType": "头部类型"', '"batchEditHeaderType": "標頭類型"', 'HeaderType'),
    @('"batchEditAuth": "认证"', '"batchEditAuth": "認證"', 'Auth'),
    @('"batchEditUdpIdleTimeout": "UDP 空闲超时（秒）"', '"batchEditUdpIdleTimeout": "UDP 空閒逾時（秒）"', 'UdpIdleTimeout'),
    @('"batchEditMasquerade": "伪装"', '"batchEditMasquerade": "偽裝"', 'Masquerade'),
    @('"batchEditMasqType": "伪装类型"', '"batchEditMasqType": "偽裝類型"', 'MasqType'),
    @('"batchEditClearUdpMasks": "清除 UDP 伪装"', '"batchEditClearUdpMasks": "清除 UDP 偽裝"', 'ClearUdpMasks'),
    @('"batchEditQuicParams": "QUIC 参数"', '"batchEditQuicParams": "QUIC 參數"', 'QuicParams'),
    @('"batchEditCongestion": "拥塞控制"', '"batchEditCongestion": "壅塞控制"', 'Congestion'),
    @('"batchEditDebug": "调试"', '"batchEditDebug": "除錯"', 'Debug'),
    @('"batchEditUdpHop": "UDP 跳转"', '"batchEditUdpHop": "UDP 跳轉"', 'UdpHop'),
    @('"batchEditHopPorts": "跳转端口"', '"batchEditHopPorts": "跳轉埠"', 'HopPorts'),
    @('"batchEditHopInterval": "跳转间隔"', '"batchEditHopInterval": "跳轉間隔"', 'HopInterval'),
    @('"batchEditMaxIdle": "最大空闲（秒）"', '"batchEditMaxIdle": "最大空閒（秒）"', 'MaxIdle'),
    @('"batchEditMaxIncomingStreams": "最大传入流数"', '"batchEditMaxIncomingStreams": "最大傳入流數"', 'MaxIncomingStreams'),
    @('"batchEditRejectUnknownSni": "拒绝未知 SNI"', '"batchEditRejectUnknownSni": "拒絕未知 SNI"', 'RejectUnknownSni'),
    @('"batchEditDisableSystemRoot": "禁用系统根证书"', '"batchEditDisableSystemRoot": "停用系統根憑證"', 'DisableSystemRoot'),
    @('"batchEditSessionResumption": "会话恢复"', '"batchEditSessionResumption": "會話恢復"', 'SessionResumption'),
    @('"batchEditServerName": "服务器名称"', '"batchEditServerName": "伺服器名稱"', 'ServerName'),
    @('"batchEditPublicKey": "公钥"', '"batchEditPublicKey": "公鑰"', 'PublicKey'),
    @('"batchEditMldsaVerify": "ML-DSA65 验证"', '"batchEditMldsaVerify": "ML-DSA65 驗證"', 'MldsaVerify'),
    @('"batchEditEnableSockopt": "启用 Sockopt 修改"', '"batchEditEnableSockopt": "啟用 Sockopt 修改"', 'EnableSockopt'),
    @('"batchEditSockoptHint": "批量编辑 Sockopt 字段暂不支持。此开关预留供将来使用。"', '"batchEditSockoptHint": "批次編輯 Sockopt 欄位暫不支援。此開關預留供將來使用。"', 'SockoptHint'),
    @('"batchEditNoSseHeader": "禁用 SSE Header"', '"batchEditNoSseHeader": "停用 SSE Header"', 'NoSseHeader')
)

foreach ($be in $batchEdits) {
    if (Replace-Check ([ref]$content) $be[0] $be[1] "batchEdit.$($be[2])") { $twCount++ }
}

# --- Save zh-TW ---
if ($content -ne $original) {
    [System.IO.File]::WriteAllText($zhTW, $content, [System.Text.UTF8Encoding]::new($false))
    Write-Host "`nzh-TW.json: SAVED with $twCount replacements." -ForegroundColor Green
} else {
    Write-Host "`nzh-TW.json: NO CHANGES." -ForegroundColor Gray
}

# --- Validate JSON ---
try {
    $null = $content | ConvertFrom-Json -ErrorAction Stop
    Write-Host "zh-TW.json: JSON VALID." -ForegroundColor Green
} catch {
    Write-Host "zh-TW.json: JSON INVALID! $_" -ForegroundColor Red
}

# ============================================================
# Process zh-CN.json
# ============================================================
Write-Host "`n========== Processing zh-CN.json ==========" -ForegroundColor Cyan
$content = [System.IO.File]::ReadAllText($zhCN, [System.Text.UTF8Encoding]::new($false))
$original = $content
$cnCount = 0

# --- line 1360: 风俗 -> 自定义 ---
if (Replace-Check ([ref]$content) '🔢 风俗' '🔢 自定义' 'tgbot.custom: 风俗->自定义') { $cnCount++ }

# --- lines 790-792: Traditional -> Simplified ---
if (Replace-Check ([ref]$content) '"subEnableRoutingDesc": "在 VPN 客户端中启用路由的全局设置。（僅限 Happ）"' '"subEnableRoutingDesc": "在 VPN 客户端中启用路由的全局设置。（仅限 Happ）"' 'subEnableRoutingDesc: 僅限->仅限') { $cnCount++ }
if (Replace-Check ([ref]$content) '"subRoutingRules": "路由規則"' '"subRoutingRules": "路由规则"' 'subRoutingRules: 規則->规则') { $cnCount++ }
if (Replace-Check ([ref]$content) '"subRoutingRulesDesc": "VPN 用戶端的全域路由規則。（僅限 Happ）"' '"subRoutingRulesDesc": "VPN 客户端的全局路由规则。（仅限 Happ）"' 'subRoutingRulesDesc: 用戶端/全域/規則/僅限 -> 客户端/全局/规则/仅限') { $cnCount++ }

# --- lines 159, 161: half-width commas -> fullwidth ---
if (Replace-Check ([ref]$content) '块,tag 为' '块，tag 为' 'xrayMetricsHint comma 1') { $cnCount++ }
if (Replace-Check ([ref]$content) 'metrics_out,listen 为' 'metrics_out，listen 为' 'xrayMetricsHint comma 2') { $cnCount++ }
if (Replace-Check ([ref]$content) '11111,然后重启 xray' '11111，然后重启 xray' 'xrayMetricsHint comma 3') { $cnCount++ }
if (Replace-Check ([ref]$content) '块,列出要探测' '块，列出要探测' 'xrayObservatoryHint comma 1') { $cnCount++ }
if (Replace-Check ([ref]$content) 'tag,然后重启 xray' 'tag，然后重启 xray' 'xrayObservatoryHint comma 2') { $cnCount++ }

# --- line 379: missing ） ---
if (Replace-Check ([ref]$content) 'userinfobot"', 'userinfobot）"' 'telegramDesc: add missing ）') { $cnCount++ }

# --- line 825: final . -> 。 ---
if (Replace-Check ([ref]$content) '"noisesDesc": "启用 Noises."' '"noisesDesc": "启用 Noises。"' 'noisesDesc: . -> 。') { $cnCount++ }

# --- Save zh-CN ---
if ($content -ne $original) {
    [System.IO.File]::WriteAllText($zhCN, $content, [System.Text.UTF8Encoding]::new($false))
    Write-Host "`nzh-CN.json: SAVED with $cnCount replacements." -ForegroundColor Green
} else {
    Write-Host "`nzh-CN.json: NO CHANGES." -ForegroundColor Gray
}

# --- Validate JSON ---
try {
    $null = $content | ConvertFrom-Json -ErrorAction Stop
    Write-Host "zh-CN.json: JSON VALID." -ForegroundColor Green
} catch {
    Write-Host "zh-CN.json: JSON INVALID! $_" -ForegroundColor Red
}

Write-Host "`n========== DONE ==========" -ForegroundColor Cyan
Write-Host "zh-TW: $twCount replacements"
Write-Host "zh-CN: $cnCount replacements"
