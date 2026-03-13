<# 
 GRID Kiosk-Startscript (Windows, PowerShell)
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# >>> EDIT HERE <<<
$Url = "http://grid-kiosk.local"    
$KeepAlive = $true                  
$AllowInsecureFlags = $false      

# Browser-Paths
$BrowserPaths = @(
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
  "C:\Program Files\Chromium\Application\chrome.exe"
)

$Browser = $BrowserPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Browser) {
  Write-Error "no supported Browser found (chrome/chromium/edge). please install."
}

# Basis-Flags 
$Flags = @(
  "--kiosk",
  "--start-fullscreen",
  "--incognito",
  "--no-first-run",
  "--disable-session-crashed-bubble",
  "--disable-infobars",
  "--disable-features=TranslateUI,ChromeWhatsNewUI,PasswordManagerOnboarding",
  "--autoplay-policy=no-user-gesture-required",
  "--hide-crash-restore-bubble"
)

# unsafe stuff (optional)
if ($AllowInsecureFlags) {
  $Flags += @(
    "--allow-running-insecure-content", 
    "--ignore-certificate-errors",     
    "--allow-insecure-localhost"     
  )
}

function Start-Kiosk {
  Write-Host "Star Browser: $Browser $($Flags -join ' ') $Url"
  $p = Start-Process -FilePath $Browser -ArgumentList @($Flags + @("$Url")) -PassThru
  return $p
}

if ($KeepAlive) {
  while ($true) {
    $proc = Start-Kiosk
    try { Wait-Process -Id $proc.Id } catch {}
    Start-Sleep -Seconds 2
  }
} else {
  Start-Kiosk | Out-Null
}
