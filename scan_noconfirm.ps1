$pages = Get-ChildItem -Path "c:\projetos\sistema\frontend\src\pages" -Recurse -Filter "*Page.tsx"
$results = @()

foreach ($p in $pages) {
    $content = Get-Content $p.FullName -Raw
    $name = $p.Name -replace '\.tsx', ''
    
    $hasDelete = $content -match 'delete|destroy|remove|Excluir|Trash2|handleDelete'
    $hasMutation = $content -match 'useMutation|\.mutate\(|mutationFn'
    $hasConfirmModal = $content -match 'setDeleteTarget|deleteTarget|deleteConfirm|setConfirmAction|confirmAction|AlertDialog|ConfirmDialog|setDeleting|deleteModal'
    $hasWindowConfirm = $content -match 'window\.confirm\(|confirm\('
    $hasConfirm = $hasConfirmModal -or $hasWindowConfirm
    
    if ($hasDelete -and $hasMutation -and (-not $hasConfirm)) {
        $relPath = $p.FullName.Replace("c:\projetos\sistema\frontend\src\pages\", "")
        $results += "$name|$relPath"
    }
}

Write-Output "PAGES WITHOUT CONFIRM ($($results.Count)):"
$results | Sort-Object | ForEach-Object {
    $parts = $_ -split '\|'
    Write-Output "  $($parts[0]) -> $($parts[1])"
}
