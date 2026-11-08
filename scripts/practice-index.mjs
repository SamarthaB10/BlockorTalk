import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const python = process.env.PYTHON || (existsSync('.venv/bin/python') ? '.venv/bin/python' : 'python3');
const result = spawnSync(python, ['-m', 'detection.practice_index'], { env: process.env, stdio: 'inherit' });
if (result.error) console.error('Python could not start. Install requirements.txt and set PYTHON if needed.');
process.exit(result.status ?? 1);
