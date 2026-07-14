[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Invoke-RepositoryGit {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepositoryRoot,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & git -C $RepositoryRoot @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($exitCode -ne 0) {
        $message = ($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
        throw "git $($Arguments -join ' ') failed: $message"
    }

    return @(
        $output |
            Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] } |
            ForEach-Object { $_.ToString() }
    )
}

function ConvertTo-MarkdownList {
    param(
        [string[]]$Items,

        [string]$EmptyMessage = 'None.'
    )

    if ($null -eq $Items -or $Items.Count -eq 0) {
        return @("- $EmptyMessage")
    }

    return @($Items | ForEach-Object { "- ``$_``" })
}

try {
    $rootOutput = & git rev-parse --show-toplevel 2>&1
    if ($LASTEXITCODE -ne 0 -or $null -eq $rootOutput) {
        throw 'The current directory is not inside a Git repository.'
    }

    $repositoryRoot = [System.IO.Path]::GetFullPath(($rootOutput | Select-Object -First 1).ToString())
    $branch = (Invoke-RepositoryGit -RepositoryRoot $repositoryRoot -Arguments @('branch', '--show-current') | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($branch)) {
        $branch = '(detached HEAD)'
    }

    $head = (Invoke-RepositoryGit -RepositoryRoot $repositoryRoot -Arguments @('rev-parse', 'HEAD') | Select-Object -First 1)
    $status = Invoke-RepositoryGit -RepositoryRoot $repositoryRoot -Arguments @('status', '--short')
    $trackedChangedFiles = Invoke-RepositoryGit -RepositoryRoot $repositoryRoot -Arguments @('diff', '--name-only', 'HEAD', '--')
    $diffStat = Invoke-RepositoryGit -RepositoryRoot $repositoryRoot -Arguments @('diff', '--stat', 'HEAD', '--')
    $lastCommit = (Invoke-RepositoryGit -RepositoryRoot $repositoryRoot -Arguments @('log', '-1', '--pretty=format:%H %s') | Select-Object -First 1)
    $untrackedFiles = Invoke-RepositoryGit -RepositoryRoot $repositoryRoot -Arguments @('ls-files', '--others', '--exclude-standard')
    $changedFiles = @($trackedChangedFiles + $untrackedFiles | Sort-Object -Unique)

    $handoffDirectory = Join-Path $repositoryRoot '.ai'
    if (-not (Test-Path -LiteralPath $handoffDirectory)) {
        New-Item -ItemType Directory -Path $handoffDirectory | Out-Null
    }

    $lines = @(
        '# Generated handoff snapshot'
        ''
        'This file is generated from Git metadata. Do not treat it as a task log or source of truth.'
        ''
        "- UTC: $([DateTimeOffset]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))"
        "- Local: $([DateTimeOffset]::Now.ToString('yyyy-MM-ddTHH:mm:sszzz'))"
        "- Repository root: ``$repositoryRoot``"
        "- Branch: ``$branch``"
        "- HEAD: ``$head``"
        "- Last commit: ``$lastCommit``"
        ''
        '## Git status'
        ''
    )
    $lines += ConvertTo-MarkdownList -Items $status -EmptyMessage 'Clean.'
    $lines += @('', '## Changed file list', '')
    $lines += ConvertTo-MarkdownList -Items $changedFiles
    $lines += @('', '## Diff stat', '')
    $lines += ConvertTo-MarkdownList -Items $diffStat
    $lines += @('', '## Untracked files', '')
    $lines += ConvertTo-MarkdownList -Items $untrackedFiles

    $handoffPath = Join-Path $handoffDirectory 'HANDOFF.generated.md'
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($handoffPath, $lines, $utf8WithoutBom)

    Write-Output "Updated $handoffPath"
    exit 0
}
catch {
    [Console]::Error.WriteLine("Unable to update handoff snapshot: $($_.Exception.Message)")
    exit 1
}
