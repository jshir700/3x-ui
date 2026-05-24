$ErrorActionPreference = "Stop"

$panelUrl  = "http://localhost:3443"
$username  = "admin"
$password  = "admin"
$cookieJar = "$env:TEMP\3xui-test-cookies.txt"
$curl = "curl.exe"

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
function Get-CsrfToken {
    $resp = & $curl -s -b $cookieJar -c $cookieJar "$panelUrl/csrf-token" 2>$null
    if ($resp -match '"obj"\s*:\s*"([^"]+)"') { return $Matches[1] }
    throw "Failed to get CSRF token: $resp"
}

function Api-Get($path) {
    $csrf = Get-CsrfToken
    $resp = & $curl -s -b $cookieJar -H "X-CSRF-Token: $csrf" "$panelUrl$path" 2>$null
    return $resp | ConvertFrom-Json
}

function Api-Post($path, $body) {
    $csrf = Get-CsrfToken
    $resp = & $curl -s -b $cookieJar -c $cookieJar -X POST "$panelUrl$path" `
        -H "X-CSRF-Token: $csrf" `
        -H "Content-Type: application/x-www-form-urlencoded" `
        --data-raw $body 2>$null
    return $resp | ConvertFrom-Json
}

function Api-PostJson($path, $jsonBody) {
    $csrf = Get-CsrfToken
    # PowerShell mangles JSON strings passed as arguments to native
    # executables — write to a temp file and use --data-binary @file
    # so the Go backend receives the exact bytes.
    $tmpFile = "$env:TEMP\3xui-api-json-$pid-$((Get-Random).ToString('x')).json"
    [System.IO.File]::WriteAllText($tmpFile, $jsonBody, [System.Text.UTF8Encoding]::new($false))
    try {
        $resp = & $curl -s -b $cookieJar -c $cookieJar -X POST "$panelUrl$path" `
            -H "X-CSRF-Token: $csrf" `
            -H "Content-Type: application/json" `
            --data-binary "@$tmpFile" 2>$null
        return $resp | ConvertFrom-Json
    } finally {
        Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
    }
}

function Get-Uuid {
    $resp = Api-Get "/panel/api/server/getNewUUID"
    return $resp.obj.uuid
}

function New-WireGuardKey {
    # Generate a valid WireGuard key: 32 random bytes, base64-encoded → 44 chars.
    $bytes = [byte[]]::new(32)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

function Login {
    $resp = & $curl -s -c $cookieJar "$panelUrl/csrf-token" 2>$null
    $csrf = if ($resp -match '"obj"\s*:\s*"([^"]+)"') { $Matches[1] } else { throw "Failed" }
    $resp = & $curl -s -b $cookieJar -c $cookieJar -X POST "$panelUrl/login" `
        -H "X-CSRF-Token: $csrf" `
        -H "Content-Type: application/x-www-form-urlencoded" `
        --data-raw "username=$username&password=$password" 2>$null
    $json = $resp | ConvertFrom-Json
    if (-not $json.success) { throw "Login failed: $resp" }
    Write-Host "Logged in" -ForegroundColor Green
}

function New-Inbound($protocol, $port, $remark, $settingsJson, $traffic) {
    $sniffing = '{"enabled":true,"destOverride":["http","tls","quic","fakedns"],"metadataOnly":false,"routeOnly":false}'
    $stream = '{"network":"tcp","security":"none","tcpSettings":{"header":{"type":"none"}}}'
    $tag = "inbound-$port"

    $body = @(
        "port=$port"
        "listen="
        "protocol=$protocol"
        "tag=$tag"
        "remark=$remark"
        "enable=true"
        "sniffing=$([uri]::EscapeDataString($sniffing))"
    )
    # Only add streamSettings for protocols that support it
    $streamProtocols = @('vmess','vless','trojan','shadowsocks','hysteria')
    if ($protocol -in $streamProtocols) {
        $body += "streamSettings=$([uri]::EscapeDataString($stream))"
    }
    # settings as raw JSON string — properly URL-encode to preserve double quotes
    $body += "settings=$([uri]::EscapeDataString($settingsJson))"
    # traffic values
    $body += "up=$($traffic.up)"
    $body += "down=$($traffic.down)"
    $body += "total=$($traffic.total)"

    $bodyStr = $body -join '&'
    $result = Api-Post "/panel/api/inbounds/add" $bodyStr
    if (-not $result.success) {
        Write-Host "  FAILED: $($result.msg)" -ForegroundColor Red
        return $null
    }
    return $result.obj.id
}

function New-Node($name, $address, $port, $scheme, $remark) {
    $body = @(
        "name=$([uri]::EscapeDataString($name))"
        "address=$address"
        "port=$port"
        "scheme=$scheme"
        "remark=$([uri]::EscapeDataString($remark))"
        "enable=true"
        "apiToken=test-token-$name"
    ) -join '&'
    $result = Api-Post "/panel/api/nodes/add" $body
    if (-not $result.success) {
        Write-Host "  Node FAILED: $($result.msg)" -ForegroundColor Red
        return $null
    }
    return $result.obj.id
}

function New-Subscription($remark, $inboundIds, $format, $title) {
    $ids = $inboundIds -join ','
    # Use JSON - the Subscription model has json tags but no form tags
    $jsonBody = @{
        remark       = $remark
        inboundIds   = $ids
        format       = $format
        title        = $title
        enable       = $true
        showInfo     = $true
        updateInterval = 12
        supportUrl   = "https://example.com/support"
        profileUrl   = "https://example.com/profile"
        announce     = "Welcome to test subscription"
    } | ConvertTo-Json -Compress
    $result = Api-PostJson "/panel/api/subscription/add" $jsonBody
    if (-not $result.success) {
        Write-Host "  Sub FAILED: $($result.msg)" -ForegroundColor Red
        return $null
    }
    return $result.obj.subId
}

# ------------------------------------------------------------
# Main
# ------------------------------------------------------------
Write-Host "=== Login ===" -ForegroundColor Cyan
Login

# Track created IDs
$allInboundIds = @()
$allSubIds = @()
$inboundIdsByProtocol = @{}

# Protocol definitions with settings builders
$protocols = @(
    @{name='vmess';       port=10001},
    @{name='vless';       port=10101},
    @{name='trojan';      port=10201},
    @{name='shadowsocks'; port=10301},
    @{name='wireguard';   port=10401},
    @{name='hysteria';    port=10501},
    @{name='mixed';       port=10601},
    @{name='http';        port=10701},
    @{name='tunnel';      port=10801},
    @{name='hysteria2';   port=10901}
)

# Varied traffic profiles (up, down, total) - not all 0 or infinity
$trafficProfiles = @(
    @{up=0;             down=0;             total=0},                # 0: unlimited
    @{up=5368709120;    down=10737418240;   total=21474836480},      # 1: 5GB/10GB/20GB
    @{up=1073741824;    down=2147483648;    total=5368709120},       # 2: 1GB/2GB/5GB
    @{up=32212254720;   down=64424509440;   total=107374182400},     # 3: 30GB/60GB/100GB
    @{up=107374182400;  down=214748364800;  total=0}                 # 4: 100GB/200GB/unlimited
)

Write-Host "=== Creating 50 Inbounds (10 types x 5 each) ===" -ForegroundColor Cyan

foreach ($proto in $protocols) {
    $protoName = $proto.name
    $basePort = $proto.port
    $inboundIdsByProtocol[$protoName] = @()

    Write-Host "  $protoName..." -ForegroundColor Yellow

    for ($i = 1; $i -le 5; $i++) {
        $port = $basePort + $i - 1
        $remark = "$protoName-test-$i"
        $traffic = $trafficProfiles[$i - 1]
        $clientCount = 2 + ($i % 3)  # 2-4 clients per inbound

        # Build protocol-specific settings JSON
        $settings = $null
        $streamSettings = $null

        switch ($protoName) {
            'vmess' {
                $clients = @()
                for ($c = 1; $c -le $clientCount; $c++) {
                    $uuid = Get-Uuid
                    $clients += @{
                        id = $uuid
                        security = "auto"
                        email = "v-${protoName}${i}-c${c}@test.local"
                        limitIp = 0
                        totalGB = 0
                        expiryTime = 0
                        enable = $true
                        tgId = ""
                        subId = "v-${protoName}${i}-${c}"
                        comment = "client $c"
                        reset = 0
                    }
                }
                $settings = @{ clients = $clients } | ConvertTo-Json -Depth 5 -Compress
            }
            'vless' {
                $clients = @()
                for ($c = 1; $c -le $clientCount; $c++) {
                    $uuid = Get-Uuid
                    $flow = if ($c % 2 -eq 1) { "xtls-rprx-vision" } else { "" }
                    $clients += @{
                        id = $uuid
                        flow = $flow
                        email = "v-${protoName}${i}-c${c}@test.local"
                        limitIp = 0
                        totalGB = 0
                        expiryTime = 0
                        enable = $true
                        tgId = ""
                        subId = "v-${protoName}${i}-${c}"
                        comment = "client $c"
                        reset = 0
                    }
                }
                $settings = @{ clients = $clients; decryption = "none"; fallbacks = @() } | ConvertTo-Json -Depth 5 -Compress
            }
            'trojan' {
                $clients = @()
                for ($c = 1; $c -le $clientCount; $c++) {
                    $pw = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 16 | % { [char]$_ })
                    $clients += @{
                        password = $pw
                        email = "t-${protoName}${i}-c${c}@test.local"
                        limitIp = 0
                        totalGB = 0
                        expiryTime = 0
                        enable = $true
                        tgId = ""
                        subId = "t-${protoName}${i}-${c}"
                        comment = "client $c"
                        reset = 0
                    }
                }
                $settings = @{ clients = $clients; fallbacks = @() } | ConvertTo-Json -Depth 5 -Compress
            }
            'shadowsocks' {
                $method = "chacha20-ietf-poly1305"
                $password = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % { [char]$_ })
                $clients = @()
                for ($c = 1; $c -le $clientCount; $c++) {
                    $cpw = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 16 | % { [char]$_ })
                    $clients += @{
                        password = $cpw
                        method = $method
                        email = "s-${protoName}${i}-c${c}@test.local"
                        limitIp = 0
                        totalGB = 0
                        expiryTime = 0
                        enable = $true
                        tgId = ""
                        subId = "s-${protoName}${i}-${c}"
                        comment = "client $c"
                        reset = 0
                    }
                }
                $settings = @{ clients = $clients; method = $method; password = $password; network = "tcp,udp" } | ConvertTo-Json -Depth 5 -Compress
            }
            'wireguard' {
                $privKey = New-WireGuardKey
                $pubKey = New-WireGuardKey
                $peers = @()
                for ($c = 1; $c -le $clientCount; $c++) {
                    $peerPriv = New-WireGuardKey
                    $peerPub = New-WireGuardKey
                    $peers += @{
                        privateKey = $peerPriv
                        publicKey = $peerPub
                        allowedIPs = @("10.0.${i}.${c}/32")
                        psk = ""
                        keepAlive = 25
                        email = "w-${protoName}${i}-c${c}@test.local"
                        subId = "w-${protoName}${i}-${c}"
                        enable = $true
                    }
                }
                $settings = @{
                    secretKey = $privKey
                    publicKey = $pubKey
                    address = @("10.0.${i}.1/32")
                    mtu = 1420
                    peers = $peers
                } | ConvertTo-Json -Depth 5 -Compress
            }
            'hysteria' {
                $clients = @()
                for ($c = 1; $c -le $clientCount; $c++) {
                    $auth = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % { [char]$_ })
                    $clients += @{
                        email = "h-${protoName}${i}-c${c}@test.local"
                        auth = $auth
                        limitIp = 0
                        totalGB = 0
                        expiryTime = 0
                        enable = $true
                        tgId = ""
                        subId = "h-${protoName}${i}-${c}"
                        comment = "client $c"
                        reset = 0
                    }
                }
                $settings = @{ clients = $clients; version = 2; up = "100"; down = "200" } | ConvertTo-Json -Depth 5 -Compress
            }
            'mixed' {
                $clients = @()
                for ($c = 1; $c -le $clientCount; $c++) {
                    $uuid = Get-Uuid
                    $pw = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 16 | % { [char]$_ })
                    $clients += @{
                        id = $uuid
                        flow = ""
                        password = $pw
                        email = "m-${protoName}${i}-c${c}@test.local"
                        limitIp = 0
                        totalGB = 0
                        expiryTime = 0
                        enable = $true
                        tgId = ""
                        subId = "m-${protoName}${i}-${c}"
                        comment = "client $c"
                        reset = 0
                    }
                }
                $settings = @{ clients = $clients } | ConvertTo-Json -Depth 5 -Compress
            }
            'http' {
                $clients = @()
                for ($c = 1; $c -le $clientCount; $c++) {
                    $uuid = Get-Uuid
                    $pw = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 16 | % { [char]$_ })
                    $clients += @{
                        id = $uuid
                        password = $pw
                        email = "x-${protoName}${i}-c${c}@test.local"
                        limitIp = 0
                        totalGB = 0
                        expiryTime = 0
                        enable = $true
                        tgId = ""
                        subId = "x-${protoName}${i}-${c}"
                        comment = "client $c"
                        reset = 0
                    }
                }
                $settings = @{ clients = $clients } | ConvertTo-Json -Depth 5 -Compress
            }
            'tunnel' {
                $settings = @{ target = "192.168.${i}.1:8080"; protocol = "tcp" } | ConvertTo-Json -Depth 3 -Compress
            }
            'hysteria2' {
                $clients = @()
                for ($c = 1; $c -le $clientCount; $c++) {
                    $auth = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % { [char]$_ })
                    $clients += @{
                        email = "h2-${protoName}${i}-c${c}@test.local"
                        auth = $auth
                        limitIp = 0
                        totalGB = 0
                        expiryTime = 0
                        enable = $true
                        tgId = ""
                        subId = "h2-${protoName}${i}-${c}"
                        comment = "client $c"
                        reset = 0
                    }
                }
                $settings = @{ clients = $clients; version = 2; up = "100"; down = "200" } | ConvertTo-Json -Depth 5 -Compress
            }
        }

        $id = New-Inbound $protoName $port $remark $settings $traffic
        if ($id) {
            $allInboundIds += $id
            $inboundIdsByProtocol[$protoName] += $id
        }
    }
}

Write-Host "Created $($allInboundIds.Count) inbounds" -ForegroundColor Green

# ------------------------------------------------------------
# Create 20 nodes
# ------------------------------------------------------------
Write-Host "=== Creating 20 Nodes ===" -ForegroundColor Cyan

$nodeIds = @()
$nodeSchemes = @('http','https')
$nodeAddresses = @(
    'node1.example.com','192.168.10.101','node2.example.com','10.0.0.201','vps.example.net',
    '203.0.113.50','proxy1.example.org','198.51.100.25','relay.example.com','172.16.0.99',
    'edge1.example.com','192.168.20.55','gw2.example.net','10.10.5.33','tun.example.org',
    '203.0.114.75','nat1.example.com','198.51.101.88','fw1.example.net','172.20.0.42'
)

for ($i = 1; $i -le 20; $i++) {
    $name = "node-{0:D2}" -f $i
    $address = $nodeAddresses[$i - 1]
    $port = 2053 + ($i % 5)
    $scheme = $nodeSchemes[$i % 2]
    $remark = "Test node $i - $($scheme.ToUpper())"

    $id = New-Node $name $address $port $scheme $remark
    if ($id) { $nodeIds += $id }
}

Write-Host "Created $($nodeIds.Count) nodes" -ForegroundColor Green

# ------------------------------------------------------------
# Create 20 subscriptions
# ------------------------------------------------------------
Write-Host "=== Creating 20 Subscriptions ===" -ForegroundColor Cyan

$subFormats = @('base64','text','clash','json')
$subTitles = @(
    'Premium Access','Standard Plan','Basic Tier','VIP Package','Enterprise Suite',
    'Family Bundle','Student Pass','Lifetime Deal','Annual Subscription','Monthly Plan',
    'Regional Access','Global Connect','Secure Tunnel','Privacy Shield','Speed Boost',
    'Unlimited Data','Budget Saver','Pro Account','Cloud Gateway','Ultra Fast'
)

# Distribute inbounds across subscriptions
$inboundPool = @($allInboundIds)
# If no new inbounds were created (e.g. they already exist from a previous
# run), fetch the existing inbound list so subscriptions have data to link.
if ($inboundPool.Count -eq 0) {
    Write-Host "  No new inbounds created — fetching existing inbound IDs from API" -ForegroundColor DarkGray
    $listResp = Api-Get "/panel/api/inbounds/list"
    if ($listResp.success -and $listResp.obj) {
        $inboundPool = @($listResp.obj | ForEach-Object { $_.id })
        Write-Host "  Found $($inboundPool.Count) existing inbounds" -ForegroundColor DarkGray
    }
}
$rng = New-Object Random

for ($i = 1; $i -le 20; $i++) {
    $remark = "sub-{0:D2}" -f $i
    $title = $subTitles[$i - 1]
    $format = $subFormats[$i % 4]

    # Pick 2-5 random inbounds for each subscription
    $count = $rng.Next(2, 6)
    $selectedIds = $inboundPool | Get-Random -Count $count
    # Include at least one node's port remapped inbounds where possible
    # For now just use inbound IDs directly

    $subId = New-Subscription $remark $selectedIds $format $title
    if ($subId) { $allSubIds += $subId }
}

Write-Host "Created $($allSubIds.Count) subscriptions" -ForegroundColor Green

# ------------------------------------------------------------
# Set traffic data on client stats (via API)
# ------------------------------------------------------------
Write-Host "=== Updating traffic data ===" -ForegroundColor Cyan

# Update the first few inbounds to have non-zero traffic on clientStats
foreach ($proto in $protocols) {
    $ids = $inboundIdsByProtocol[$proto.name]
    for ($j = 0; $j -lt $ids.Count; $j++) {
        $inboundId = $ids[$j]
        $profile = $trafficProfiles[$j]
        # Update traffic via the resetClientTraffic or similar endpoint
        # Actually, traffic values are set during creation via up/down/total params
        # Client traffic can be updated via updateClientTraffic endpoint
        try {
            $clients = (Api-Get "/panel/api/inbounds/get/$inboundId").obj.clientStats
            if ($clients) {
                foreach ($client in $clients) {
                    $up = [int64]($profile.up / [Math]::Max(1, $clients.Count)) + (Get-Random -Minimum 0 -Maximum 104857600)
                    $down = [int64]($profile.down / [Math]::Max(1, $clients.Count)) + (Get-Random -Minimum 0 -Maximum 209715200)
                    $body = "up=$up&down=$down&total=$($profile.total)"
                    $r = Api-Post "/panel/api/inbounds/updateClientTraffic/$($client.email)" $body
                }
            }
        } catch {
            Write-Host "  Traffic update skipped for inbound $inboundId" -ForegroundColor DarkGray
        }
    }
}

# ------------------------------------------------------------
# Post-setup verification: inbounds list must load correctly
# ------------------------------------------------------------
Write-Host "=== Verifying inbound list loads ===" -ForegroundColor Cyan

$listResp = Api-Get "/panel/api/inbounds/list"
if (-not $listResp.success) {
    Write-Host "  FAILED: inbounds list API returned success=false — frontend will keep loading" -ForegroundColor Red
    Write-Host "  msg: $($listResp.msg)" -ForegroundColor Red
} else {
    $obj = $listResp.obj
    if ($obj -is [array]) {
        $count = $obj.Count
    } elseif ($obj.inbounds) {
        $count = $obj.inbounds.Count
    } else {
        $count = 0
    }
    Write-Host "  Inbounds list returned $count records" -ForegroundColor $(if ($count -ge 50) { "Green" } else { "Yellow" })

    if ($count -lt 50) {
        Write-Host "  WARNING: expected 50 inbounds, got $count — some may have failed to create" -ForegroundColor Yellow
    }

    # Check for duplicate ports (caused by DB-save-before-Xray-validate ordering)
    if ($count -gt 0) {
        $ports = if ($obj -is [array]) { $obj.port } else { $obj.inbounds.port }
        $dupPorts = $ports | Group-Object | Where-Object { $_.Count -gt 1 }
        if ($dupPorts) {
            Write-Host "  WARNING: duplicate ports detected:" -ForegroundColor Yellow
            foreach ($d in $dupPorts) {
                Write-Host "    port $($d.Name): $($d.Count) inbounds" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  No duplicate ports — clean" -ForegroundColor Green
        }
    }

    # Verify response structure won't break frontend parsing
    $firstInbound = if ($obj -is [array]) { $obj[0] } else { $obj.inbounds[0] }
    $hasRequired = ($null -ne $firstInbound) -and
                   ($null -ne $firstInbound.id) -and
                   ($null -ne $firstInbound.protocol) -and
                   ($null -ne $firstInbound.port)
    if ($hasRequired) {
        Write-Host "  Response structure OK (id, protocol, port present)" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: response missing expected fields — frontend may fail to parse" -ForegroundColor Yellow
    }
}

Write-Host "=== Done ===" -ForegroundColor Green
Write-Host "Inbounds: $($allInboundIds.Count)" -ForegroundColor Cyan
Write-Host "Nodes: $($nodeIds.Count)" -ForegroundColor Cyan
Write-Host "Subscriptions: $($allSubIds.Count)" -ForegroundColor Cyan

# Output summary for manual testing
Write-Host "`nTest URLs:" -ForegroundColor Yellow
Write-Host "  Panel:  $panelUrl/panel/inbounds" -ForegroundColor White
Write-Host "  Panel:  $panelUrl/panel/nodes" -ForegroundColor White
Write-Host "  Panel:  $panelUrl/panel/subscription" -ForegroundColor White
if ($allSubIds.Count -gt 0) {
    Write-Host "  Sub:    http://localhost:8443/sub/$($allSubIds[0])`?html=1" -ForegroundColor White
}
