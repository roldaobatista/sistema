$dirs = @('src\pages\tech', 'src\components\tech', 'src\components\os', 'src\components\layout', 'src\components\common', 'src\components\pwa', 'src\pages\configuracoes', 'src\pages\financeiro', 'src\pages\fiscal', 'src\pages\crm', 'src\pages\clientes', 'src\pages\estoque', 'src\pages\orcamentos', 'src\pages\os', 'src\pages\importacao', 'src\pages\relatorios', 'src\pages\certificados', 'src\pages\analytics', 'src\pages\contratos', 'src\pages')
$alreadyFixed = @('TechShell.tsx', 'FloatingTimer.tsx', 'TechAlertBanner.tsx', 'TechChatDrawer.tsx', 'TechSkeleton.tsx')
$totalFiles = 0
$totalReplacements = 0

foreach ($dir in $dirs) {
    $fullDir = Join-Path $PSScriptRoot $dir
    if (!(Test-Path $fullDir)) { continue }
    $files = Get-ChildItem -Path $fullDir -Filter '*.tsx' -File
    foreach ($f in $files) {
        if ($alreadyFixed -contains $f.Name) { continue }
        $content = Get-Content $f.FullName -Raw
        if ($null -eq $content) { continue }
        $original = $content
        
        # Pattern 1: bg-white dark:bg-surface-900 -> bg-card
        $content = $content -replace 'bg-white dark:bg-surface-900', 'bg-card'
        
        # Pattern 2: bg-white dark:bg-surface-800/80 -> bg-card
        $content = $content -replace 'bg-white dark:bg-surface-800/80', 'bg-card'
        
        # Pattern 3: bg-white dark:bg-surface-800 -> bg-card (only exact, not /80)
        $content = $content -replace 'bg-white dark:bg-surface-800(?!/)', 'bg-card'
        
        # Pattern 4: bg-white dark:bg-surface-950 -> bg-background
        $content = $content -replace 'bg-white dark:bg-surface-950', 'bg-background'
        
        # Pattern 5: border-surface-200 dark:border-surface-700 -> border-border
        $content = $content -replace 'border-surface-200 dark:border-surface-700', 'border-border'
        
        # Pattern 6: border-surface-200 dark:border-surface-800 -> border-border
        $content = $content -replace 'border-surface-200 dark:border-surface-800', 'border-border'
        
        # Pattern 7: text-surface-900 dark:text-surface-50 -> text-foreground
        $content = $content -replace 'text-surface-900 dark:text-surface-50', 'text-foreground'
        
        # Pattern 8: text-surface-900 dark:text-surface-100 -> text-foreground
        $content = $content -replace 'text-surface-900 dark:text-surface-100', 'text-foreground'
        
        if ($content -ne $original) {
            Set-Content $f.FullName $content -NoNewline
            $replacements = 0
            $diff = Compare-Object ($original -split "`n") ($content -split "`n")
            $replacements = ($diff | Where-Object { $_.SideIndicator -eq '<=' }).Count
            $totalReplacements += $replacements
            $totalFiles++
            Write-Host "Fixed: $($f.Name) ($replacements lines)"
        }
    }
}

Write-Host "`nTotal: $totalFiles files, ~$totalReplacements replacements"
