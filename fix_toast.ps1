# Fix toast.success/error in mutations that don't have toast feedback
$pages = Get-ChildItem -Path "c:\projetos\sistema\frontend\src\pages" -Recurse -Filter "*Page.tsx"
$fixed = 0
$details = @()

foreach ($p in $pages) {
    $content = Get-Content $p.FullName -Raw
    $name = $p.Name -replace '\.tsx', ''
    $original = $content
    
    $hasMutation = $content -match 'useMutation'
    $hasToastCalls = $content -match 'toast\.\w+\('
    
    if (-not $hasMutation) { continue }
    if ($hasToastCalls) { continue }
    
    # Check if has toast import, add if not
    $hasToastImport = $content -match "import\s*\{[^}]*toast[^}]*\}\s*from\s*['""]sonner['""]"
    if (-not $hasToastImport) {
        # Check if sonner import exists but without toast
        if ($content -match "from\s*['""]sonner['""]") {
            # Already has sonner import, just need to verify toast is in it
        }
        else {
            # Add toast import after first import
            $content = $content -replace "(import [^\n]+\n)", "`$1import { toast } from 'sonner'`n", 1
        }
    }
    
    # Add toast.success to onSuccess callbacks that don't have toast
    $content = [regex]::Replace($content, 
        "(onSuccess:\s*\(\)\s*=>\s*\{)(\s*(?!toast))",
        "`$1`n            toast.success('Operação realizada com sucesso')`$2")
    
    # Add toast.error to onError callbacks that don't have toast
    $content = [regex]::Replace($content,
        "(onError:\s*\([^)]*\)\s*=>\s*\{)(\s*(?!toast))",
        "`$1`n            toast.error('Ocorreu um erro. Tente novamente.')`$2")
    
    # For simple arrow functions: onSuccess: () => queryClient.invalidate...
    # Add toast after the arrow but before the expression
    $content = [regex]::Replace($content,
        "(onSuccess:\s*\(\)\s*=>\s*)(queryClient|qc|refetch)",
        "`$1{ toast.success('Operação realizada com sucesso'); `$2")
    
    if ($content -ne $original) {
        Set-Content -Path $p.FullName -Value $content -NoNewline -Encoding UTF8
        $fixed++
        $details += "FIXED-TOAST: $name"
    }
}

Write-Output "Toast fixes applied: $fixed"
$details | ForEach-Object { Write-Output $_ }
