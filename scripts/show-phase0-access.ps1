param(
  [string]$SecretDirectory = (Join-Path $PSScriptRoot '..\.phase0-secrets')
)

$userPath = Join-Path $SecretDirectory 'app-access-user.txt'
$passwordPath = Join-Path $SecretDirectory 'app-access-password.dpapi'

if (-not (Test-Path -LiteralPath $userPath) -or
    -not (Test-Path -LiteralPath $passwordPath)) {
  throw "No se encontraron las credenciales locales de Fase 0."
}

$protectedBytes = [Convert]::FromBase64String(
  (Get-Content -Raw -LiteralPath $passwordPath)
)
$plainBytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
  $protectedBytes,
  $null,
  [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)

Write-Output "Usuario: $(Get-Content -Raw -LiteralPath $userPath)"
Write-Output "Contraseña: $([Text.Encoding]::UTF8.GetString($plainBytes))"
