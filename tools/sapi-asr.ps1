$WavPath = $env:KJ_WAV
if (-not $WavPath -or -not (Test-Path $WavPath)) { Write-Output ""; exit 1 }
Add-Type -AssemblyName System.Speech
$culture = [System.Globalization.CultureInfo]::GetCultureInfo("zh-CN")
$rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine($culture)
$rec.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
$rec.SetInputToWaveFile($WavPath)
$sb = New-Object System.Text.StringBuilder
while ($true) {
  $r = $rec.Recognize()
  if ($null -eq $r) { break }
  [void]$sb.Append($r.Text)
}
$rec.Dispose()
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Output $sb.ToString()
