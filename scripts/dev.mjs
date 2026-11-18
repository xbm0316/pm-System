import { spawn } from 'node:child_process'

const helper = spawn(process.execPath, ['scripts/folder-helper.mjs'], { stdio: 'inherit', env: process.env })
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit', env: process.env })

function shutdown() {
  helper.kill('SIGTERM')
  vite.kill('SIGTERM')
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
vite.on('exit', (code) => { helper.kill('SIGTERM'); process.exit(code || 0) })
