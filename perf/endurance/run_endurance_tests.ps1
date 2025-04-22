# Script para ejecutar pruebas de Artillery secuencialmente con una pausa

$testFiles = Get-ChildItem -Path ".\*.yaml" | Sort-Object Name
$pauseSeconds = 600 # 10 minutos * 60 segundos

foreach ($file in $testFiles) {
    Write-Host "Ejecutando prueba: $($file.BaseName).yaml"

    # Construir la ruta relativa al archivo YAML desde la raíz del proyecto
    $relativePath = "endurance\$($file.Name)"
    Write-Host "Intentando ejecutar: npm run artillery -- run '$relativePath' -e api"
    npm run artillery -- run "$relativePath" -e api

    Write-Host "Prueba finalizada. Esperando 10 minutos..."
    Start-Sleep -Seconds $pauseSeconds
    Write-Host "Continuando con la siguiente prueba."
}

Write-Host "Todas las pruebas han sido ejecutadas."