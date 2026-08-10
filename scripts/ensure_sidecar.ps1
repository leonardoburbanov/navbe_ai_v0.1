# Fail (or optionally rebuild) unless a stamped PyInstaller sidecar exists
# and matches the current git HEAD short hash.
#
# Usage:
#   powershell -File scripts/ensure_sidecar.ps1
#   powershell -File scripts/ensure_sidecar.ps1 -Build

param(
  [switch]$Build
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$OutDir = Join-Path $Root "desktop\src-tauri\resources\navbe"
$Exe = Join-Path $OutDir "navbe.exe"
$Stamp = Join-Path $OutDir ".sidecar-stamp"

function Get-CurrentGitShort {
  try {
    $git = (git -C $Root rev-parse --short HEAD 2>$null).Trim()
    if ($git) { return $git }
  } catch { }
  return ""
}

function Get-StampGit {
  if (-not (Test-Path $Stamp)) { return "" }
  foreach ($line in Get-Content $Stamp) {
    if ($line -match '^git=(.+)$') {
      return $Matches[1].Trim()
    }
  }
  return ""
}

function Test-SidecarPresent {
  return (Test-Path $Exe) -and (Test-Path $Stamp)
}

function Test-SidecarFresh {
  if (-not (Test-SidecarPresent)) { return $false }
  $head = Get-CurrentGitShort
  # No git (detached export / CI without .git): presence is enough.
  if (-not $head) { return $true }
  $stamped = Get-StampGit
  return $stamped -eq $head
}

function Invoke-SidecarBuild {
  param([string]$Reason)
  Write-Host "Sidecar $Reason - running build_sidecar.ps1..."
  & (Join-Path $PSScriptRoot "build_sidecar.ps1")
  if (-not (Test-SidecarPresent)) {
    throw "build_sidecar.ps1 finished but stamp/exe still missing under $OutDir"
  }
  if (-not (Test-SidecarFresh)) {
    $head = Get-CurrentGitShort
    $stamped = Get-StampGit
    throw "sidecar still stale after rebuild (stamp git=$stamped, HEAD=$head)"
  }
}

if (Test-SidecarFresh) {
  Write-Host "Sidecar OK: $Exe"
  Get-Content $Stamp | ForEach-Object { Write-Host "  $_" }
  exit 0
}

$head = Get-CurrentGitShort
$stamped = Get-StampGit
$reason = if (-not (Test-SidecarPresent)) {
  "missing"
} else {
  "stale (stamp git=$stamped, HEAD=$head)"
}

if ($Build) {
  Invoke-SidecarBuild -Reason $reason
  Write-Host "Sidecar OK: $Exe"
  Get-Content $Stamp | ForEach-Object { Write-Host "  $_" }
  exit 0
}

Write-Error "Navbe desktop sidecar $reason. Expected $Exe stamped for HEAD=$head. Run: powershell -File scripts/build_sidecar.ps1 (or: pnpm run tauri:build in desktop/)"
exit 1
