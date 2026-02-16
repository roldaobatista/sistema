
# Audit detalhada por modulo
$backendPath = "c:\projetos\sistema\backend"
$frontendPath = "c:\projetos\sistema\frontend\src"

# === CONTROLLERS SEM TRY/CATCH (por arquivo) ===
Write-Output "=== CONTROLLERS COM WRITE METHODS ==="
Write-Output "Arquivo | WriteMethods | TryCatch | Transaction"
Write-Output "--------|-------------|----------|------------"

$controllers = Get-ChildItem -Path "$backendPath\app\Http\Controllers" -Recurse -Filter "*.php"
foreach ($f in $controllers) {
    $c = Get-Content $f.FullName -Raw
    $writes = [regex]::Matches($c, 'public function (store|update|destroy|approve|reject|cancel|close|settle|complete)\b')
    if ($writes.Count -gt 0) {
        $hasTry = if ($c -match 'try\s*\{') { "SIM" }else { "NAO" }
        $hasTx = if ($c -match 'DB::(beginTransaction|transaction)') { "SIM" }else { "NAO" }
        Write-Output "$($f.Name) | $($writes.Count) | $hasTry | $hasTx"
    }
}

Write-Output ""
Write-Output "=== PAGINAS SEM EMPTY STATE ==="
$pages = Get-ChildItem -Path "$frontendPath\pages" -Recurse -Filter "*.tsx"
foreach ($page in $pages) {
    $content = Get-Content $page.FullName -Raw
    if ($content -match '(\.map\(|Table|DataTable)' -and $content -notmatch '(empty|vazio|nenhum|Nenhum|no data|No data|length\s*[=!]==?\s*0|\.length\s*<\s*1|EmptyState|Nenhum resultado|Nenhum registro)') {
        Write-Output "  $($page.Name)"
    }
}

Write-Output ""
Write-Output "=== MODELOS SEM FILLABLE ==="
$models = Get-ChildItem -Path "$backendPath\app\Models" -Filter "*.php" | Where-Object { -not $_.PSIsContainer }
foreach ($m in $models) {
    $c = Get-Content $m.FullName -Raw
    if ($c -notmatch '\$fillable') {
        Write-Output "  $($m.Name)"
    }
}

Write-Output ""
Write-Output "=== MODELOS COM TENANT_ID SEM SCOPE ==="
foreach ($m in $models) {
    $c = Get-Content $m.FullName -Raw
    if ($c -match 'tenant_id' -and $c -notmatch '(BelongsToTenant|scopeForTenant|tenant\(\)|HasTenant|bootBelongsToTenant)') {
        Write-Output "  $($m.Name)"
    }
}

Write-Output ""
Write-Output "=== SCORE POR MODULO FRONTEND ==="
$dirs = Get-ChildItem -Path "$frontendPath\pages" -Directory
foreach ($dir in $dirs) {
    $modulePages = Get-ChildItem -Path $dir.FullName -Recurse -Filter "*.tsx"
    $total = $modulePages.Count
    $issues = 0
    
    foreach ($mp in $modulePages) {
        $c = Get-Content $mp.FullName -Raw
        
        # Check loading
        if ($c -match '(useQuery|useFetch|api\.)' -and $c -notmatch '(isLoading|loading|Carregando|Loading|Spinner|skeleton|isFetching)') {
            $issues++
        }
        # Check error
        if ($c -match '(useQuery|useFetch|api\.)' -and $c -notmatch '(isError|error|onError|catch|toast\.error|Error|falha|erro)') {
            $issues++
        }
        # Check empty state
        if ($c -match '(\.map\(|Table)' -and $c -notmatch '(empty|vazio|nenhum|Nenhum|no data|length\s*[=!]==?\s*0|EmptyState|Nenhum resultado)') {
            $issues++
        }
    }
    
    $maxIssues = $total * 3
    if ($maxIssues -eq 0) { $maxIssues = 1 }
    $score = [Math]::Round((($maxIssues - $issues) / $maxIssues) * 100, 0)
    $status = if ($score -ge 90) { "OK" }elseif ($score -ge 70) { "AVISO" }else { "CRITICO" }
    Write-Output "$($dir.Name.PadRight(25)) | $total pgs | Score: $score% | $status | Issues: $issues"
}
