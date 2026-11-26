$port = 4173
$root = $PSScriptRoot
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("https://127.0.0.1:$port/")
$adminToken = [guid]::NewGuid().ToString("N")

function Send-Json {
  param([System.Net.HttpListenerContext]$Context, [object]$Data, [int]$StatusCode = 200)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($Data | ConvertTo-Json -Depth 10))
  $Context.Response.StatusCode = $StatusCode
  $Context.Response.ContentType = "application/json; charset=utf-8"
  $Context.Response.ContentLength64 = $bytes.Length
  $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Context.Response.OutputStream.Close()
}

function Read-RequestJson {
  param([System.Net.HttpListenerRequest]$Request)
  $reader = [System.IO.StreamReader]::new($Request.InputStream, $Request.ContentEncoding)
  $text = $reader.ReadToEnd()
  $reader.Close()
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }
  return $text | ConvertFrom-Json
}

$listener.Start()
Write-Host "Lazismu Batubara siap di https://localhost:$port"
Write-Host "Tekan Ctrl+C untuk menghentikan server."

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    try {
      if ($request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -eq "/api/login") {
        $data = Read-RequestJson $request
        if ($data.id -eq "26112026" -and $data.password -eq "26112026") {
          Send-Json $context @{ ok = $true; token = $adminToken }
        } else {
          Send-Json $context @{ ok = $false; error = "ID atau password pengurus tidak sesuai." } 401
        }
        continue
      }

      if ($request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -eq "/api/content") {
        if ($request.Headers["X-Admin-Token"] -ne $adminToken) { Send-Json $context @{ ok = $false; error = "Sesi pengurus tidak valid." } 401; continue }
        $data = Read-RequestJson $request
        $json = $data | ConvertTo-Json -Depth 5
        [System.IO.File]::WriteAllText((Join-Path $root "config.json"), $json, [System.Text.UTF8Encoding]::new($false))
        Send-Json $context @{ ok = $true }
        continue
      }

      if ($request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -eq "/api/documentation") {
        if ($request.Headers["X-Admin-Token"] -ne $adminToken) { Send-Json $context @{ ok = $false; error = "Silakan login sebagai pengurus." } 401; continue }
        $data = Read-RequestJson $request
        $path = Join-Path $root "documentation.json"
        $items = if (Test-Path $path) { Get-Content $path -Raw | ConvertFrom-Json } else { @() }
        if ($null -eq $items) { $items = @() } elseif ($items -isnot [System.Array]) { $items = @($items) }
        $items = @($items) + $data
        if ($items.Count -gt 12) { $items = $items[($items.Count - 12)..($items.Count - 1)] }
        [System.IO.File]::WriteAllText($path, ($items | ConvertTo-Json -Depth 5), [System.Text.UTF8Encoding]::new($false))
        Send-Json $context @{ ok = $true }
        continue
      }

      if ($request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath -eq "/api/documentation") {
        $path = Join-Path $root "documentation.json"
        $items = if (Test-Path $path) { Get-Content $path -Raw | ConvertFrom-Json } else { @() }
        Send-Json $context $items
        continue
      }

      $relative = $request.Url.AbsolutePath.TrimStart("/").Replace("/", "\")
      if ([string]::IsNullOrWhiteSpace($relative)) { $relative = "index.html" }
      $file = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
      if (-not $file.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $file -PathType Leaf)) {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
        $response.StatusCode = 404
        $response.ContentType = "text/plain; charset=utf-8"
      } else {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $response.StatusCode = 200
        $extension = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
        $response.ContentType = switch ($extension) {
          ".html" { "text/html; charset=utf-8" }
          ".css" { "text/css; charset=utf-8" }
          ".js" { "application/javascript; charset=utf-8" }
          ".json" { "application/json; charset=utf-8" }
          ".jpg" { "image/jpeg" }
          ".jpeg" { "image/jpeg" }
          ".png" { "image/png" }
          ".webp" { "image/webp" }
          default { "application/octet-stream" }
        }
      }
      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
      $response.OutputStream.Close()
    } catch {
      Send-Json $context @{ ok = $false; error = $_.Exception.Message } 500
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
