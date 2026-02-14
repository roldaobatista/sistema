# More aggressive toast fix - target pages that still need it
# Also handles cases where mutations use hooks that wrap useMutation
$pages = Get-ChildItem -Path "c:\projetos\sistema\frontend\src\pages" -Recurse -Filter "*Page.tsx"
$noToast = @()

foreach ($p in $pages) {
    $content = Get-Content $p.FullName -Raw
    $name = $p.Name -replace '\.tsx', ''
    
    $hasMutation = $content -match 'useMutation|\.mutate\(|mutationFn'
    $hasToast = $content -match 'toast\.\w+\('
    
    if ($hasMutation -and (-not $hasToast)) {
        $noToast += $name
    }
}

Write-Output "Still without toast ($($noToast.Count)):"
$noToast | Sort-Object
