# Tiny static web server for local development.
# Serves this folder at http://localhost:<port>/ and opens the browser.
# Usage: double-click start.bat (game) or start_test.bat (tests), or run:
#   powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8000] [-NoBrowser] [-OpenPath tests/test.html]
# Stop it with Ctrl+C or by closing the window.

param(
    [int]$Port = 8000,
    [switch]$NoBrowser,
    [string]$OpenPath = ""   # page to open in the browser, relative to this folder
)

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".js"   = "text/javascript; charset=utf-8"
    ".mjs"  = "text/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".txt"  = "text/plain; charset=utf-8"
    ".md"   = "text/plain; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
}

# Find a free port, starting at $Port
$listener = $null
for ($p = $Port; $p -lt $Port + 20; $p++) {
    $candidate = New-Object System.Net.HttpListener
    $candidate.Prefixes.Add("http://localhost:$p/")
    try {
        $candidate.Start()
        $listener = $candidate
        $Port = $p
        break
    } catch {
        $candidate.Close()
    }
}
if ($null -eq $listener) {
    Write-Host "Could not find a free port between $Port and $($Port + 19)." -ForegroundColor Red
    exit 1
}

$url = "http://localhost:$Port/"
Write-Host "Serving $root"
Write-Host "Open $url  (tests: ${url}tests/test.html)" -ForegroundColor Green
Write-Host "Press Ctrl+C or close this window to stop."
if (-not $NoBrowser) { Start-Process ($url + $OpenPath.TrimStart("/")) }

function Send-Response($ctx, [int]$status, [byte[]]$body, [string]$type) {
    $res = $ctx.Response
    $res.StatusCode = $status
    $res.ContentType = $type
    # Never cache, so edits show up on a normal refresh
    $res.Headers.Add("Cache-Control", "no-store")
    $res.ContentLength64 = $body.Length
    $res.OutputStream.Write($body, 0, $body.Length)
    $res.OutputStream.Close()
}

try {
    while ($listener.IsListening) {
        # Poll the async call so Ctrl+C can interrupt between requests
        $task = $listener.GetContextAsync()
        while (-not $task.AsyncWaitHandle.WaitOne(250)) { }
        $ctx = $task.GetAwaiter().GetResult()

        try {
            $relPath = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart("/")
            if ($relPath -eq "" -or $relPath.EndsWith("/")) { $relPath = $relPath + "index.html" }
            $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $relPath))

            if (-not $fullPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
                Send-Response $ctx 403 ([System.Text.Encoding]::UTF8.GetBytes("Forbidden")) "text/plain"
            } elseif ($ctx.Request.HttpMethod -eq "PUT") {
                # The only file that may be written is the test snapshot file (from tests/test.html "Record")
                if ($relPath -ne "tests/snapshots.json") {
                    Send-Response $ctx 403 ([System.Text.Encoding]::UTF8.GetBytes("Only tests/snapshots.json can be written")) "text/plain"
                } else {
                    $reader = New-Object System.IO.StreamReader($ctx.Request.InputStream, [System.Text.Encoding]::UTF8)
                    $body = $reader.ReadToEnd()
                    $reader.Close()
                    [System.IO.File]::WriteAllText($fullPath, $body, (New-Object System.Text.UTF8Encoding($false)))
                    Send-Response $ctx 200 ([System.Text.Encoding]::UTF8.GetBytes("Saved")) "text/plain"
                }
            } elseif (Test-Path -LiteralPath $fullPath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
                $type = $mime[$ext]
                if ($null -eq $type) { $type = "application/octet-stream" }
                Send-Response $ctx 200 ([System.IO.File]::ReadAllBytes($fullPath)) $type
            } else {
                Send-Response $ctx 404 ([System.Text.Encoding]::UTF8.GetBytes("Not found: $relPath")) "text/plain"
            }
            Write-Host ("{0} {1} {2}" -f $ctx.Response.StatusCode, $ctx.Request.HttpMethod, $ctx.Request.Url.AbsolutePath)
        } catch {
            Write-Host "Error serving request: $_" -ForegroundColor Red
            try { $ctx.Response.Abort() } catch { }
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
