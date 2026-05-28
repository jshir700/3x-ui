$ErrorActionPreference = "Stop"

$zhTW = "S:\我的云端硬盘\Apps\Linux\3X-UI\3x-ui\web\translation\zh-TW.json"
$zhCN = "S:\我的云端硬盘\Apps\Linux\3X-UI\3x-ui\web\translation\zh-CN.json"

foreach ($file in @($zhTW, $zhCN)) {
    $name = Split-Path $file -Leaf
    Write-Host "`n=== Fixing telegramDesc in $name ===" -ForegroundColor Cyan

    $content = [System.IO.File]::ReadAllText($file, [System.Text.UTF8Encoding]::new($false))

    # The old string ends with: {'@'}userinfobot",
    # The new string ends with: {'@'}userinfobot）",
    $oldStr = @"
{'@'}userinfobot",
"@

    $newStr = @"
{'@'}userinfobot）",
"@

    Write-Host "  Searching for substring (length=$($oldStr.Length))..."
    if ($content.Contains($oldStr)) {
        $content = $content.Replace($oldStr, $newStr)
        [System.IO.File]::WriteAllText($file, $content, [System.Text.UTF8Encoding]::new($false))
        Write-Host "  OK: Added missing ） to telegramDesc" -ForegroundColor Green
    } else {
        Write-Host "  NOT FOUND - checking alternative matches..." -ForegroundColor Yellow
        # Check with different line endings
        $altStr = "{'@'}userinfobot`","
        if ($content.Contains($altStr)) {
            Write-Host "  Alt match found with escaped quote"
            $content = $content.Replace($altStr, "{'@'}userinfobot）`",")
            [System.IO.File]::WriteAllText($file, $content, [System.Text.UTF8Encoding]::new($false))
            Write-Host "  OK (alt method): Added missing ） to telegramDesc" -ForegroundColor Green
        } else {
            Write-Host "  WARNING: Could not find the telegramDesc line to fix" -ForegroundColor Red
        }
    }
}

Write-Host "`nDone." -ForegroundColor Green
