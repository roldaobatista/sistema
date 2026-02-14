# Script para fix confirm + toast.success/error de forma mais agressiva
$names = @(
    'AutomationPage', 'BatchExportPage', 'CustomerMergePage', 'EmailInboxPage',
    'InmetroLeadsPage', 'InmetroMapPage', 'OnboardingPage', 'PaymentsPage',
    'QuoteCreatePage', 'QuoteDetailPage', 'QuoteEditPage', 'SettingsPage',
    'StockIntegrationPage', 'TechSealsPage', 'WorkOrderCreatePage'
)

$pages = Get-ChildItem -Path "c:\projetos\sistema\frontend\src\pages" -Recurse -Filter "*Page.tsx"
$fixed = 0

foreach ($p in $pages) {
    $pname = $p.Name -replace '\.tsx', ''
    if ($names -notcontains $pname) { continue }
    
    $content = Get-Content $p.FullName -Raw
    $original = $content
    
    # Broader patterns for confirm - also catch handleRemove, removeItem etc
    # Pattern 1: onClick={() => someFunc.mutate()} without confirm
    $content = [regex]::Replace($content, 
        '(onClick=\{\(\)\s*=>\s*)((?:delete|remove|destroy|cancel)\w*\.mutate\(([^)]+)\))(\s*\})', 
        '$1{ if (window.confirm(''Deseja realmente excluir?'')) $2 }$4',
        'IgnoreCase')
    
    # Pattern 2: onClick={() => handleX(y)} for delete/remove handlers
    $content = [regex]::Replace($content, 
        '(onClick=\{\(\)\s*=>\s*)((?:handleDelete|handleRemove|removeItem|onDelete)\(([^)]+)\))(\s*\})',
        '$1{ if (window.confirm(''Deseja realmente excluir?'')) $2 }$4',
        'IgnoreCase')
    
    if ($content -ne $original) {
        Set-Content -Path $p.FullName -Value $content -NoNewline -Encoding UTF8
        $fixed++
        Write-Output "FIXED-CONFIRM: $pname"
    }
    else {
        Write-Output "SKIP: $pname (no matching pattern or already fixed)"
    }
}

Write-Output ""
Write-Output "Total fixed: $fixed"
