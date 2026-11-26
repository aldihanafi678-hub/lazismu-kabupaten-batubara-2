$ErrorActionPreference = "Stop"
$port = 4173
$subject = "CN=localhost"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Klik kanan setup-https.bat, lalu pilih 'Run as administrator'."
}

$existing = Get-ChildItem Cert:\LocalMachine\My |
  Where-Object { $_.Subject -eq $subject -and $_.DnsNameList -contains "localhost" } |
  Sort-Object NotAfter -Descending |
  Select-Object -First 1

if ($existing) {
  $certificate = $existing
} else {
  $certificate = New-SelfSignedCertificate `
    -DnsName "localhost", "127.0.0.1" `
    -CertStoreLocation "Cert:\LocalMachine\My" `
    -FriendlyName "Lazismu Kabupaten Batu Bara - Local HTTPS" `
    -NotAfter (Get-Date).AddYears(2)
}

$thumbprint = $certificate.Thumbprint
$destination = "0.0.0.0:$port"

netsh http delete sslcert ipport=$destination *> $null
$result = netsh http add sslcert ipport=$destination certhash=$thumbprint appid="{efde3780-94aa-4a7e-bda1-3c39e7457743}"
if ($LASTEXITCODE -ne 0) {
  throw "Binding sertifikat HTTPS gagal."
}

$rootStore = Get-Item "Cert:\LocalMachine\Root"
$alreadyTrusted = Get-ChildItem "Cert:\LocalMachine\Root" |
  Where-Object { $_.Thumbprint -eq $thumbprint }
if (-not $alreadyTrusted) {
  Copy-Item -LiteralPath $certificate.PSPath -Destination $rootStore.PSPath
}

Write-Host "HTTPS lokal berhasil disiapkan."
Write-Host "Alamat: https://localhost:$port"
