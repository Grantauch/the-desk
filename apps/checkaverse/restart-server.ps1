# Restarts only the Checkaverse server. run-server.cmd starts it again within five seconds.
# Matches the node process whose parent is the cmd running run-server.cmd, so other node programs are never touched.
$loops = Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" | Where-Object { $_.CommandLine -like '*\Checklings\checkaverse\run-server.cmd*' }
foreach ($loop in $loops) {
  Get-CimInstance Win32_Process -Filter "Name='node.exe' AND ParentProcessId=$($loop.ProcessId)" | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
    "Stopped Checkaverse server $($_.ProcessId)"
  }
}
