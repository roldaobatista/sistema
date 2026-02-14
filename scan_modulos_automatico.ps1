param(
    [string]$BackendRoutesFile = "",
    [string]$FrontendEndpointsFile = "frontend/frontend-endpoints.json",
    [string]$FrontendPagesRoot = "frontend/src/pages",
    [string]$OutputDir = "reports/auto-scan"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function To-StatusSymbol {
    param([bool]$Value)
    if ($Value) { return "OK" }
    return "NOK"
}

function To-MarkdownSymbol {
    param([string]$Value)
    if ($Value -eq "OK") { return "✅" }
    return "❌"
}

function Escape-MarkdownCell {
    param([string]$Value)

    if ($null -eq $Value) {
        return ""
    }

    $escaped = $Value.Replace("|", "\|")
    $escaped = $escaped -replace "`r?`n", "<br>"
    return $escaped
}

function Normalize-Path {
    param([string]$RawPath)

    if ([string]::IsNullOrWhiteSpace($RawPath)) {
        return ""
    }

    $path = $RawPath.Trim()
    $path = $path -replace "\\", "/"
    $path = $path -replace "^https?://[^/]+", ""
    $path = $path -replace "\?.*$", ""
    $path = $path -replace "^/?api/v1", ""
    $path = $path -replace '\$\{[^}]+\}', ':id'
    $path = $path -replace "\{[^/]+\}", ":id"
    $path = $path -replace ":[A-Za-z_][A-Za-z0-9_]*", ":id"
    $path = $path -replace "/+", "/"

    if (-not $path.StartsWith("/")) {
        $path = "/$path"
    }

    if ($path.Length -gt 1) {
        $path = $path.TrimEnd("/")
    }

    return $path
}

function Normalize-FileKey {
    param([string]$RawPath)

    if ([string]::IsNullOrWhiteSpace($RawPath)) {
        return ""
    }

    $value = $RawPath.Replace("\", "/")
    $value = $value.TrimStart(".")
    $value = $value.TrimStart("/")
    return $value.ToLowerInvariant()
}

function Split-Segments {
    param([string]$Path)

    $trimmed = $Path.Trim("/")
    if ([string]::IsNullOrWhiteSpace($trimmed)) {
        return @()
    }
    return @($trimmed.Split("/"))
}

function Test-PathMatch {
    param(
        [string]$FrontendPath,
        [string]$BackendPath
    )

    if ([string]::IsNullOrWhiteSpace($FrontendPath) -or [string]::IsNullOrWhiteSpace($BackendPath)) {
        return $false
    }

    $frontSegments = @(Split-Segments -Path $FrontendPath)
    $backSegments = @(Split-Segments -Path $BackendPath)

    if ($frontSegments.Count -ne $backSegments.Count) {
        return $false
    }

    for ($index = 0; $index -lt $frontSegments.Count; $index++) {
        $frontSegment = $frontSegments[$index]
        $backSegment = $backSegments[$index]

        if ($frontSegment -eq $backSegment) {
            continue
        }

        if ($frontSegment -eq ":id" -or $backSegment -eq ":id") {
            continue
        }

        return $false
    }

    return $true
}

function Get-ControllerFile {
    param([string]$ControllerAction)

    if ([string]::IsNullOrWhiteSpace($ControllerAction) -or ($ControllerAction -notmatch "@")) {
        return ""
    }

    $controllerNamespace = ($ControllerAction -split "@")[0]
    if ($controllerNamespace -notmatch '^App\\') {
        return ""
    }

    $relativePath = $controllerNamespace.Substring(4).Replace("\", "/") + ".php"
    return Join-Path "backend/app" $relativePath
}

function Get-ModuleKey {
    param(
        [string]$PageRelativePath,
        [array]$Endpoints
    )

    $firstSegments = @()
    foreach ($endpoint in $Endpoints) {
        $normalizedPath = Normalize-Path -RawPath ([string]$endpoint.Path)
        if ([string]::IsNullOrWhiteSpace($normalizedPath) -or $normalizedPath -eq "/") {
            continue
        }

        $segments = @(Split-Segments -Path $normalizedPath)
        if ($segments.Count -gt 0) {
            $firstSegments += $segments[0]
        }
    }

    if ($firstSegments.Count -gt 0) {
        return ($firstSegments | Group-Object | Sort-Object Count -Descending | Select-Object -First 1 -ExpandProperty Name)
    }

    $normalizedPage = $PageRelativePath.Replace("\", "/")
    $filename = [System.IO.Path]::GetFileNameWithoutExtension($normalizedPage)
    $folder = [System.IO.Path]::GetDirectoryName($normalizedPage)

    $entityName = $filename -replace "Page$", ""
    $entityName = $entityName -replace "(Create|Edit|List|Detail|Dashboard|Management|Calendar|Execution|Settings|Rules|Compose|Inbox|Outbox|Profile|Matrix)$", ""
    $entityName = $entityName -creplace "([a-z0-9])([A-Z])", '$1-$2'
    $entityName = $entityName.ToLowerInvariant()

    if ([string]::IsNullOrWhiteSpace($folder)) {
        return $entityName
    }

    return ($folder.Replace("\", "/").ToLowerInvariant() + "/" + $entityName)
}

if ([string]::IsNullOrWhiteSpace($BackendRoutesFile)) {
    if (Test-Path "backend/route-current.json") {
        $BackendRoutesFile = "backend/route-current.json"
    } elseif (Test-Path "backend/route-list.json") {
        $BackendRoutesFile = "backend/route-list.json"
    } else {
        throw "Arquivo de rotas do backend não encontrado."
    }
}

if (-not (Test-Path $BackendRoutesFile)) {
    throw "Arquivo de rotas do backend não encontrado: $BackendRoutesFile"
}

if (-not (Test-Path $FrontendPagesRoot)) {
    throw "Diretório de páginas do frontend não encontrado: $FrontendPagesRoot"
}

$backendRaw = Get-Content -Path $BackendRoutesFile -Raw
$backendRoutes = @()
if (-not [string]::IsNullOrWhiteSpace($backendRaw)) {
    $backendRoutes = @(($backendRaw | ConvertFrom-Json))
}

$backendRouteEntries = @()
$backendByMethod = @{}

foreach ($route in $backendRoutes) {
    $uri = [string]$route.uri
    if (-not $uri.StartsWith("api/v1/")) {
        continue
    }

    $methods = @((([string]$route.method) -split "\|") | Where-Object { $_ -and $_ -notin @("HEAD", "OPTIONS") })
    if ($methods.Count -eq 0) {
        continue
    }

    $normalizedPath = Normalize-Path -RawPath $uri
    $action = [string]$route.action
    $controllerFile = Get-ControllerFile -ControllerAction $action
    $permissions = @()
    if ($null -ne $route.middleware) {
        $permissions = @($route.middleware | Where-Object { [string]$_ -match "CheckPermission:" } | ForEach-Object { ([string]$_) -replace ".*CheckPermission:", "" })
    }

    foreach ($method in $methods) {
        $entry = [PSCustomObject]@{
            Method = $method.ToUpperInvariant()
            Path = $normalizedPath
            Action = $action
            ControllerFile = $controllerFile
            Permissions = $permissions
        }

        $backendRouteEntries += $entry

        if (-not $backendByMethod.ContainsKey($entry.Method)) {
            $backendByMethod[$entry.Method] = @()
        }

        $backendByMethod[$entry.Method] += $entry
    }
}

$frontendEndpointMap = @{}
if (Test-Path $FrontendEndpointsFile) {
    $frontendEndpointRaw = Get-Content -Path $FrontendEndpointsFile -Raw
    if (-not [string]::IsNullOrWhiteSpace($frontendEndpointRaw)) {
        $frontendEndpointEntries = @(($frontendEndpointRaw | ConvertFrom-Json))
        foreach ($entry in $frontendEndpointEntries) {
            $fileKey = Normalize-FileKey -RawPath ([string]$entry.File)
            if (-not $frontendEndpointMap.ContainsKey($fileKey)) {
                $frontendEndpointMap[$fileKey] = @()
            }

            $frontendEndpointMap[$fileKey] += [PSCustomObject]@{
                Method = ([string]$entry.Method).ToUpperInvariant()
                Path = Normalize-Path -RawPath ([string]$entry.Path)
            }
        }
    }
}

$pageFiles = Get-ChildItem -Path $FrontendPagesRoot -Recurse -File -Filter "*Page.tsx"
$controllerCrudCache = @{}
$pageRows = @()

foreach ($pageFile in $pageFiles) {
    $relativePath = Resolve-Path -Relative $pageFile.FullName
    $relativePath = $relativePath -replace "^[.\\\/]+", ""
    $relativePath = $relativePath.Replace("\", "/")
    $fileKey = Normalize-FileKey -RawPath $relativePath

    $content = Get-Content -Path $pageFile.FullName -Raw

    $endpointHash = @{}
    $regexPatterns = @(
        '(?i)\.(?<method>get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*["''](?<path>/[^"''\s\)]*)["'']',
        '(?i)\.(?<method>get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*`(?<path>/[^`\s\)]*)`'
    )

    foreach ($pattern in $regexPatterns) {
        $matches = [System.Text.RegularExpressions.Regex]::Matches($content, $pattern)
        foreach ($match in $matches) {
            $method = $match.Groups["method"].Value.ToUpperInvariant()
            $path = Normalize-Path -RawPath $match.Groups["path"].Value
            if ([string]::IsNullOrWhiteSpace($path)) {
                continue
            }

            $key = "$method $path"
            $endpointHash[$key] = [PSCustomObject]@{
                Method = $method
                Path = $path
            }
        }
    }

    if ($frontendEndpointMap.ContainsKey($fileKey)) {
        foreach ($endpoint in $frontendEndpointMap[$fileKey]) {
            $path = Normalize-Path -RawPath ([string]$endpoint.Path)
            if ([string]::IsNullOrWhiteSpace($path)) {
                continue
            }

            $method = ([string]$endpoint.Method).ToUpperInvariant()
            $key = "$method $path"
            $endpointHash[$key] = [PSCustomObject]@{
                Method = $method
                Path = $path
            }
        }
    }

    $endpoints = @($endpointHash.Values)
    $matchedRoutes = @()
    $missingEndpoints = @()

    foreach ($endpoint in $endpoints) {
        $method = [string]$endpoint.Method
        $path = [string]$endpoint.Path

        $methodCandidates = @()
        if ($backendByMethod.ContainsKey($method)) {
            $methodCandidates = $backendByMethod[$method]
        }

        $routeMatches = @($methodCandidates | Where-Object { Test-PathMatch -FrontendPath $path -BackendPath ([string]$_.Path) })
        if ($routeMatches.Count -gt 0) {
            $matchedRoutes += $routeMatches
        } else {
            $missingEndpoints += "$method $path"
        }
    }

    $matchedRoutes = @($matchedRoutes | Sort-Object Method, Path, Action -Unique)
    $matchedControllers = @($matchedRoutes | Where-Object { -not [string]::IsNullOrWhiteSpace($_.ControllerFile) } | Select-Object -ExpandProperty ControllerFile -Unique)

    $hasIndex = $false
    $hasStore = $false
    $hasUpdate = $false
    $hasDestroy = $false

    foreach ($controllerFile in $matchedControllers) {
        if (-not $controllerCrudCache.ContainsKey($controllerFile)) {
            $controllerExists = Test-Path $controllerFile
            $controllerContent = ""
            if ($controllerExists) {
                $controllerContent = Get-Content -Path $controllerFile -Raw
            }

            $controllerCrudCache[$controllerFile] = [PSCustomObject]@{
                Exists = $controllerExists
                HasIndex = ($controllerContent -match "(?m)function\s+index\s*\(")
                HasStore = ($controllerContent -match "(?m)function\s+store\s*\(")
                HasUpdate = ($controllerContent -match "(?m)function\s+update\s*\(")
                HasDestroy = ($controllerContent -match "(?m)function\s+destroy\s*\(")
            }
        }

        $cache = $controllerCrudCache[$controllerFile]
        $hasIndex = $hasIndex -or $cache.HasIndex
        $hasStore = $hasStore -or $cache.HasStore
        $hasUpdate = $hasUpdate -or $cache.HasUpdate
        $hasDestroy = $hasDestroy -or $cache.HasDestroy
    }

    $hasCrudInController = $hasIndex -and $hasStore -and $hasUpdate -and $hasDestroy
    $frontendExists = Test-Path $pageFile.FullName
    $backendRouteExists = ($endpoints.Count -gt 0 -and $matchedRoutes.Count -gt 0)
    $apiCorrect = ($endpoints.Count -gt 0 -and $missingEndpoints.Count -eq 0)

    $toastHint = ($content -match "(?i)\btoast\.(success|error|warning|info)\b|useToast|sonner|toast\(")
    $loadingHint = ($content -match "(?i)\bisLoading\b|\bloading\b|setLoading\(|Skeleton|Spinner|Carregando|Loading")
    $emptyHint = ($content -match "(?i)EmptyState|Nenhum|Sem dados|No records|No data|vazio|nao encontrado|não encontrado")
    $frontendPermissionHint = ($content -match "(?i)\b(can|hasPermission|usePermissions|permission)\b")

    $routesWithPermission = @($matchedRoutes | Where-Object { $_.Permissions.Count -gt 0 })
    $backendPermissionComplete = ($matchedRoutes.Count -gt 0 -and $routesWithPermission.Count -eq $matchedRoutes.Count)
    $permissionConfigured = $backendPermissionComplete -or $frontendPermissionHint

    $moduleKey = Get-ModuleKey -PageRelativePath $relativePath -Endpoints $endpoints

    $pageRows += [PSCustomObject]@{
        Module = $moduleKey
        Page = $relativePath
        FrontendPageExists = To-StatusSymbol -Value $frontendExists
        BackendRouteExists = To-StatusSymbol -Value $backendRouteExists
        ControllerCrudComplete = To-StatusSymbol -Value $hasCrudInController
        ApiCalls = $endpoints.Count
        ApiMappedCorrectly = To-StatusSymbol -Value $apiCorrect
        ToastFeedback = To-StatusSymbol -Value $toastHint
        LoadingState = To-StatusSymbol -Value $loadingHint
        EmptyState = To-StatusSymbol -Value $emptyHint
        PermissionConfigured = To-StatusSymbol -Value $permissionConfigured
        MatchedControllers = ($matchedControllers -join "; ")
        MissingApiCalls = ($missingEndpoints -join "; ")
    }
}

$summaryRows = @()
$groupedModules = $pageRows | Group-Object Module | Sort-Object Name

foreach ($group in $groupedModules) {
    $rows = @($group.Group)
    $totalPages = $rows.Count
    $apiPages = @($rows | Where-Object { $_.ApiCalls -gt 0 })
    $apiPagesCount = $apiPages.Count

    $backendRouteStatus = ($apiPagesCount -gt 0 -and @($apiPages | Where-Object { $_.BackendRouteExists -eq "OK" }).Count -eq $apiPagesCount)
    $controllerCrudStatus = ($apiPagesCount -gt 0 -and @($apiPages | Where-Object { $_.ControllerCrudComplete -eq "OK" }).Count -eq $apiPagesCount)
    $apiMappingStatus = ($apiPagesCount -gt 0 -and @($apiPages | Where-Object { $_.ApiMappedCorrectly -eq "OK" }).Count -eq $apiPagesCount)
    $toastStatus = ($apiPagesCount -gt 0 -and @($apiPages | Where-Object { $_.ToastFeedback -eq "OK" }).Count -eq $apiPagesCount)
    $loadingStatus = ($apiPagesCount -gt 0 -and @($apiPages | Where-Object { $_.LoadingState -eq "OK" }).Count -eq $apiPagesCount)
    $emptyStatus = ($apiPagesCount -gt 0 -and @($apiPages | Where-Object { $_.EmptyState -eq "OK" }).Count -eq $apiPagesCount)
    $permissionStatus = ($apiPagesCount -gt 0 -and @($apiPages | Where-Object { $_.PermissionConfigured -eq "OK" }).Count -eq $apiPagesCount)

    $overallStatus = $backendRouteStatus -and $controllerCrudStatus -and $apiMappingStatus -and $toastStatus -and $loadingStatus -and $emptyStatus -and $permissionStatus

    $gapPages = @($rows | Where-Object {
        $_.BackendRouteExists -eq "NOK" -or
        $_.ControllerCrudComplete -eq "NOK" -or
        $_.ApiMappedCorrectly -eq "NOK" -or
        $_.ToastFeedback -eq "NOK" -or
        $_.LoadingState -eq "NOK" -or
        $_.EmptyState -eq "NOK" -or
        $_.PermissionConfigured -eq "NOK"
    } | Select-Object -First 5 -ExpandProperty Page)

    $summaryRows += [PSCustomObject]@{
        Module = $group.Name
        Pages = $totalPages
        ApiPages = $apiPagesCount
        BackendRouteExists = To-StatusSymbol -Value $backendRouteStatus
        ControllerCrudComplete = To-StatusSymbol -Value $controllerCrudStatus
        FrontendPageExists = To-StatusSymbol -Value ($totalPages -gt 0)
        ApiMappedCorrectly = To-StatusSymbol -Value $apiMappingStatus
        ToastFeedback = To-StatusSymbol -Value $toastStatus
        LoadingState = To-StatusSymbol -Value $loadingStatus
        EmptyState = To-StatusSymbol -Value $emptyStatus
        PermissionConfigured = To-StatusSymbol -Value $permissionStatus
        Overall = To-StatusSymbol -Value $overallStatus
        GapPages = ($gapPages -join "; ")
    }
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$pagesCsvPath = Join-Path $OutputDir "module_report_pages.csv"
$summaryCsvPath = Join-Path $OutputDir "module_report_summary.csv"
$jsonPath = Join-Path $OutputDir "module_report.json"
$pagesMdPath = Join-Path $OutputDir "module_report_pages.md"
$summaryMdPath = Join-Path $OutputDir "module_report_summary.md"

$pageRows | Sort-Object Module, Page | Export-Csv -Path $pagesCsvPath -NoTypeInformation -Encoding UTF8
$summaryRows | Sort-Object Module | Export-Csv -Path $summaryCsvPath -NoTypeInformation -Encoding UTF8

[PSCustomObject]@{
    GeneratedAt = (Get-Date).ToString("s")
    BackendRoutesFile = $BackendRoutesFile
    PagesRoot = $FrontendPagesRoot
    PageRows = $pageRows
    SummaryRows = $summaryRows
} | ConvertTo-Json -Depth 6 | Set-Content -Path $jsonPath -Encoding UTF8

$summaryMdLines = @()
$summaryMdLines += "# Relatorio de Varredura de Modulos"
$summaryMdLines += ""
$summaryMdLines += "| Modulo | Paginas | Paginas API | Rota Backend | CRUD Controller | Frontend | API Correta | Toast | Loading | Estado Vazio | Permissao | Geral |"
$summaryMdLines += "| --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |"

foreach ($row in ($summaryRows | Sort-Object Module)) {
    $summaryMdLines += "| $(Escape-MarkdownCell $row.Module) | $($row.Pages) | $($row.ApiPages) | $(To-MarkdownSymbol $row.BackendRouteExists) | $(To-MarkdownSymbol $row.ControllerCrudComplete) | $(To-MarkdownSymbol $row.FrontendPageExists) | $(To-MarkdownSymbol $row.ApiMappedCorrectly) | $(To-MarkdownSymbol $row.ToastFeedback) | $(To-MarkdownSymbol $row.LoadingState) | $(To-MarkdownSymbol $row.EmptyState) | $(To-MarkdownSymbol $row.PermissionConfigured) | $(To-MarkdownSymbol $row.Overall) |"
}

$summaryMdLines -join "`r`n" | Set-Content -Path $summaryMdPath -Encoding UTF8

$pagesMdLines = @()
$pagesMdLines += "# Planilha Detalhada de Modulos (Por Pagina)"
$pagesMdLines += ""
$pagesMdLines += "| Modulo | Pagina | Frontend | Rota Backend | CRUD Controller | API Correta | Toast | Loading | Estado Vazio | Permissao | APIs Ausentes |"
$pagesMdLines += "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"

foreach ($row in ($pageRows | Sort-Object Module, Page)) {
    $pagesMdLines += "| $(Escape-MarkdownCell $row.Module) | $(Escape-MarkdownCell $row.Page) | $(To-MarkdownSymbol $row.FrontendPageExists) | $(To-MarkdownSymbol $row.BackendRouteExists) | $(To-MarkdownSymbol $row.ControllerCrudComplete) | $(To-MarkdownSymbol $row.ApiMappedCorrectly) | $(To-MarkdownSymbol $row.ToastFeedback) | $(To-MarkdownSymbol $row.LoadingState) | $(To-MarkdownSymbol $row.EmptyState) | $(To-MarkdownSymbol $row.PermissionConfigured) | $(Escape-MarkdownCell $row.MissingApiCalls) |"
}

$pagesMdLines -join "`r`n" | Set-Content -Path $pagesMdPath -Encoding UTF8

$totalModules = $summaryRows.Count
$overallOk = @($summaryRows | Where-Object { $_.Overall -eq "OK" }).Count
$overallFail = $totalModules - $overallOk

Write-Output "Relatório gerado com sucesso."
Write-Output "Resumo geral: $overallOk módulo(s) OK, $overallFail módulo(s) com gaps."
Write-Output "Arquivo detalhado: $pagesCsvPath"
Write-Output "Arquivo resumo:    $summaryCsvPath"
Write-Output "Arquivo JSON:      $jsonPath"
Write-Output "Arquivo MD resumo: $summaryMdPath"
Write-Output "Arquivo MD planilha: $pagesMdPath"
