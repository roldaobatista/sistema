# Check: do these 13 remaining pages really have a destructive action?
$names = @(
    'AutomationPage', 'BatchExportPage', 'CustomerMergePage', 'EmailInboxPage',
    'InmetroLeadsPage', 'InmetroMapPage', 'OnboardingPage', 'PaymentsPage',
    'QuoteDetailPage', 'QuoteEditPage', 'SettingsPage',
    'StockIntegrationPage', 'TechSealsPage'
)

$pages = Get-ChildItem -Path "c:\projetos\sistema\frontend\src\pages" -Recurse -Filter "*Page.tsx"

foreach ($p in $pages) {
    $pname = $p.Name -replace '\.tsx', ''
    if ($names -notcontains $pname) { continue }
    
    $content = Get-Content $p.FullName -Raw
    
    # Check for actual API delete calls
    $hasApiDelete = $content -match 'api\.delete|\.delete\(|method.*DELETE|destroy'
    $hasTrash = $content -match 'Trash2|trash'
    $hasRemoveState = $content -match 'removeItem|splice|filter.*!='
    
    $reasons = @()
    if ($hasApiDelete) { $reasons += "API-DELETE" }
    if ($hasTrash) { $reasons += "TRASH-ICON" }
    if ($hasRemoveState) { $reasons += "STATE-REMOVE" }
    
    $verdict = if ($hasApiDelete -or $hasTrash) { "NEEDS-CONFIRM" } elseif ($hasRemoveState) { "UI-ONLY" } else { "NO-DELETE" }
    
    Write-Output "${verdict}: $pname [$($reasons -join ', ')]"
}
