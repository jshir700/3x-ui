Add-Type -AssemblyName System.Net.Http;$ProgressPreference='SilentlyContinue'
$h=New-Object System.Net.Http.HttpClientHandler;$h.UseCookies=$true;$c=New-Object System.Net.Http.HttpClient($h);$c.BaseAddress=New-Object System.Uri("http://localhost:9300/")
$r=$c.GetAsync("/").Result;$csrf=[regex]::Match($r.Content.ReadAsStringAsync().Result,'<meta name="csrf-token" content="([^"]+)"').Groups[1].Value
$c.DefaultRequestHeaders.Add("X-CSRF-Token",$csrf);$c.PostAsync("/login",(New-Object System.Net.Http.StringContent('{"username":"admin","password":"admin"}',[System.Text.Encoding]::UTF8,"application/json"))).Result|Out-Null
try{$page=$c.GetAsync("/panel/inbounds").Result;$len=$page.Content.ReadAsStringAsync().Result.Length;Write-Host "inbounds len=$len"}catch{Write-Host "inbounds page error: $_"}
try{$api=$c.GetAsync("/panel/api/inbounds/list").Result;$text=$api.Content.ReadAsStringAsync().Result;Write-Host "api len=$($text.Length)";Write-Host "starts with: $(if($text.Length-gt80){$text.Substring(0,80)}else{$text})"}catch{Write-Host "api error: $_"}
