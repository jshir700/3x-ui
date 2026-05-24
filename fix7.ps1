Add-Type -AssemblyName System.Net.Http;$ProgressPreference='SilentlyContinue'
$h=New-Object System.Net.Http.HttpClientHandler;$h.UseCookies=$true;$c=New-Object System.Net.Http.HttpClient($h);$c.BaseAddress=New-Object System.Uri("http://localhost:9300/")
$r=$c.GetAsync("/").Result;$csrf=[regex]::Match($r.Content.ReadAsStringAsync().Result,'<meta name="csrf-token" content="([^"]+)"').Groups[1].Value
$c.DefaultRequestHeaders.Add("X-CSRF-Token",$csrf);$c.PostAsync("/login",(New-Object System.Net.Http.StringContent('{"username":"admin","password":"admin"}',[System.Text.Encoding]::UTF8,"application/json"))).Result|Out-Null
$targets=@(4,6,11,12,14,17,20)
$body=New-Object System.Net.Http.StringContent('{"enable":true}',[System.Text.Encoding]::UTF8,"application/json")
foreach($id in $targets){$resp=$c.PostAsync("/panel/api/inbounds/setEnable/$id",$body).Result;$text=$resp.Content.ReadAsStringAsync().Result;Write-Host "setEnable/$id => $text"}
$list=$c.GetAsync("/panel/api/inbounds/list").Result.Content.ReadAsStringAsync().Result|ConvertFrom-Json
foreach($ib in $list.obj){if($targets -contains $ib.id){Write-Host "$($ib.remark) enable=$($ib.enable)"}}
