
# ============================================================
# KALIBRIUM ERP - Auditoria MVP Completa (Código Real)
# ============================================================
# Este script analisa o código-fonte real para identificar:
# 1. Controllers com métodos vazios/TODO
# 2. Controllers sem try/catch em métodos de escrita
# 3. Controllers sem DB::transaction em store/update
# 4. Páginas frontend sem loading state
# 5. Páginas frontend sem error state
# 6. Páginas frontend sem empty state (listas vazias)
# 7. Formulários sem validação/feedback
# 8. Rotas sem controller correspondente
# ============================================================

$backendPath = "c:\projetos\sistema\backend"
$frontendPath = "c:\projetos\sistema\frontend\src"
$results = @()
$totalChecks = 0
$passedChecks = 0

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  KALIBRIUM ERP - AUDITORIA MVP (CODIGO REAL)" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# BACKEND AUDIT
# ============================================================
Write-Host ">>> FASE 1: AUDITORIA BACKEND <<<" -ForegroundColor Yellow
Write-Host ""

# 1. Verificar controllers com métodos vazios ou TODO
Write-Host "  [1/8] Verificando controllers com metodos vazios/TODO..." -ForegroundColor White
$controllers = Get-ChildItem -Path "$backendPath\app\Http\Controllers" -Recurse -Filter "*.php"
$emptyMethods = @()
$todoMethods = @()
$noTryCatch = @()
$noTransaction = @()

foreach ($ctrl in $controllers) {
    $content = Get-Content $ctrl.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    
    # Detectar TODO/FIXME/HACK
    $todoMatches = [regex]::Matches($content, '(TODO|FIXME|HACK|XXX|STUB)[:\s].*')
    foreach ($m in $todoMatches) {
        $todoMethods += [PSCustomObject]@{
            File = $ctrl.Name
            Issue = $m.Value.Trim().Substring(0, [Math]::Min(80, $m.Value.Trim().Length))
        }
    }
    
    # Detectar métodos de escrita (store, update, destroy) sem try/catch
    $writeMethods = [regex]::Matches($content, 'public function (store|update|destroy|create|delete|approve|reject|cancel|complete|close|settle)\b[^{]*\{')
    foreach ($wm in $writeMethods) {
        $methodName = $wm.Groups[1].Value
        $startIdx = $wm.Index + $wm.Length
        # Pegar próximos 500 chars do corpo do método
        $bodySnippet = $content.Substring($startIdx, [Math]::Min(500, $content.Length - $startIdx))
        
        if ($bodySnippet -notmatch 'try\s*\{') {
            $noTryCatch += [PSCustomObject]@{
                File = $ctrl.Name
                Method = $methodName
            }
        }
        
        if ($bodySnippet -notmatch '(DB::beginTransaction|DB::transaction)') {
            $noTransaction += [PSCustomObject]@{
                File = $ctrl.Name
                Method = $methodName
            }
        }
    }
    
    # Detectar métodos vazios (corpo com apenas return ou comentário)
    $allMethods = [regex]::Matches($content, 'public function (\w+)\([^)]*\)[^{]*\{([^}]{0,60})\}')
    foreach ($am in $allMethods) {
        $body = $am.Groups[2].Value.Trim()
        if ($body -match '^\s*(//.*)?$' -or $body -eq '' -or $body -match '^\s*return\s*;\s*$') {
            $emptyMethods += [PSCustomObject]@{
                File = $ctrl.Name
                Method = $am.Groups[1].Value
            }
        }
    }
}

$totalChecks += $controllers.Count
if ($emptyMethods.Count -eq 0) { $passedChecks += $controllers.Count }
else { $passedChecks += ($controllers.Count - ($emptyMethods | Select-Object -ExpandProperty File -Unique).Count) }

Write-Host "    Metodos vazios: $($emptyMethods.Count)" -ForegroundColor $(if($emptyMethods.Count -gt 0){"Red"}else{"Green"})
if ($emptyMethods.Count -gt 0) {
    $emptyMethods | Group-Object File | ForEach-Object {
        Write-Host "      $($_.Name): $($_.Group.Method -join ', ')" -ForegroundColor DarkRed
    }
}

Write-Host "    TODOs/FIXMEs encontrados: $($todoMethods.Count)" -ForegroundColor $(if($todoMethods.Count -gt 0){"Yellow"}else{"Green"})
if ($todoMethods.Count -gt 0 -and $todoMethods.Count -le 20) {
    $todoMethods | ForEach-Object { Write-Host "      $($_.File): $($_.Issue)" -ForegroundColor DarkYellow }
}

# 2. Verificar FormRequests
Write-Host ""
Write-Host "  [2/8] Verificando FormRequests (validacao backend)..." -ForegroundColor White
$requests = Get-ChildItem -Path "$backendPath\app\Http\Requests" -Recurse -Filter "*.php" -ErrorAction SilentlyContinue
$emptyRequests = @()
if ($requests) {
    foreach ($req in $requests) {
        $content = Get-Content $req.FullName -Raw -ErrorAction SilentlyContinue
        if ($content -and $content -match 'public function rules') {
            $rulesMatch = [regex]::Match($content, 'public function rules[^{]*\{([^}]*)\}')
            if ($rulesMatch.Success) {
                $rulesBody = $rulesMatch.Groups[1].Value.Trim()
                if ($rulesBody -match 'return\s*\[\s*\]\s*;' -or $rulesBody -eq '') {
                    $emptyRequests += $req.Name
                }
            }
        }
    }
}
Write-Host "    FormRequests encontrados: $($requests.Count)" -ForegroundColor Cyan
Write-Host "    FormRequests com regras vazias: $($emptyRequests.Count)" -ForegroundColor $(if($emptyRequests.Count -gt 0){"Red"}else{"Green"})

# 3. Verificar Models sem fillable
Write-Host ""
Write-Host "  [3/8] Verificando Models (fillable, relationships, tenant)..." -ForegroundColor White
$models = Get-ChildItem -Path "$backendPath\app\Models" -Filter "*.php" -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer }
$noFillable = @()
$noTenantScope = @()
$noRelations = @()

foreach ($model in $models) {
    $content = Get-Content $model.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    
    if ($content -notmatch '\$fillable') {
        $noFillable += $model.Name
    }
    
    # Verificar se tem tenant_id mas não tem BelongsToTenant/scope
    if ($content -match 'tenant_id' -and $content -notmatch '(BelongsToTenant|scopeForTenant|tenant\(\)|HasTenant)') {
        $noTenantScope += $model.Name
    }
    
    # Verificar se tem algum relationship
    if ($content -notmatch '(belongsTo|hasMany|hasOne|belongsToMany|morphTo|morphMany)\s*\(') {
        $noRelations += $model.Name
    }
}

Write-Host "    Models total: $($models.Count)" -ForegroundColor Cyan
Write-Host "    Sem fillable: $($noFillable.Count)" -ForegroundColor $(if($noFillable.Count -gt 5){"Red"}elseif($noFillable.Count -gt 0){"Yellow"}else{"Green"})
Write-Host "    Com tenant_id sem scope: $($noTenantScope.Count)" -ForegroundColor $(if($noTenantScope.Count -gt 0){"Yellow"}else{"Green"})
Write-Host "    Sem relationships: $($noRelations.Count)" -ForegroundColor $(if($noRelations.Count -gt 10){"Yellow"}else{"Green"})

# 4. Verificar write methods sem try/catch
Write-Host ""
Write-Host "  [4/8] Verificando metodos de escrita sem try/catch..." -ForegroundColor White
Write-Host "    Metodos sem try/catch: $($noTryCatch.Count)" -ForegroundColor $(if($noTryCatch.Count -gt 10){"Red"}elseif($noTryCatch.Count -gt 0){"Yellow"}else{"Green"})
if ($noTryCatch.Count -gt 0 -and $noTryCatch.Count -le 30) {
    $noTryCatch | Group-Object File | ForEach-Object {
        Write-Host "      $($_.Name): $($_.Group.Method -join ', ')" -ForegroundColor DarkYellow
    }
} elseif ($noTryCatch.Count -gt 30) {
    Write-Host "      (muitos para listar - mostrando top 15)" -ForegroundColor DarkYellow
    $noTryCatch | Group-Object File | Select-Object -First 15 | ForEach-Object {
        Write-Host "      $($_.Name): $($_.Group.Method -join ', ')" -ForegroundColor DarkYellow
    }
}

Write-Host ""
Write-Host "  [5/8] Verificando metodos de escrita sem DB::transaction..." -ForegroundColor White
Write-Host "    Metodos sem transaction: $($noTransaction.Count)" -ForegroundColor $(if($noTransaction.Count -gt 20){"Red"}elseif($noTransaction.Count -gt 0){"Yellow"}else{"Green"})

# ============================================================
# FRONTEND AUDIT
# ============================================================
Write-Host ""
Write-Host ">>> FASE 2: AUDITORIA FRONTEND <<<" -ForegroundColor Yellow
Write-Host ""

# 6. Verificar páginas de listagem
Write-Host "  [6/8] Verificando paginas frontend (loading/error/empty states)..." -ForegroundColor White
$pages = Get-ChildItem -Path "$frontendPath\pages" -Recurse -Filter "*.tsx"
$noLoading = @()
$noErrorState = @()
$noEmptyState = @()
$noToast = @()

foreach ($page in $pages) {
    $content = Get-Content $page.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    
    # Verificar loading state
    if ($content -match '(useQuery|useFetch|api\.(get|post))' -and $content -notmatch '(isLoading|loading|Carregando|Loading|Spinner|skeleton|isFetching)') {
        $noLoading += $page.Name
    }
    
    # Verificar error state em páginas que fazem fetch
    if ($content -match '(useQuery|useFetch|api\.(get|post))' -and $content -notmatch '(isError|error|onError|catch|toast\.error|Error|falha|erro)') {
        $noErrorState += $page.Name
    }
    
    # Verificar empty state em listagens
    if ($content -match '(\.map\(|table|Table|DataTable|lista)' -and $content -notmatch '(empty|vazio|nenhum|Nenhum|no data|No data|length\s*[=!]==?\s*0|\.length\s*<\s*1|EmptyState)') {
        $noEmptyState += $page.Name
    }
    
    # Verificar toast/feedback em mutações
    if ($content -match '(useMutation|\.post\(|\.put\(|\.delete\()' -and $content -notmatch '(toast|Toast|alert|Alert|sucesso|success|feedback|Snackbar)') {
        $noToast += $page.Name
    }
}

Write-Host "    Paginas analisadas: $($pages.Count)" -ForegroundColor Cyan
Write-Host "    Sem loading state: $($noLoading.Count)" -ForegroundColor $(if($noLoading.Count -gt 5){"Red"}elseif($noLoading.Count -gt 0){"Yellow"}else{"Green"})
if ($noLoading.Count -gt 0 -and $noLoading.Count -le 15) {
    $noLoading | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
}
Write-Host "    Sem error state: $($noErrorState.Count)" -ForegroundColor $(if($noErrorState.Count -gt 5){"Red"}elseif($noErrorState.Count -gt 0){"Yellow"}else{"Green"})
if ($noErrorState.Count -gt 0 -and $noErrorState.Count -le 15) {
    $noErrorState | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
}
Write-Host "    Sem empty state: $($noEmptyState.Count)" -ForegroundColor $(if($noEmptyState.Count -gt 5){"Red"}elseif($noEmptyState.Count -gt 0){"Yellow"}else{"Green"})
if ($noEmptyState.Count -gt 0 -and $noEmptyState.Count -le 15) {
    $noEmptyState | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
}
Write-Host "    Sem toast/feedback: $($noToast.Count)" -ForegroundColor $(if($noToast.Count -gt 5){"Red"}elseif($noToast.Count -gt 0){"Yellow"}else{"Green"})
if ($noToast.Count -gt 0 -and $noToast.Count -le 15) {
    $noToast | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
}

# 7. Verificar formulários
Write-Host ""
Write-Host "  [7/8] Verificando formularios (validacao frontend)..." -ForegroundColor White
$forms = Get-ChildItem -Path "$frontendPath" -Recurse -Filter "*.tsx" | Where-Object { $_.Name -match '(Form|Modal|Dialog|Create|Edit|New)' }
$noFormValidation = @()
$noSubmitDisable = @()

foreach ($form in $forms) {
    $content = Get-Content $form.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    
    # Verificar se tem algum schema/validação
    if ($content -match '(onSubmit|handleSubmit|form\.submit)' -and $content -notmatch '(zod|yup|validate|validation|required|schema|errors|setError|formState)') {
        $noFormValidation += $form.Name
    }
    
    # Verificar se desabilita botão durante submit
    if ($content -match '(type="submit"|type=.submit)' -and $content -notmatch '(disabled|isPending|isSubmitting|isLoading|submitting)') {
        $noSubmitDisable += $form.Name
    }
}

Write-Host "    Formularios analisados: $($forms.Count)" -ForegroundColor Cyan
Write-Host "    Sem validacao: $($noFormValidation.Count)" -ForegroundColor $(if($noFormValidation.Count -gt 0){"Red"}else{"Green"})
if ($noFormValidation.Count -gt 0 -and $noFormValidation.Count -le 15) {
    $noFormValidation | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
}
Write-Host "    Sem disable no submit: $($noSubmitDisable.Count)" -ForegroundColor $(if($noSubmitDisable.Count -gt 0){"Yellow"}else{"Green"})

# 8. Verificar delete sem confirmação
Write-Host ""
Write-Host "  [8/8] Verificando deletes sem confirmacao..." -ForegroundColor White
$allTsx = Get-ChildItem -Path "$frontendPath\pages" -Recurse -Filter "*.tsx"
$noDeleteConfirm = @()

foreach ($tsx in $allTsx) {
    $content = Get-Content $tsx.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    
    if ($content -match '(\.delete\(|handleDelete|onDelete|excluir|remover)' -and $content -notmatch '(confirm|Confirm|Dialog|dialog|AlertDialog|modal|Modal|confirmacao)') {
        $noDeleteConfirm += $tsx.Name
    }
}

Write-Host "    Deletes sem confirmacao: $($noDeleteConfirm.Count)" -ForegroundColor $(if($noDeleteConfirm.Count -gt 0){"Red"}else{"Green"})
if ($noDeleteConfirm.Count -gt 0 -and $noDeleteConfirm.Count -le 15) {
    $noDeleteConfirm | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkYellow }
}

# ============================================================
# CROSS-CHECK: Frontend <-> Backend
# ============================================================
Write-Host ""
Write-Host ">>> FASE 3: CROSS-CHECK FRONTEND <-> BACKEND <<<" -ForegroundColor Yellow
Write-Host ""

# Verificar se existem hooks/api calls que chamam endpoints existentes
$apiFiles = Get-ChildItem -Path "$frontendPath" -Recurse -Filter "*.ts" | Where-Object { $_.Name -match '(api|hook|service|Api)' -and $_.Name -notmatch '\.d\.ts$' }
Write-Host "  Arquivos de API/hooks no frontend: $($apiFiles.Count)" -ForegroundColor Cyan

# Verificar se páginas importam componentes que existem
$missingImports = @()
foreach ($page in $pages) {
    $content = Get-Content $page.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    
    $imports = [regex]::Matches($content, "from\s+'([^']+)'")
    foreach ($imp in $imports) {
        $importPath = $imp.Groups[1].Value
        if ($importPath -match '^\.\/' -or $importPath -match '^\.\.\/' ) {
            # Relative import - verificar se existe
            $dir = Split-Path $page.FullName
            $resolved = Join-Path $dir $importPath
            $resolved = $resolved -replace '/', '\'
            
            $exists = (Test-Path "$resolved.tsx") -or (Test-Path "$resolved.ts") -or (Test-Path "$resolved\index.tsx") -or (Test-Path "$resolved\index.ts")
            if (-not $exists) {
                $missingImports += [PSCustomObject]@{
                    Page = $page.Name
                    Import = $importPath
                }
            }
        }
    }
}

Write-Host "  Imports relativos quebrados: $($missingImports.Count)" -ForegroundColor $(if($missingImports.Count -gt 0){"Red"}else{"Green"})
if ($missingImports.Count -gt 0 -and $missingImports.Count -le 20) {
    $missingImports | ForEach-Object { Write-Host "    $($_.Page) -> $($_.Import)" -ForegroundColor DarkRed }
}

# ============================================================
# RESUMO / SCORE
# ============================================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  RESUMO DA AUDITORIA MVP" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Calcular score
$issues = @{
    "Metodos vazios (backend)" = $emptyMethods.Count
    "TODOs/FIXMEs pendentes" = $todoMethods.Count
    "FormRequests vazios" = $emptyRequests.Count
    "Models sem fillable" = $noFillable.Count
    "Models sem tenant scope" = $noTenantScope.Count
    "Write methods sem try/catch" = $noTryCatch.Count
    "Write methods sem transaction" = $noTransaction.Count
    "Paginas sem loading state" = $noLoading.Count
    "Paginas sem error state" = $noErrorState.Count
    "Paginas sem empty state" = $noEmptyState.Count
    "Paginas sem toast/feedback" = $noToast.Count
    "Forms sem validacao" = $noFormValidation.Count
    "Forms sem disable submit" = $noSubmitDisable.Count
    "Deletes sem confirmacao" = $noDeleteConfirm.Count
    "Imports quebrados" = $missingImports.Count
}

$criticalIssues = 0
$warningIssues = 0
$totalIssueCount = 0

Write-Host "  CATEGORIA                          | QTD   | STATUS" -ForegroundColor White
Write-Host "  -----------------------------------|-------|-------" -ForegroundColor White

foreach ($issue in $issues.GetEnumerator() | Sort-Object Value -Descending) {
    $count = $issue.Value
    $totalIssueCount += $count
    
    if ($count -eq 0) {
        $status = "OK"
        $color = "Green"
    } elseif ($count -le 5) {
        $status = "AVISO"
        $color = "Yellow"
        $warningIssues++
    } else {
        $status = "CRITICO"
        $color = "Red"
        $criticalIssues++
    }
    
    $name = $issue.Key.PadRight(37)
    $countStr = "$count".PadRight(7)
    Write-Host "  $name| $countStr| $status" -ForegroundColor $color
}

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan

$totalCategories = $issues.Count
$okCategories = ($issues.Values | Where-Object { $_ -eq 0 }).Count
$score = [Math]::Round(($okCategories / $totalCategories) * 100, 0)

Write-Host "  Total de categorias: $totalCategories" -ForegroundColor White
Write-Host "  Categorias OK: $okCategories / $totalCategories" -ForegroundColor $(if($okCategories -eq $totalCategories){"Green"}else{"Yellow"})
Write-Host "  Categorias com avisos: $warningIssues" -ForegroundColor $(if($warningIssues -gt 0){"Yellow"}else{"Green"})
Write-Host "  Categorias criticas: $criticalIssues" -ForegroundColor $(if($criticalIssues -gt 0){"Red"}else{"Green"})
Write-Host "  Total de issues encontradas: $totalIssueCount" -ForegroundColor $(if($totalIssueCount -gt 50){"Red"}elseif($totalIssueCount -gt 0){"Yellow"}else{"Green"})
Write-Host ""

if ($score -ge 80) {
    Write-Host "  SCORE MVP: $score% - BOM (poucos ajustes necessarios)" -ForegroundColor Green
} elseif ($score -ge 50) {
    Write-Host "  SCORE MVP: $score% - MEDIO (ajustes importantes pendentes)" -ForegroundColor Yellow
} else {
    Write-Host "  SCORE MVP: $score% - BAIXO (precisa trabalho significativo)" -ForegroundColor Red
}

Write-Host ""
Write-Host "  CONCLUSAO:" -ForegroundColor Cyan
if ($criticalIssues -eq 0 -and $warningIssues -le 3) {
    Write-Host "  Sistema PRONTO para producao com pequenos ajustes." -ForegroundColor Green
} elseif ($criticalIssues -le 3) {
    Write-Host "  Sistema QUASE pronto. Corrigir issues criticas antes de producao." -ForegroundColor Yellow
} else {
    Write-Host "  Sistema NAO esta pronto. Precisa correcoes antes de producao." -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Auditoria completa em $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
