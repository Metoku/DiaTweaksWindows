# Read-only Windows and accessibility metadata for a possible Dia native port.
# Does not modify Dia, inject code, collect browser pages, or read credentials.
[CmdletBinding()]
param([string]$Output = (Join-Path $PSScriptRoot 'dia-diagnostic.json'))
$ErrorActionPreference = 'Stop'

$report = [ordered]@{
    schema = 1
    generatedUtc = [DateTime]::UtcNow.ToString('o')
    operatingSystem = [System.Environment]::OSVersion.VersionString
    appxPackages = @()
    processes = @()
    windows = @()
    warnings = @()
}

try {
    $report.appxPackages = @(Get-AppxPackage | Where-Object {
        $_.Name -match 'Dia|BrowserCompany|TheBrowser'
    } | ForEach-Object {
        [ordered]@{ name = $_.Name; version = $_.Version.ToString(); architecture = $_.Architecture.ToString() }
    })
} catch {
    $report.warnings += 'Could not read MSIX package metadata.'
}

try {
    $procs = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
        $_.ProcessName -match '^Dia($|Browser)' 
    })
    $report.processes = @($procs | ForEach-Object {
        $fileVersion = $null
        try { $fileVersion = $_.MainModule.FileVersionInfo.FileVersion } catch { }
        [ordered]@{ executableName = $_.ProcessName; fileVersion = $fileVersion; hasWindow = ($_.MainWindowHandle -ne 0) }
    })
} catch {
    $procs = @()
    $report.warnings += 'Could not enumerate Dia processes.'
}

try {
    Add-Type -AssemblyName UIAutomationClient
    $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
    $limit = 250
    foreach ($process in $procs) {
        if ($process.MainWindowHandle -eq 0) { continue }
        $root = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
        if ($null -eq $root) { continue }
        $nodes = New-Object System.Collections.Generic.List[object]
        $queue = New-Object System.Collections.Queue
        $queue.Enqueue(@($root, 0))
        while ($queue.Count -gt 0 -and $nodes.Count -lt $limit) {
            $item = $queue.Dequeue()
            $element = $item[0]
            $depth = [int]$item[1]
            try {
                $current = $element.Current
                # Deliberately never include Name, Value, HelpText, tab titles, or URLs.
                $nodes.Add([ordered]@{
                    depth = $depth
                    controlType = $current.ControlType.ProgrammaticName
                    className = $current.ClassName
                    automationId = $current.AutomationId
                })
                if ($depth -ge 5) { continue }
                $child = $walker.GetFirstChild($element)
                while ($null -ne $child -and ($nodes.Count + $queue.Count) -lt $limit) {
                    $queue.Enqueue(@($child, $depth + 1))
                    $child = $walker.GetNextSibling($child)
                }
            } catch { }
        }
        $report.windows += [ordered]@{ processName = $process.ProcessName; nodes = @($nodes.ToArray()) }
    }
} catch {
    $report.warnings += 'Could not inspect UI Automation control metadata.'
}

$report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $Output -Encoding UTF8
Write-Host "Diagnostic saved: $Output"
Write-Host 'Inspect its contents before sharing. It contains control IDs and software version metadata only.'
