Add-Type -AssemblyName System.Net.Http;$ProgressPreference='SilentlyContinue'
$h=New-Object System.Net.Http.HttpClientHandler;$h.UseCookies=$true;$c=New-Object System.Net.Http.HttpClient($h);$c.BaseAddress=New-Object System.Uri("http://localhost:9300/")
$r=$c.GetAsync("/").Result;$csrf=[regex]::Match($r.Content.ReadAsStringAsync().Result,'<meta name="csrf-token" content="([^"]+)"').Groups[1].Value
$c.DefaultRequestHeaders.Add("X-CSRF-Token",$csrf);$c.PostAsync("/login",(New-Object System.Net.Http.StringContent('{"username":"admin","password":"admin"}',[System.Text.Encoding]::UTF8,"application/json"))).Result|Out-Null
Write-Host "=== Pages ==="
foreach($p in @("/panel/inbounds","/panel/settings","/panel/subscription","/panel/nodes","/panel/xray")){
  $res=$c.GetAsync($p).Result;$len=$res.Content.ReadAsStringAsync().Result.Length
  Write-Host "$p len=$len $(if($len-le1426){'⚠️ empty'}else{'✅'})"}
Write-Host "=== API ==="
$api=$c.GetAsync("/panel/api/inbounds/list").Result.Content.ReadAsStringAsync().Result
if($api-match"success"){Write-Host "inbounds API: OK";$count=($api|ConvertFrom-Json).obj.Count;Write-Host "count: $count"}else{Write-Host "inbounds API: FAIL"}
