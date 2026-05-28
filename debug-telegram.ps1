$ErrorActionPreference = "Stop"
$file = "S:\我的云端硬盘\Apps\Linux\3X-UI\3x-ui\web\translation\zh-TW.json"
$content = [System.IO.File]::ReadAllText($file, [System.Text.UTF8Encoding]::new($false))

# Find the telegramDesc line specifically
$idx = $content.IndexOf("telegramDesc")
$line = $content.Substring($idx, 120)
Write-Host "telegramDesc line:"
Write-Host $line
Write-Host ""

# Check substring
$test1 = 'userinfobot"'
$test2 = "userinfobot`","
Write-Host "Searching 'userinfobot""' (with trailing double-quote):"
Write-Host "  Contains(single-quoted): $($content.Contains($test1))"
Write-Host "  Contains(double-quoted): $($content.Contains($test2))"

# Show hex bytes around userinfobot
$idx2 = $content.IndexOf("userinfobot")
if ($idx2 -ge 0) {
    $sub = $content.Substring($idx2, 18)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($sub)
    $hex = [System.BitConverter]::ToString($bytes)
    Write-Host "  Found at index $idx2"
    Write-Host "  Substring(18 chars): [$sub]"
    Write-Host "  Hex: $hex"
}

# Let me also inspect the specific character after userinfobot
$charAfter = $content[$idx2 + 10]
$codePoint = [int]$charAfter
Write-Host "  Char after 'userinfobot': '$charAfter' (U+{0:X4})" -f $codePoint
