# Get the script directory and navigate three levels up
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Resolve-Path (Join-Path -Path $scriptDir -ChildPath "../../../")

Try {
    Set-Location -Path $rootDir
    Write-Output "Changed directory to root: $rootDir"
} Catch {
    Write-Error "Error: Failed to change directory to $rootDir"
    exit 1
}

Write-Output "Loading azd .env file from the current environment"

# Check if the .env file exists and load it
$envFilePath = Join-Path -Path $rootDir -ChildPath ".env"
if (Test-Path $envFilePath) {
    Get-Content $envFilePath | ForEach-Object {
        if ($_ -match "^(.*?)=(.*)$") {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim('"'))
            Write-Output "Loaded environment variable: $($matches[1])"
        }
    }
} else {
    Write-Error "Error: .env file not found at $envFilePath"
    exit 1
}

Write-Output "Cleaning up cache directories"

# Check if LLAMAINDEX_STORAGE_CACHE_DIR is set and clean up if valid
if ($env:LLAMAINDEX_STORAGE_CACHE_DIR) {
    if (Test-Path $env:LLAMAINDEX_STORAGE_CACHE_DIR) {
        Try {
            Remove-Item -Recurse -Force -Path $env:LLAMAINDEX_STORAGE_CACHE_DIR
            Write-Output "Cache directory cleaned: $env:LLAMAINDEX_STORAGE_CACHE_DIR"
        } Catch {
            Write-Error "Error: Failed to clean cache directory: $env:LLAMAINDEX_STORAGE_CACHE_DIR"
            exit 1
        }
    } else {
        Write-Warning "Warning: Cache directory does not exist: $env:LLAMAINDEX_STORAGE_CACHE_DIR"
    }
} else {
    Write-Error "Error: LLAMAINDEX_STORAGE_CACHE_DIR environment variable is not set"
    exit 1
}

Write-Output 'Running "pnpm generate"'

# Temporarily set AZURE_CLIENT_ID to an empty string and run the pnpm command.
# When running this hook locally, we need to force using the default Azure credential chain
# because managed identity is not available in local development.
# we do this by setting the AZURE_CLIENT_ID to an empty string before running the command
$env:AZURE_CLIENT_ID = ""
Try {
    npm install pnpm
    pnpm install
    Write-Output "Command 'pnpm generate' completed successfully"
} Catch {
    Write-Error "Error: 'pnpm generate' failed"
    exit 1
}

Write-Output "Script completed successfully"
