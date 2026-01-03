# ============================================================
# Script de Commit, Build et Deploiement pour Genweb
# ============================================================
# Usage: .\commit-and-deploy.ps1 [-Major] [-Minor] [-Patch] [-Message "commit message"]
# Par defaut: incremente la version Patch (X.Y.Z -> X.Y.Z+1)
# -Minor: incremente la version Minor (X.Y.Z -> X.Y+1.0)
# -Major: incremente la version Major (X.Y.Z -> X+1.0.0)
# ============================================================

param(
    [switch]$Major,
    [switch]$Minor,
    [switch]$Patch,
    [string]$Message = ""
)

# Couleurs pour les signaux
function Write-Signal {
    param([string]$Status, [string]$Text)
    switch ($Status) {
        "INFO"    { Write-Host "[INFO] $Text" -ForegroundColor Cyan }
        "SUCCESS" { Write-Host "[SUCCESS] $Text" -ForegroundColor Green }
        "WARNING" { Write-Host "[WARNING] $Text" -ForegroundColor Yellow }
        "ERROR"   { Write-Host "[ERROR] $Text" -ForegroundColor Red }
        "STEP"    { Write-Host "[STEP] $Text" -ForegroundColor Magenta }
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   GENWEB - Script de Deploiement" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Verifier qu on est dans le bon repertoire
$projectPath = "d:\Cursor\GenWeb"
Set-Location $projectPath

# 1. Lire la version actuelle depuis package.json
Write-Signal "STEP" "Lecture de la version actuelle..."
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$currentVersion = $packageJson.version
Write-Signal "INFO" "Version actuelle: v$currentVersion"

# 2. Calculer la nouvelle version
$versionParts = $currentVersion.Split('.')
$majorV = [int]$versionParts[0]
$minorV = [int]$versionParts[1]
$patchV = [int]$versionParts[2]

if ($Major) {
    $majorV++
    $minorV = 0
    $patchV = 0
} elseif ($Minor) {
    $minorV++
    $patchV = 0
} else {
    # Par defaut: Patch
    $patchV++
}

$newVersion = "$majorV.$minorV.$patchV"
Write-Signal "SUCCESS" "Nouvelle version: v$newVersion"

# 3. Mettre a jour package.json
Write-Signal "STEP" "Mise a jour de package.json..."
# Lire le fichier, remplacer la version avec regex pour garder le format
$content = Get-Content "package.json" -Raw
$content = $content -replace '"version":\s*"[^"]*"', "`"version`": `"$newVersion`""
[System.IO.File]::WriteAllText("$projectPath\package.json", $content, [System.Text.UTF8Encoding]::new($false))
Write-Signal "SUCCESS" "package.json mis a jour"

# 4. Verifier s il y a des changements a commiter
Write-Signal "STEP" "Verification des changements..."
$status = git status --porcelain
if (-not $status) {
    Write-Signal "WARNING" "Aucun changement detecte (sauf la version)"
}

# 5. Ajouter tous les fichiers
Write-Signal "STEP" "Ajout des fichiers au staging..."
git add .
Write-Signal "SUCCESS" "Fichiers ajoutes"

# 6. Creer le message de commit
if ([string]::IsNullOrEmpty($Message)) {
    $commitMessage = "v$newVersion - Update"
} else {
    $commitMessage = "v$newVersion - $Message"
}

# 7. Commit
Write-Signal "STEP" "Commit en cours..."
git commit -m $commitMessage
if ($LASTEXITCODE -eq 0) {
    Write-Signal "SUCCESS" "Commit reussi: $commitMessage"
} else {
    Write-Signal "WARNING" "Rien a commiter ou erreur"
}

# 8. Creer le tag de version
Write-Signal "STEP" "Creation du tag v$newVersion..."
git tag -a "v$newVersion" -m "Version $newVersion"
if ($LASTEXITCODE -eq 0) {
    Write-Signal "SUCCESS" "Tag v$newVersion cree"
} else {
    Write-Signal "ERROR" "Erreur lors de la creation du tag"
}

# 9. Push vers GitHub
Write-Signal "STEP" "Push vers GitHub (commits + tags)..."
git push origin main
git push origin --tags
if ($LASTEXITCODE -eq 0) {
    Write-Signal "SUCCESS" "Push reussi vers GitHub"
} else {
    Write-Signal "ERROR" "Erreur lors du push"
}

# 10. Deploiement Vercel (automatique via GitHub integration)
Write-Signal "STEP" "Deploiement Vercel..."
Write-Signal "INFO" "Vercel detecte automatiquement le push GitHub"
Write-Signal "INFO" "Le deploiement est en cours sur Vercel..."

# 11. Resume final
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "   DEPLOIEMENT TERMINE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Signal "INFO" "Version deployee: v$newVersion"
Write-Signal "INFO" "Repository: https://github.com/peymard-actifit/genweb"
Write-Signal "INFO" "Vercel Dashboard: https://vercel.com/patrick-eymards-projects/genweb"
Write-Host ""
