Add-Type -AssemblyName System.Net.Http;$ProgressPreference='SilentlyContinue'
$h=New-Object System.Net.Http.HttpClientHandler;$h.UseCookies=$true;$c=New-Object System.Net.Http.HttpClient($h);$c.BaseAddress=New-Object System.Uri("http://localhost:9300/")
$r=$c.GetAsync("/").Result;$csrf=[regex]::Match($r.Content.ReadAsStringAsync().Result,'<meta name="csrf-token" content="([^"]+)"').Groups[1].Value
$c.DefaultRequestHeaders.Add("X-CSRF-Token",$csrf);$c.PostAsync("/login",(New-Object System.Net.Http.StringContent('{"username":"admin","password":"admin"}',[System.Text.Encoding]::UTF8,"application/json"))).Result|Out-Null
Write-Host "=== Pages ===" -ForegroundColor Cyan
foreach($p in @("/panel/inbounds","/panel/settings","/panel/subscription","/panel/nodes","/panel/xray")){$res=$c.GetAsync($p).Result;$len=$res.Content.ReadAsStringAsync().Result.Length;Write-Host "$p len=$len"}
Write-Host "=== Cleanup ===" -ForegroundColor Cyan
try{$j=($c.GetAsync("/panel/api/inbounds/list").Result.Content.ReadAsStringAsync().Result|ConvertFrom-Json);if($j.obj){$j.obj|%{$c.PostAsync("/panel/api/inbounds/del/$($_.id)",$null).Result|Out-Null}};Write-Host "  inbounds done"}catch{}
try{$j=($c.GetAsync("/panel/api/subscription/list").Result.Content.ReadAsStringAsync().Result|ConvertFrom-Json);if($j.obj){$j.obj|%{$c.PostAsync("/panel/api/subscription/del/$($_.id)",$null).Result|Out-Null}};Write-Host "  subs done"}catch{}
try{for($i=1;$i-le50;$i++){$c.PostAsync("/panel/api/nodes/del/$i",$null).Result|Out-Null};Write-Host "  nodes done"}catch{}
# Generate 20 valid UUIDs
$vids=@()
for($vi=0;$vi-lt20;$vi++){$r1="{0:x8}"-f(Get-Random -Minimum 1 -Maximum 2147483647);$r2="{0:x4}"-f(Get-Random -Minimum 1 -Maximum 65535);$r3="{0:x4}"-f(Get-Random -Minimum 1 -Maximum 65535);$r4="{0:x4}"-f(Get-Random -Minimum 1 -Maximum 65535);$r5="{0:x12}"-f(Get-Random -Minimum 1 -Maximum 281474976710655);$vids+="$r1-$r2-$r3-$r4-$r5"}
Write-Host "=== Creating 50 inbounds ===" -ForegroundColor Cyan
$ttl=0;$port=30100
$protos=@("vmess","vless","trojan","shadowsocks","wireguard","hysteria","mixed","http","tunnel","tun")
foreach($p in $protos){
  for($i=1;$i-le5;$i++){
    $rnd=Get-Random -Minimum 1000 -Maximum 9999
    if($p-eq"wireguard"){
      $s='{"peers":[{"publicKey":"pk1_'"$rnd"'","endpoint":"wg'"$i"'.t.com:51820","allowedIPs":["10.0.0.'"$i"/32'"]"},{"publicKey":"pk2_'"$rnd"'","endpoint":"wg'"$i"'.t.com:51820","allowedIPs":["10.0.0.'"$i"/32'"]"}],"secretKey":"sk'"$i$rnd"'"}'
    }elseif($p-eq"mixed"){
      $s='{"auth":"password","accounts":[{"user":"u1_'$i'","pass":"pw1_'$rnd'"},{"user":"u2_'$i'","pass":"pw2_'$rnd'"}]}'
    }elseif($p-eq"http"){
      $s='{"auth":"password","accounts":[{"user":"hu1_'$i'","pass":"hpw1_'$rnd'"},{"user":"hu2_'$i'","pass":"hpw2_'$rnd'"}]}'
    }elseif($p-eq"tunnel"){
      $s='{"rewriteAddress":"10.0.0.1","rewritePort":443,"allowedNetwork":"tcp","followRedirect":false}'
    }elseif($p-eq"tun"){
      $s='{"name":"tun'$i'","mtu":1500,"gateway":["10.0.'$i'.1"],"dns":["8.8.8.8"]}'
    }elseif($p-eq"shadowsocks"){
      $s='{"method":"chacha20-ietf-poly1305","clients":[{"email":"ss1_'"$i$rnd"'@t.com","password":"pw1_'"$i$rnd"'","enable":true},{"email":"ss2_'"$i$rnd"'@t.com","password":"pw2_'"$i$rnd"'","enable":true}]}'
    }elseif($p-eq"trojan"){
      $s='{"clients":[{"email":"tr1_'"$i$rnd"'@t.com","password":"pw1_'"$i$rnd"'","enable":true},{"email":"tr2_'"$i$rnd"'@t.com","password":"pw2_'"$i$rnd"'","enable":true}]}'
    }elseif($p-eq"hysteria"){
      $s='{"clients":[{"email":"hy1_'"$i$rnd"'@t.com","auth":"auth1_'"$i$rnd"'","enable":true},{"email":"hy2_'"$i$rnd"'@t.com","auth":"auth2_'"$i$rnd"'","enable":true}]}'
    }else{
      $s='{"clients":[{"email":"'"$p"'_1_'"$i$rnd"'@t.com","id":"'"$($vids[($i-1)*2])"'","enable":true},{"email":"'"$p"'_2_'"$i$rnd"'@t.com","id":"'"$($vids[($i-1)*2+1])"'","enable":true}]}'
    }
    $se=$s-replace'"','\"'
    $up=[int64]((Get-Random -Minimum 1 -Maximum 100)*1024*1024*1024)
    $dw=[int64]((Get-Random -Minimum 1 -Maximum 200)*1024*1024*1024)
    $tot=if($i-eq3){0}else{[int64]((Get-Random -Minimum 10 -Maximum 500)*1024*1024*1024)}
    $pl='{"port":'$port',"protocol":"'$p'","settings":"'$se'","remark":"'$p'-'$i'","enable":true,"up":'$up',"down":'$dw',"total":'$tot'}'
    $body=New-Object System.Net.Http.StringContent($pl,[System.Text.Encoding]::UTF8,"application/json")
    $resp=$c.PostAsync("/panel/api/inbounds/add",$body).Result.Content.ReadAsStringAsync().Result
    try{$json=$resp|ConvertFrom-Json;if($json.success){$ttl++;Write-Host "  [OK] $p-$i"}else{Write-Host "  [FAIL] $p-$i"}}catch{Write-Host "  [FAIL] $p-$i"}
    $port+=7
  }
}
Write-Host "Inbounds: $ttl/50"
# Fix enables
$list=$c.GetAsync("/panel/api/inbounds/list").Result.Content.ReadAsStringAsync().Result|ConvertFrom-Json
$bad=$list.obj|Where-Object{$_.enable -eq $false}
if($bad){foreach($ib in $bad){$fb=New-Object System.Net.Http.StringContent('{"enable":true}',[System.Text.Encoding]::UTF8,"application/json");$c.PostAsync("/panel/api/inbounds/setEnable/$($ib.id)",$fb).Result|Out-Null}}
$list2=$c.GetAsync("/panel/api/inbounds/list").Result.Content.ReadAsStringAsync().Result|ConvertFrom-Json
$bc=if($list2.obj|Where-Object{$_.enable -eq $false}){($list2.obj|Where-Object{$_.enable -eq $false}|Measure-Object).Count}else{0}
Write-Host "enable=false: $bc"
# Build client refs from API response
Write-Host "=== Building subs refs ===" -ForegroundColor Cyan
$inbList=($c.GetAsync("/panel/api/inbounds/list").Result.Content.ReadAsStringAsync().Result|ConvertFrom-Json).obj
$refs=@()
for($si=0;$si-lt20;$si++){
  $ib=$inbList|Where-Object{$_.id -eq ($si%50+1)}
  if(!$ib){$refs+="$($si%50+1):1";continue}
  try{$set=$ib.settings|ConvertFrom-Json;$first=$set.clients|Select-Object -First 1;if($first-and$first.clientId){$refs+="$($ib.id):$($first.clientId)"}else{$refs+="$($ib.id):1"}}catch{$refs+="$($ib.id):1"}
}
# Nodes
$nc=0;for($i=1;$i-le20;$i++){$pl='{"name":"Node-'$i'","remark":"node'$i'","scheme":"https","address":"n'$i'.ex.com","port":9300,"apiToken":"tk-n'$i'","enable":true}'
  $b=New-Object System.Net.Http.StringContent($pl,[System.Text.Encoding]::UTF8,"application/json")
  $r=$c.PostAsync("/panel/api/nodes/add",$b).Result.Content.ReadAsStringAsync().Result;try{if(($r|ConvertFrom-Json).success){$nc++}}catch{}}
Write-Host "Nodes: $nc/20"
# Subs
$sc=0;$fmts=@("text","base64","json","clash")
for($i=1;$i-le20;$i++){
  $sid="ts_$("{0:D10}"-f$i)";$fmt=$fmts[($i-1)%4]
  $inbRefs=($refs|Select-Object -First $i)-join','
  $pl='{"subId":"'$sid'","remark":"Sub-'$i'","enable":true,"format":"'$fmt'","updateInterval":12,"inboundIds":"'$inbRefs'"}'
  $b=New-Object System.Net.Http.StringContent($pl,[System.Text.Encoding]::UTF8,"application/json")
  $r=$c.PostAsync("/panel/api/subscription/add",$b).Result.Content.ReadAsStringAsync().Result
  try{$j=$r|ConvertFrom-Json;if($j.success){$sc++;Write-Host "  [OK] Sub-$i ($fmt, $inbRefs)"}else{Write-Host "  [FAIL] Sub-$i: $r"}}catch{Write-Host "  [FAIL] Sub-$i"}}
$c.PostAsync("/panel/api/settings/update",(New-Object System.Net.Http.StringContent('{"key":"subEnable","value":"true"}',[System.Text.Encoding]::UTF8,"application/json"))).Result|Out-Null
Write-Host "Subs: $sc/20"
# Final
$list3=$c.GetAsync("/panel/api/inbounds/list").Result.Content.ReadAsStringAsync().Result|ConvertFrom-Json
$cnt=if($list3.obj){$list3.obj.Count}else{0}
$bad2=$list3.obj|Where-Object{$_.enable -eq $false}
$bc2=if($bad2){($bad2|Measure-Object).Count}else{0}
Write-Host "done: inb $cnt/50 enFalse $bc2 nodes $nc/20 subs $sc/20"
