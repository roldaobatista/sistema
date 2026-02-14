$names = @(
    'AutomationPage', 'BatchExportPage', 'CustomerMergePage', 'EmailInboxPage',
    'InmetroLeadsPage', 'InmetroMapPage', 'OnboardingPage', 'PaymentsPage',
    'QuoteCreatePage', 'QuoteDetailPage', 'QuoteEditPage', 'SettingsPage',
    'StockIntegrationPage', 'TechSealsPage', 'WorkOrderCreatePage'
)

$pages = Get-ChildItem -Path "c:\projetos\sistema\frontend\src\pages" -Recurse -Filter "*Page.tsx"

foreach ($p in $pages) {
    $pname = $p.Name -replace '\.tsx', ''
    if ($names -notcontains $pname) { continue }
    
    $content = Get-Content $p.FullName -Raw
    $lineNum = 0
    $deleteLines = @()
    
    foreach ($line in (Get-Content $p.FullName)) {
        $lineNum++
        if ($line -match 'delete|destroy|remove|Trash2|Excluir' -and $line -match 'onClick|click|handle') {
            $deleteLines += "  L$lineNum : $($line.Trim().Substring(0, [Math]::Min(120, $line.Trim().Length)))"
        }
    }
    
    if ($deleteLines.Count -gt 0) {
        Write-Output "$pname ($($p.FullName)):"
        $deleteLines | ForEach-Object { Write-Output $_ }
        Write-Output ""
    }
    else {
        Write-Output "$pname : NO onClick+delete pattern found (may use other pattern)"
        Write-Output ""
    }
}
