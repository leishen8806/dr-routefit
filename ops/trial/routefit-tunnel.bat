@echo off
REM Replace placeholders before use; do not commit real VPS addresses.
REM -T: the server forbids a terminal (PTY); without it the tunnel does not stay up.
ssh -T -p <SSH_PORT> -L 4180:127.0.0.1:4180 <EMPLOYEE_ACCOUNT>@<VPS_ADDRESS>
