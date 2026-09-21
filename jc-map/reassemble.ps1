$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$parts = Get-ChildItem -Path '.\chunks\JC_Map_Part_2.zip.*.part' | Sort-Object Name
$out = Join-Path $PSScriptRoot 'JC_Map_Part_2.zip'
$dest = [System.IO.File]::Create($out)
try {
  foreach ($part in $parts) {
    $bytes = [System.IO.File]::ReadAllBytes($part.FullName)
    $dest.Write($bytes, 0, $bytes.Length)
  }
} finally {
  $dest.Dispose()
}
$expected = ((Get-Content '.\source.sha256') -split '\s+')[0].ToLower()
$actual = (Get-FileHash $out -Algorithm SHA256).Hash.ToLower()
if ($actual -ne $expected) { throw "SHA256 mismatch: expected $expected got $actual" }
Write-Host "Reassembled and verified: $out"
