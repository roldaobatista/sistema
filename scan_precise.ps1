$pages = Get-ChildItem -Path "c:\projetos\sistema\frontend\src\pages" -Recurse -Filter "*Page.tsx"
$noConfirm = @()
$noToast = @()
$noEmpty = @()

foreach ($p in $pages) {
    $content = Get-Content $p.FullName -Raw
    $name = $p.Name -replace '\.tsx', ''
    
    # Detect if page HAS delete actions
    $hasDelete = $content -match 'delete|destroy|remove|Excluir|Trash2|handleDelete'
    $hasMutation = $content -match 'useMutation|\.mutate\(|mutationFn'
    
    # Detect CONFIRM patterns (both modal and window.confirm)
    $hasConfirmModal = $content -match 'setDeleteTarget|deleteTarget|deleteConfirm|setConfirmAction|confirmAction|AlertDialog|ConfirmDialog|setDeleting|deleteModal'
    $hasWindowConfirm = $content -match 'window\.confirm\(|confirm\('
    $hasConfirm = $hasConfirmModal -or $hasWindowConfirm
    
    # Missing confirm = has delete action but no confirm pattern
    if ($hasDelete -and $hasMutation -and (-not $hasConfirm)) {
        $noConfirm += $name
    }
    
    # Missing toast
    $hasToast = $content -match 'toast\.'
    if ($hasMutation -and (-not $hasToast)) {
        $noToast += $name
    }
    
    # Missing empty state (exclude forms, login, etc)
    $isList = $content -match 'Table|list|map\(' -and $content -notmatch 'CreatePage|EditPage|LoginPage|ComposePage|ProfilePage'
    $hasEmpty = $content -match 'Nenhum|cadastrad|encontrad|vazio|empty'
    if ($isList -and (-not $hasEmpty)) {
        $noEmpty += $name
    }
}

Write-Output "=== REALMENTE SEM CONFIRM DELETE ($($noConfirm.Count)) ==="
$noConfirm | Sort-Object
Write-Output ""
Write-Output "=== REALMENTE SEM TOAST ($($noToast.Count)) ==="
$noToast | Sort-Object
Write-Output ""
Write-Output "=== REALMENTE SEM EMPTY STATE ($($noEmpty.Count)) ==="
$noEmpty | Sort-Object
