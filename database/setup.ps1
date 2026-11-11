# =====================================================================
#  setup.ps1 -- (re)build the SLMS database on local Oracle XE 11g
#  Usage (from this folder):   powershell -ExecutionPolicy Bypass -File .\setup.ps1
#        add -SkipUser to keep the SLMS user and only rebuild objects + data
# =====================================================================
param([switch]$SkipUser)

$ErrorActionPreference = 'Stop'
$sqlplus = 'C:\oraclexe\app\oracle\product\11.2.0\server\bin\sqlplus.exe'
$conn    = 'slms/slms_dev_2026@localhost:1521/XE'
Set-Location $PSScriptRoot

function Invoke-Sql([string]$login, [string]$file) {
  Write-Host ">> $file" -ForegroundColor Magenta
  & $sqlplus -S -L $login "@$file"
  if ($LASTEXITCODE -ne 0) { throw "$file failed (exit $LASTEXITCODE)" }
}

if (-not $SkipUser) { Invoke-Sql '/ as sysdba' '00_create_user.sql' }
foreach ($f in '01_schema.sql', '02_logic.sql', '03_seed.sql', '99_verify.sql') {
  Invoke-Sql $conn $f
}
Write-Host 'Database ready.' -ForegroundColor Magenta
