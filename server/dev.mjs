import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const relayScript = fileURLToPath(new URL('./controller-relay.mjs', import.meta.url))

const children = [
  spawn(process.execPath, [relayScript], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, [viteBin, '--host', '0.0.0.0', '--port', '8050'], { cwd: root, stdio: 'inherit' }),
]

let stopping = false
function shutdown(signal = 'SIGTERM') {
  if (stopping) return
  stopping = true
  children.forEach((child) => {
    if (!child.killed) child.kill(signal)
  })
}

children.forEach((child) => {
  child.on('exit', (code) => {
    if (!stopping && code) {
      shutdown()
      process.exitCode = code
    }
  })
})

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

