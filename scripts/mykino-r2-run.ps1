[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $Arguments
)

$ErrorActionPreference = "Stop"

function Find-Repo {
  $candidates = @()
  if ($env:MYKINO_REPO) { $candidates += $env:MYKINO_REPO }
  $candidates += (Get-Location).Path
  $candidates += (Join-Path $env:USERPROFILE "mykino")
  $candidates += (Join-Path $env:USERPROFILE "Desktop\mykino")
  $candidates += (Join-Path $env:USERPROFILE "Desktop\kino tg_bot")
  $candidates += (Join-Path $env:USERPROFILE "Documents\mykino")

  foreach ($candidate in ($candidates | Select-Object -Unique)) {
    if (-not $candidate) { continue }
    try {
      $resolved = (Resolve-Path $candidate -ErrorAction Stop).Path
      if (Test-Path (Join-Path $resolved "package.json") -PathType Leaf) {
        return $resolved
      }
    } catch { }
  }
  throw "mykino repo topilmadi. MYKINO_REPO ni repo papkasiga o'rnating: `$env:MYKINO_REPO = 'C:\\Users\\Siz\\Desktop\\mykino'"
}

function Import-EnvFile([string] $Path) {
  if (-not (Test-Path $Path -PathType Leaf)) { return }
  foreach ($line in Get-Content -LiteralPath $Path) {
    $text = [string]$line
    if (-not $text.Trim() -or $text.TrimStart().StartsWith('#')) { continue }
    $match = [regex]::Match($text, '^\s*([^#=\s]+)\s*=\s*(.*)\s*$')
    if (-not $match.Success) { continue }
    $name = $match.Groups[1].Value
    $value = $match.Groups[2].Value.Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

$repo = Find-Repo
$home = $env:USERPROFILE
# Repo .env birinchi, alohida lokal R2 fayli esa uning ustidan keladi.
Import-EnvFile (Join-Path $repo '.env')
Import-EnvFile (Join-Path $repo '.mykino-r2.env')
Import-EnvFile (Join-Path $home '.mykino-r2.env')

# Eski kompyuterdagi service-account JSON fayl nomlash usulini ham qo'llab-quvvatlaydi.
$serviceAccountCandidates = @(
  (Join-Path $home '.mykino-sa.json'),
  (Join-Path $repo '.mykino-sa.json')
)
foreach ($jsonPath in $serviceAccountCandidates) {
  if ((Test-Path $jsonPath -PathType Leaf) -and -not $env:GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64) {
    $env:GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($jsonPath))
    break
  }
}

foreach ($name in @('R2_BUCKET','R2_ENDPOINT','R2_PUBLIC_URL','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','GOOGLE_DRIVE_FOLDER_ID')) {
  if (-not ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name)))) { continue }
  throw "$name sozlanmagan. Repo .env yoki $home\\.mykino-r2.env fayliga qo'shing. Secretlarni GitHub'ga yuklamang."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js topilmadi.' }
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { throw 'ffmpeg PATH da topilmadi. Windows uchun ffmpeg o''rnating.' }
if (-not (Get-Command ffprobe -ErrorAction SilentlyContinue)) { throw 'ffprobe PATH da topilmadi. ffmpeg paketining PATH sozlamasini tekshiring.' }

$package = Get-Content (Join-Path $repo 'package.json') -Raw | ConvertFrom-Json
$hasAws = $false
if ($package.dependencies) { $hasAws = [bool]($package.dependencies.'@aws-sdk/client-s3' -and $package.dependencies.'@aws-sdk/lib-storage') }
if (-not $hasAws) { throw 'R2 SDK dependency topilmadi. GitHub repo yangilanganini tekshiring.' }

Push-Location $repo
try {
  & npm run migrate:r2 -- @Arguments
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}
