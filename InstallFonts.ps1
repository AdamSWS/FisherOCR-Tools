# PowerShell script to install all fonts from the _FisherFonts directory and its subdirectories
# Create a log file to track the installation process
$logFile = "$env:USERPROFILE\Desktop\font_installation_log.txt"
"Font Installation Log - $(Get-Date)" | Out-File -FilePath $logFile

# Font directory path
$desktopPath = [Environment]::GetFolderPath("Desktop")
$fontDir = "$desktopPath\_FisherFonts"
Write-Host "Font directory path: $fontDir"

# Define the path to the current user's desktop first
$desktopPath = [Environment]::GetFolderPath("Desktop")
Write-Host "Desktop path: $desktopPath"

# Fonts folder in Windows
$windowsFontsFolder = (New-Object -ComObject Shell.Application).Namespace(0x14)

# Array of font file extensions to look for
$fontExtensions = @(".ttf", ".otf", ".ttc", ".fon", ".pfb", ".pfm", ".fnt")

# Counter for successful installations
$installedCount = 0
$errorCount = 0

# Function to install a font
function Install-Font {
    param (
        [string]$fontPath
    )
    
    try {
        $fontName = [System.IO.Path]::GetFileName($fontPath)
        
        # Check if font is already installed
        $existingFont = Get-ChildItem -Path "$env:windir\Fonts" | Where-Object { $_.Name -eq $fontName }
        
        if ($existingFont) {
            "Font already installed: $fontName" | Out-File -FilePath $logFile -Append
            return
        }
        
        # Copy the font to the Windows Fonts folder
        $windowsFontsFolder.CopyHere($fontPath)
        
        # Register the font in the registry
        $fontRegistryPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts"
        $fontRegistryName = [System.IO.Path]::GetFileNameWithoutExtension($fontPath)
        
        if ([System.IO.Path]::GetExtension($fontPath) -eq ".ttf") {
            $fontRegistryName += " (TrueType)"
        }
        elseif ([System.IO.Path]::GetExtension($fontPath) -eq ".otf") {
            $fontRegistryName += " (OpenType)"
        }
        
        # Add to counter and log
        $global:installedCount++
        "Installed: $fontName" | Out-File -FilePath $logFile -Append
    }
    catch {
        $global:errorCount++
        "Error installing font $fontName : $_" | Out-File -FilePath $logFile -Append
    }
}

# Check if the script is running with administrator privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    "This script needs to be run as an Administrator to install fonts." | Out-File -FilePath $logFile -Append
    Write-Host "This script needs to be run as an Administrator to install fonts."
    Write-Host "Please right-click on PowerShell and select 'Run as Administrator', then run this script again."
    exit
}

# Check if the font directory exists
if (-not (Test-Path -Path $fontDir)) {
    "Font directory not found: $fontDir" | Out-File -FilePath $logFile -Append
    Write-Host "Font directory not found: $fontDir"
    exit
}

# Find all font files recursively
Write-Host "Searching for font files in $fontDir and its subdirectories..."
$fontFiles = Get-ChildItem -Path $fontDir -Recurse | Where-Object {
    $extension = [System.IO.Path]::GetExtension($_.FullName).ToLower()
    $fontExtensions -contains $extension
}

$totalFonts = $fontFiles.Count
"Found $totalFonts font files to install." | Out-File -FilePath $logFile -Append
Write-Host "Found $totalFonts font files to install."

# Install each font
foreach ($fontFile in $fontFiles) {
    Write-Host "Installing $($fontFile.Name)..."
    Install-Font -fontPath $fontFile.FullName
}

# Summary
"Installation completed. Successfully installed $installedCount fonts. Errors: $errorCount" | Out-File -FilePath $logFile -Append
Write-Host "Installation completed. Successfully installed $installedCount fonts. Errors: $errorCount"
Write-Host "See $logFile for details."

# Keep the window open if there were errors
if ($errorCount -gt 0) {
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}