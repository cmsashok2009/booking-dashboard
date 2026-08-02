param(
  [string]$AdminEmail = "admin@example.com",
  [string]$AdminName = "System Administrator"
)

$target = Join-Path (Split-Path $PSScriptRoot -Parent) ".env.docker"
if (Test-Path -LiteralPath $target) {
  throw ".env.docker already exists. Remove it explicitly before generating a replacement."
}

function RandomBase64([int]$bytes) {
  $value = New-Object byte[] $bytes
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($value) } finally { $generator.Dispose() }
  [Convert]::ToBase64String($value)
}

function RandomHex([int]$bytes) {
  $value = New-Object byte[] $bytes
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($value) } finally { $generator.Dispose() }
  ([BitConverter]::ToString($value) -replace "-", "").ToLowerInvariant()
}

$adminPassword = "Bd!" + (RandomBase64 18).Replace("/", "A").Replace("+", "b")
$content = @"
APP_PORT=3000
APP_URL=http://localhost:3000
SESSION_COOKIE_SECURE=false
MYSQL_PASSWORD=$(RandomBase64 32)
MYSQL_ROOT_PASSWORD=$(RandomBase64 32)
DATA_ENCRYPTION_KEY=$(RandomHex 32)
TOKEN_ENCRYPTION_KEY=$(RandomBase64 32)
INITIAL_ADMIN_NAME=$AdminName
INITIAL_ADMIN_EMAIL=$AdminEmail
INITIAL_ADMIN_PASSWORD=$adminPassword
"@
[IO.File]::WriteAllText($target, $content, [Text.UTF8Encoding]::new($false))
Write-Output "Created .env.docker. Open that local ignored file to retrieve the one-time administrator password."