' Uruchamia pc-cron.ps1 bez żadnego okna konsoli.
CreateObject("WScript.Shell").Run "powershell -NoProfile -ExecutionPolicy Bypass -File """ & Replace(WScript.ScriptFullName, ".vbs", ".ps1") & """", 0, True
