param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("Encrypt", "Decrypt")]
    [string]$Mode,

    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [Parameter(Mandatory = $true)]
    [string]$KeyPath,

    [switch]$DeleteInput
)

$ErrorActionPreference = "Stop"
$magic = [System.Text.Encoding]::ASCII.GetBytes("HD01")
$nonceLength = 12
$tagLength = 16

function Get-PlainTextFromSecureString {
    param([System.Security.SecureString]$SecureValue)

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Get-OrCreateKey {
    param(
        [string]$Path,
        [bool]$Create
    )

    if (Test-Path -LiteralPath $Path) {
        $protected = (Get-Content -Raw -LiteralPath $Path).Trim()
        $secure = ConvertTo-SecureString -String $protected
        $base64 = Get-PlainTextFromSecureString -SecureValue $secure
        return [Convert]::FromBase64String($base64)
    }

    if (-not $Create) {
        throw "No existe la clave cifrada requerida: $Path"
    }

    $keyDirectory = Split-Path -Parent $Path
    if ($keyDirectory) {
        New-Item -ItemType Directory -Path $keyDirectory -Force | Out-Null
    }

    $key = [byte[]]::new(32)
    [Security.Cryptography.RandomNumberGenerator]::Fill($key)
    $base64 = [Convert]::ToBase64String($key)
    $secure = ConvertTo-SecureString -String $base64 -AsPlainText -Force
    $protected = ConvertFrom-SecureString -SecureString $secure
    Set-Content -LiteralPath $Path -Value $protected -NoNewline
    return $key
}

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $resolvedOutput
if ($outputDirectory) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$key = Get-OrCreateKey -Path $KeyPath -Create ($Mode -eq "Encrypt")

try {
    if ($Mode -eq "Encrypt") {
        $plainText = [IO.File]::ReadAllBytes($resolvedInput)
        $nonce = [byte[]]::new($nonceLength)
        $tag = [byte[]]::new($tagLength)
        $cipherText = [byte[]]::new($plainText.Length)
        [Security.Cryptography.RandomNumberGenerator]::Fill($nonce)

        $aes = [Security.Cryptography.AesGcm]::new($key, $tagLength)
        try {
            $aes.Encrypt($nonce, $plainText, $cipherText, $tag)
        }
        finally {
            $aes.Dispose()
        }

        $stream = [IO.File]::Open(
            $resolvedOutput,
            [IO.FileMode]::CreateNew,
            [IO.FileAccess]::Write,
            [IO.FileShare]::None
        )
        try {
            $stream.Write($magic)
            $stream.Write($nonce)
            $stream.Write($tag)
            $stream.Write($cipherText)
        }
        finally {
            $stream.Dispose()
        }

        $verified = [byte[]]::new($plainText.Length)
        $verifyAes = [Security.Cryptography.AesGcm]::new($key, $tagLength)
        try {
            $verifyAes.Decrypt($nonce, $cipherText, $tag, $verified)
        }
        finally {
            $verifyAes.Dispose()
        }

        if (-not [Security.Cryptography.CryptographicOperations]::FixedTimeEquals(
            $plainText,
            $verified
        )) {
            throw "La verificación criptográfica del archivo falló."
        }

        $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedOutput).Hash
        if ($DeleteInput) {
            Remove-Item -LiteralPath $resolvedInput -Force
        }

        [Array]::Clear($verified)
        [Array]::Clear($plainText)
        [Array]::Clear($cipherText)

        [pscustomobject]@{
            Mode = "Encrypt"
            OutputPath = $resolvedOutput
            Sha256 = $hash
            InputDeleted = -not (Test-Path -LiteralPath $resolvedInput)
        }
    }
    else {
        $payload = [IO.File]::ReadAllBytes($resolvedInput)
        $minimumLength = $magic.Length + $nonceLength + $tagLength
        if ($payload.Length -lt $minimumLength) {
            throw "El archivo cifrado está incompleto."
        }

        [byte[]]$actualMagic = $payload[0..($magic.Length - 1)]
        if (-not [Security.Cryptography.CryptographicOperations]::FixedTimeEquals(
            $magic,
            $actualMagic
        )) {
            throw "El archivo no tiene el formato de respaldo esperado."
        }

        $offset = $magic.Length
        [byte[]]$nonce = $payload[$offset..($offset + $nonceLength - 1)]
        $offset += $nonceLength
        [byte[]]$tag = $payload[$offset..($offset + $tagLength - 1)]
        $offset += $tagLength
        [byte[]]$cipherText = $payload[$offset..($payload.Length - 1)]
        $plainText = [byte[]]::new($cipherText.Length)

        $aes = [Security.Cryptography.AesGcm]::new($key, $tagLength)
        try {
            $aes.Decrypt($nonce, $cipherText, $tag, $plainText)
        }
        finally {
            $aes.Dispose()
        }

        [IO.File]::WriteAllBytes($resolvedOutput, $plainText)
        $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedOutput).Hash
        if ($DeleteInput) {
            Remove-Item -LiteralPath $resolvedInput -Force
        }

        [Array]::Clear($plainText)
        [Array]::Clear($cipherText)
        [Array]::Clear($payload)

        [pscustomobject]@{
            Mode = "Decrypt"
            OutputPath = $resolvedOutput
            Sha256 = $hash
            InputDeleted = -not (Test-Path -LiteralPath $resolvedInput)
        }
    }
}
finally {
    [Array]::Clear($key)
}
