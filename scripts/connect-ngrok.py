#!/usr/bin/env python3
"""Configure the project-local ngrok agent without logging its token."""
from getpass import getpass
from pathlib import Path
import json
import os
import subprocess

root = Path(__file__).resolve().parents[1]
config = root / '.data' / 'ngrok.yml'
config.parent.mkdir(mode=0o700, exist_ok=True)
if not config.exists():
    token = getpass('Paste your ngrok authtoken (hidden): ').strip()
    if not token or any(c.isspace() for c in token):
        raise SystemExit('Invalid token format; nothing saved.')
    fd = os.open(config, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as output:
        output.write('version: "3"\nagent:\n  authtoken: ' + json.dumps(token) + '\n')
    del token
result = subprocess.run([str(root / '.tools' / 'ngrok'), 'config', 'check', '--config', str(config)], capture_output=True)
if result.returncode:
    raise SystemExit('ngrok configuration check failed; token was not printed.')
print('Starting your account-assigned fixed HTTPS domain. Keep this window open.')
os.execv(str(root / '.tools' / 'ngrok'), ['ngrok', 'http', 'http://127.0.0.1:10300', '--config', str(config), '--inspect=false'])
