# Aggressive toast fix for remaining 16 pages  
# Strategy: Find useMutation blocks without onSuccess/toast and add toast calls
$targetNames = @(
    'AdvancedFeaturesPage', 'AuvoImportPage', 'BatchExportPage', 'EmailComposePage',
    'EmailInboxPage', 'EquipmentCreatePage', 'EquipmentListPage', 'FuelingLogsPage',
    'HRPage', 'InmetroCompetitorPage', 'InmetroCompliancePage', 'InmetroMapPage',
    'InmetroProspectionPage', 'InmetroWebhooksPage', 'OrgChartPage', 'SkillsMatrixPage'
)

$pages = Get-ChildItem -Path "c:\projetos\sistema\frontend\src\pages" -Recurse -Filter "*Page.tsx"
$fixed = 0

foreach ($p in $pages) {
    $name = $p.Name -replace '\.tsx', ''
    if ($targetNames -notcontains $name) { continue }
    
    $content = Get-Content $p.FullName -Raw
    $original = $content
    
    # Ensure toast import exists
    $hasToastImport = $content -match "from\s*'sonner'"
    if (-not $hasToastImport) {
        # Already should have been added by previous script, but check
        $content = "import { toast } from 'sonner'`n" + $content
    }
    
    # Strategy: Add onSuccess with toast where useMutation has no onSuccess
    # Pattern: useMutation({ mutationFn: ... }) without onSuccess
    $content = [regex]::Replace($content,
        "(useMutation\(\{[^}]*mutationFn:[^}]+)(}\))",
        "`$1, onSuccess: () => toast.success('Operação realizada com sucesso'), onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro na operação')`$2",
        'Singleline')
    
    if ($content -ne $original) {
        Set-Content -Path $p.FullName -Value $content -NoNewline -Encoding UTF8
        $fixed++
        Write-Output "FIXED: $name"
    }
    else {
        Write-Output "SKIP: $name (complex pattern)"
    }
}

Write-Output "`nTotal fixed: $fixed"
