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
  $candidates += "C:\Users\dosto\.gemini\antigravity\scratch\mykino"
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
  throw "mykino repo topilmadi. MYKINO_REPO ni repo papkasiga o'rnating: `$env:MYKINO_REPO = 'C:\Users\dosto\.gemini\antigravity\scratch\mykino'"
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
$userHome = $env:USERPROFILE

# Asboblarni (Node, ffmpeg) standart va lokal yo'llardan qidirish
$possibleToolPaths = @(
  "$userHome\tools\node",
  "$userHome\tools\ffmpeg\bin",
  "$userHome\tools\ffmpeg",
  "C:\Program Files\nodejs",
  "C:\ffmpeg\bin",
  "C:\ffmpeg",
  "$env:LOCALAPPDATA\Programs\node"
)
foreach ($tp in $possibleToolPaths) {
  if ((Test-Path $tp) -and ($env:PATH -notlike "*$tp*")) {
    $env:PATH = "$tp;$env:PATH"
  }
}

# Repo .env birinchi, alohida lokal R2 fayli esa uning ustidan keladi.
Import-EnvFile (Join-Path $repo '.env')
Import-EnvFile (Join-Path $repo '.mykino-r2.env')
Import-EnvFile (Join-Path $userHome '.mykino-r2.env')

# Eski kompyuterdagi service-account JSON fayl nomlash usulini ham qo'llab-quvvatlaydi.
$serviceAccountCandidates = @(
  (Join-Path $userHome '.mykino-sa.json'),
  (Join-Path $repo '.mykino-sa.json')
)
foreach ($jsonPath in $serviceAccountCandidates) {
  if ((Test-Path $jsonPath -PathType Leaf) -and -not $env:GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64) {
    $env:GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($jsonPath))
    break
  }
}

$missingVars = @()
foreach ($name in @('R2_BUCKET','R2_ENDPOINT','R2_PUBLIC_URL','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','GOOGLE_DRIVE_FOLDER_ID')) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
    $missingVars += $name
  }
}

if ($missingVars.Count -gt 0) {
  Write-Host "XATO: Quyidagi R2 o'zgaruvchilari sozlanmagan: $($missingVars -join ', ')" -ForegroundColor Red
  Write-Host "`nUlarni $userHome\.mykino-r2.env fayliga quyidagi ko'rinishda kiriting:" -ForegroundColor Yellow
  Write-Host "R2_BUCKET=mykino" -ForegroundColor Gray
  Write-Host "R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com" -ForegroundColor Gray
  Write-Host "R2_PUBLIC_URL=https://pub-42c7619e0f49402bb099364c0b589eca.r2.dev" -ForegroundColor Gray
  Write-Host "R2_ACCESS_KEY_ID=<SIZNING_ACCESS_KEY>" -ForegroundColor Gray
  Write-Host "R2_SECRET_ACCESS_KEY=<SIZNING_SECRET_KEY>`n" -ForegroundColor Gray
  throw "R2 konfiguratsiyasi to'liq emas."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js topilmadi. Iltimos, https://nodejs.org dan Node.js (LTS) o''rnating.'
}
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  throw 'ffmpeg PATH da topilmadi. Videolarni MP4 formatga o''tkazish uchun ffmpeg o''rnatilishi shart.'
}
if (-not (Get-Command ffprobe -ErrorAction SilentlyContinue)) {
  throw 'ffprobe PATH da topilmadi. ffmpeg paketining PATH sozlamasini tekshiring.'
}

$hasAws = (Test-Path (Join-Path $repo 'node_modules\@aws-sdk\client-s3'))
if (-not $hasAws) {
  if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "R2 SDK paketlari o'rnatilmoqda (npm install)..." -ForegroundColor Cyan
    Push-Location $repo
    try { & npm install } finally { Pop-Location }
    $hasAws = (Test-Path (Join-Path $repo 'node_modules\@aws-sdk\client-s3'))
  }
  if (-not $hasAws) {
    throw "R2 SDK kutubxonalari topilmadi. Repoda 'npm install' buyrug'ini ishga tushiring."
  }
}

Push-Location $repo
try {
  if (Get-Command npm -ErrorAction SilentlyContinue) {
    & npm run migrate:r2 -- @Arguments
  } else {
    & node scripts/migrate-to-r2.js @Arguments
  }
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}
