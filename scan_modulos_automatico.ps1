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
    if ($Value -eq "OK") { return "âœ…" }
    return "âŒ"
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

function Resolve-ImportFile {
    param(
        [string]$ImportPath,
        [string]$CurrentFile,
        [string]$FrontendSrcRoot
    )

    if ([string]::IsNullOrWhiteSpace($ImportPath)) {
        return ""
    }

    $candidateBase = ""
    if ($ImportPath.StartsWith("@/")) {
        $candidateBase = Join-Path $FrontendSrcRoot ($ImportPath.Substring(2).Replace("/", "\"))
    } elseif ($ImportPath.StartsWith(".")) {
        $currentDir = Split-Path -Path $CurrentFile -Parent
        $candidateBase = Join-Path $currentDir ($ImportPath.Replace("/", "\"))
    } else {
        return ""
    }

    $candidates = @(
        $candidateBase,
        "$candidateBase.ts",
        "$candidateBase.tsx",
        "$candidateBase.js",
        "$candidateBase.jsx",
        (Join-Path $candidateBase "index.ts"),
        (Join-Path $candidateBase "index.tsx"),
        (Join-Path $candidateBase "index.js"),
        (Join-Path $candidateBase "index.jsx")
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate -PathType Leaf) {
            return (Resolve-Path $candidate).Path
        }
    }

    return ""
}

function Get-FilesForPageAnalysis {
    param(
        [string]$EntryFile,
        [string]$FrontendSrcRoot,
        [int]$MaxDepth = 2
    )

    $queue = New-Object System.Collections.Queue
    $seen = @{}
    $result = @()

    $queue.Enqueue([PSCustomObject]@{ File = $EntryFile; Depth = 0 })

    while ($queue.Count -gt 0) {
        $item = $queue.Dequeue()
        $file = [string]$item.File
        $depth = [int]$item.Depth

        if ([string]::IsNullOrWhiteSpace($file) -or $seen.ContainsKey($file)) {
            continue
        }

        $seen[$file] = $true
        $result += $file

        if ($depth -ge $MaxDepth -or -not (Test-Path $file -PathType Leaf)) {
            continue
        }

        $content = Get-Content -Path $file -Raw
        $importMatches = [System.Text.RegularExpressions.Regex]::Matches(
            $content,
            '(?m)^\s*import\s+.+?\s+from\s+["''](?<path>[^"'']+)["'']'
        )

        foreach ($importMatch in $importMatches) {
            $importPath = $importMatch.Groups["path"].Value
            $resolvedImport = Resolve-ImportFile -ImportPath $importPath -CurrentFile $file -FrontendSrcRoot $FrontendSrcRoot
            if (-not [string]::IsNullOrWhiteSpace($resolvedImport)) {
                $queue.Enqueue([PSCustomObject]@{ File = $resolvedImport; Depth = $depth + 1 })
            }
        }
    }

    return @($result)
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
        throw "Arquivo de rotas do backend nÃ£o encontrado."
    }
}

if (-not (Test-Path $BackendRoutesFile)) {
    throw "Arquivo de rotas do backend nÃ£o encontrado: $BackendRoutesFile"
}

if (-not (Test-Path $FrontendPagesRoot)) {
    throw "DiretÃ³rio de pÃ¡ginas do frontend nÃ£o encontrado: $FrontendPagesRoot"
}

$frontendSrcRoot = Resolve-Path "frontend/src"

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
        foreach ($middlewareEntry in @($route.middleware)) {
            $middlewareValue = [string]$middlewareEntry

            if ($middlewareValue -match "(?i)(?:check\.permission:|CheckPermission:)(?<value>.+)$") {
                $permissions += @($Matches["value"] -split "\|")
                continue
            }

            if ($middlewareValue -match "(?i)^can:(?<value>.+)$") {
                $permissions += $Matches["value"]
                continue
            }

            if ($middlewareValue -match "(?i)^check\.report\.(?<value>.+)$") {
                $permissions += "report.$($Matches["value"])"
                continue
            }

            if ($middlewareValue -match "(?i)CheckReportExportPermission$") {
                $permissions += "report.export"
            }
        }

        $permissions = @(
            $permissions |
            Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } |
            ForEach-Object { ([string]$_).Trim() } |
            Sort-Object -Unique
        )
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

    $pageContent = Get-Content -Path $pageFile.FullName -Raw
    $analysisFiles = Get-FilesForPageAnalysis -EntryFile $pageFile.FullName -FrontendSrcRoot ([string]$frontendSrcRoot) -MaxDepth 3
    $analysisContent = @()
    foreach ($analysisFile in $analysisFiles) {
        if (Test-Path $analysisFile -PathType Leaf) {
            $analysisContent += Get-Content -Path $analysisFile -Raw
        }
    }
    $content = ($analysisContent -join "`n")

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

    $directEndpointHash = @{}
    foreach ($pattern in $regexPatterns) {
        $matches = [System.Text.RegularExpressions.Regex]::Matches($pageContent, $pattern)
        foreach ($match in $matches) {
            $method = $match.Groups["method"].Value.ToUpperInvariant()
            $path = Normalize-Path -RawPath $match.Groups["path"].Value
            if ([string]::IsNullOrWhiteSpace($path)) {
                continue
            }

            $directKey = "$method $path"
            $directEndpointHash[$directKey] = [PSCustomObject]@{
                Method = $method
                Path = $path
            }
        }
    }

    $endpointFileKeys = @($fileKey)
    foreach ($analysisFile in $analysisFiles) {
        $analysisRel = Resolve-Path -Relative $analysisFile
        $analysisRel = $analysisRel -replace "^[.\\\/]+", ""
        $analysisRel = $analysisRel.Replace("\", "/")
        $analysisKey = Normalize-FileKey -RawPath $analysisRel
        $endpointFileKeys += $analysisKey
    }
    $endpointFileKeys = @($endpointFileKeys | Sort-Object -Unique)

    foreach ($endpointFileKey in $endpointFileKeys) {
        if (-not $frontendEndpointMap.ContainsKey($endpointFileKey)) {
            continue
        }

        foreach ($endpoint in $frontendEndpointMap[$endpointFileKey]) {
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
    if ($frontendEndpointMap.ContainsKey($fileKey)) {
        foreach ($endpoint in $frontendEndpointMap[$fileKey]) {
            $directPath = Normalize-Path -RawPath ([string]$endpoint.Path)
            if ([string]::IsNullOrWhiteSpace($directPath)) {
                continue
            }

            $directMethod = ([string]$endpoint.Method).ToUpperInvariant()
            $directKey = "$directMethod $directPath"
            $directEndpointHash[$directKey] = [PSCustomObject]@{
                Method = $directMethod
                Path = $directPath
            }
        }
    }

    $directEndpoints = @($directEndpointHash.Values)
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

    $usedMethods = @($endpoints | Select-Object -ExpandProperty Method -Unique)
    $directUsedMethods = @($directEndpoints | Select-Object -ExpandProperty Method -Unique)
    $requiresRead = @($usedMethods | Where-Object { $_ -eq "GET" }).Count -gt 0
    $requiresCreate = @($usedMethods | Where-Object { $_ -eq "POST" }).Count -gt 0
    $requiresUpdate = @($usedMethods | Where-Object { $_ -in @("PUT", "PATCH") }).Count -gt 0
    $requiresDelete = @($usedMethods | Where-Object { $_ -eq "DELETE" }).Count -gt 0

    $routesWithExistingController = @($matchedRoutes | Where-Object {
        -not [string]::IsNullOrWhiteSpace($_.ControllerFile) -and (Test-Path $_.ControllerFile)
    })

    $hasReadRouteController = @($routesWithExistingController | Where-Object { $_.Method -eq "GET" }).Count -gt 0
    $hasCreateRouteController = @($routesWithExistingController | Where-Object { $_.Method -eq "POST" }).Count -gt 0
    $hasUpdateRouteController = @($routesWithExistingController | Where-Object { $_.Method -in @("PUT", "PATCH") }).Count -gt 0
    $hasDeleteRouteController = @($routesWithExistingController | Where-Object { $_.Method -eq "DELETE" }).Count -gt 0

    $readSatisfied = (-not $requiresRead) -or $hasIndex -or $hasReadRouteController
    $createSatisfied = (-not $requiresCreate) -or $hasStore -or $hasCreateRouteController
    $updateSatisfied = (-not $requiresUpdate) -or $hasUpdate -or $hasUpdateRouteController
    $deleteSatisfied = (-not $requiresDelete) -or $hasDestroy -or $hasDeleteRouteController

    $hasCrudInController = ($endpoints.Count -eq 0) -or ($readSatisfied -and $createSatisfied -and $updateSatisfied -and $deleteSatisfied)
    $frontendExists = Test-Path $pageFile.FullName
    $backendRouteExists = ($endpoints.Count -eq 0) -or ($matchedRoutes.Count -gt 0)
    $apiCorrect = ($endpoints.Count -eq 0) -or ($missingEndpoints.Count -eq 0)

    $directMutationMethods = @($directUsedMethods | Where-Object { $_ -in @("POST", "PUT", "PATCH", "DELETE") })
    $directMutationEndpoints = @($directEndpoints | Where-Object { $_.Method -in @("POST", "PUT", "PATCH", "DELETE") })
    $hasMutationIntent = $directMutationMethods.Count -gt 0 -or ($pageContent -match "(?i)\.mutate\(|offline(?:Post|Put|Delete)\(")
    $hasOnlyExportMutation = $directMutationEndpoints.Count -gt 0 -and @($directMutationEndpoints | Where-Object { $_.Path -notmatch "(?i)/export|/pdf|/download" }).Count -eq 0
    $requiresMutationFeedback = $hasMutationIntent -and (-not $hasOnlyExportMutation)

    $hasFetchIntent = @($directUsedMethods | Where-Object { $_ -eq "GET" }).Count -gt 0 -or ($pageContent -match "(?i)\buseQuery\b|\buseInfiniteQuery\b|\bqueryFn\b")
    $isListLikePage = $pageContent -match "(?i)<table|DataTable|\bkanban\b"
    $requiresEmptyState = $hasFetchIntent -and $isListLikePage

    $toastHint = (-not $requiresMutationFeedback) -or ($pageContent -match "(?i)\btoast\.(success|error|warning|info)\b|\buseToast\b|\bsonner\b|\btoast\(|\bnotify(?:Success|Error|Warning|Info)?\(|\bsetError\(|\berror\s*&&|\bsetSaved\(|\bisSubmitting\b|<Alert\b|alert\(")
    $loadingHint = (-not $hasFetchIntent) -or ($pageContent -match "(?i)\bisLoading\b|\bloading\b|\bisFetching\b|\bisPending\b|\bisSubmitting\b|setLoading\(|Skeleton|Spinner|Carregando|Loading")
    $emptyHint = (-not $requiresEmptyState) -or ($pageContent -match "(?i)EmptyState|Nenhum|Nenhuma|Sem dados|Sem registros|Sem deals|Sem candidatos|No records|No data|vazio|nao encontrado|não encontrado|nao encontrada|não encontrada")
    $frontendPermissionHint = ($pageContent -match "(?i)\b(can|hasPermission|usePermissions|permission)\b")
    $matchedPermissionRoutes = @($matchedRoutes | Where-Object { $directEndpointHash.ContainsKey("$([string]$_.Method) $([string]$_.Path)") })
    if ($matchedPermissionRoutes.Count -eq 0) {
        $matchedPermissionRoutes = $matchedRoutes
    }

    $routesWithPermission = @($matchedPermissionRoutes | Where-Object { $_.Permissions.Count -gt 0 })
    $routesWithoutPermissionButAllowed = @($matchedPermissionRoutes | Where-Object {
        $_.Permissions.Count -eq 0 -and (
            $_.Path -like "/portal*" -or
            $_.Path -in @("/login", "/logout", "/me") -or
            $_.Path -like "/profile*" -or
            $_.Path -like "/external*" -or
            $_.Path -like "/quotes/*/public-*" -or
            $_.Path -like "/tech/sync*"
        )
    })
    $backendPermissionComplete = ($matchedPermissionRoutes.Count -gt 0 -and ($routesWithPermission.Count + $routesWithoutPermissionButAllowed.Count) -eq $matchedPermissionRoutes.Count)
    $permissionConfigured = ($endpoints.Count -eq 0) -or ($matchedPermissionRoutes.Count -eq 0) -or $backendPermissionComplete -or $frontendPermissionHint

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

    $backendRouteStatus = @($rows | Where-Object { $_.BackendRouteExists -eq "OK" }).Count -eq $totalPages
    $controllerCrudStatus = @($rows | Where-Object { $_.ControllerCrudComplete -eq "OK" }).Count -eq $totalPages
    $apiMappingStatus = @($rows | Where-Object { $_.ApiMappedCorrectly -eq "OK" }).Count -eq $totalPages
    $toastStatus = @($rows | Where-Object { $_.ToastFeedback -eq "OK" }).Count -eq $totalPages
    $loadingStatus = @($rows | Where-Object { $_.LoadingState -eq "OK" }).Count -eq $totalPages
    $emptyStatus = @($rows | Where-Object { $_.EmptyState -eq "OK" }).Count -eq $totalPages
    $permissionStatus = @($rows | Where-Object { $_.PermissionConfigured -eq "OK" }).Count -eq $totalPages

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

Write-Output "RelatÃ³rio gerado com sucesso."
Write-Output "Resumo geral: $overallOk mÃ³dulo(s) OK, $overallFail mÃ³dulo(s) com gaps."
Write-Output "Arquivo detalhado: $pagesCsvPath"
Write-Output "Arquivo resumo:    $summaryCsvPath"
Write-Output "Arquivo JSON:      $jsonPath"
Write-Output "Arquivo MD resumo: $summaryMdPath"
Write-Output "Arquivo MD planilha: $pagesMdPath"
