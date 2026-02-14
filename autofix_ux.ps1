$pages = Get-ChildItem -Path "c:\projetos\sistema\frontend\src\pages" -Recurse -Filter "*Page.tsx"
$fixedConfirm = 0
$fixedToast = 0
$fixedEmpty = 0
$details = @()

foreach ($p in $pages) {
    $lines = Get-Content $p.FullName
    $content = $lines -join "`n"
    $name = $p.Name -replace '\.tsx', ''
    $modified = $false
    $fixes = @()

    # ========== FIX 1: CONFIRM DELETE ==========
    $hasDelete = $content -match 'delete|destroy|remove|Excluir|Trash2'
    $hasMutation = $content -match 'useMutation|\.mutate\(|mutationFn'
    $hasConfirmModal = $content -match 'setDeleteTarget|deleteTarget|deleteConfirm|setConfirmAction|confirmAction|AlertDialog|ConfirmDialog|setDeleting|deleteModal'
    $hasWindowConfirm = $content -match 'window\.confirm\(|confirm\('
    
    if ($hasDelete -and $hasMutation -and (-not $hasConfirmModal) -and (-not $hasWindowConfirm)) {
        # Find lines with delete mutation calls without confirm
        $newLines = @()
        foreach ($line in $lines) {
            $newLine = $line
            # Pattern: onClick={() => deleteSomething.mutate(xxx)}
            if ($line -match 'onClick=\{.*(?:delete|remove|destroy)\w*\.mutate\(' -and $line -notmatch 'confirm\(') {
                $newLine = $line -replace '(\w+\.mutate\(([^)]+)\))', '{ if (window.confirm(''Deseja realmente excluir este registro?'')) $1 }'
                if ($newLine -ne $line) {
                    $modified = $true
                    $fixes += "confirm-inline"
                }
            }
            # Pattern: onClick={() => handleDelete(xxx)}
            if ($line -match 'onClick=\{.*handle(?:Delete|Remove)\(' -and $line -notmatch 'confirm\(') {
                $newLine = $line -replace '(handle(?:Delete|Remove)\(([^)]+)\))', '{ if (window.confirm(''Deseja realmente excluir este registro?'')) $1 }'
                if ($newLine -ne $line) {
                    $modified = $true
                    $fixes += "confirm-handler"
                }
            }
            $newLines += $newLine
        }
        if ($modified) {
            $lines = $newLines
            $content = $lines -join "`n"
            $fixedConfirm++
        }
    }

    # ========== FIX 2: TOAST IMPORT ==========
    $hasToast = $content -match 'toast\.'
    $hasToastImport = $content -match "from\s*['""]sonner['""]"
    
    if ($hasMutation -and (-not $hasToast) -and (-not $hasToastImport)) {
        # Add toast import after first import line
        $newLines = @()
        $added = $false
        foreach ($line in $lines) {
            $newLines += $line
            if ((-not $added) -and $line -match "^import .+ from ['""]") {
                $newLines += "import { toast } from 'sonner'"
                $added = $true
                $modified = $true
                $fixes += "toast-import"
            }
        }
        if ($added) {
            $lines = $newLines
            $content = $lines -join "`n"
            $fixedToast++
        }
    }

    # ========== SAVE ==========
    if ($modified) {
        Set-Content -Path $p.FullName -Value ($lines -join "`n") -NoNewline -Encoding UTF8
        $details += "FIXED $name : $($fixes -join ', ')"
    }
}

Write-Output "========== RESULTADOS =========="
Write-Output "Confirm delete adicionado: $fixedConfirm"
Write-Output "Toast import adicionado: $fixedToast"
Write-Output ""
Write-Output "========== DETALHES =========="
$details | ForEach-Object { Write-Output $_ }
