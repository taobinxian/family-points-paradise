// 开发模式：并行启动后端 API(tsx watch) 与前端(vite)，任一退出则全部退出
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// 用本地 node_modules/.bin，避免直接 `node scripts/dev.mjs` 时 PATH 找不到 tsx/vite
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const bin = (name) => join(root, 'node_modules', '.bin', name)

const procs = [
  { name: 'server', cmd: bin('tsx'), args: ['watch', 'server/index.ts'], color: '\x1b[36m' },
  { name: 'web', cmd: bin('vite'), args: [], color: '\x1b[35m' },
]

const children = procs.map((p) => {
  const child = spawn(p.cmd, p.args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    env: process.env,
  })
  const tag = `${p.color}[${p.name}]\x1b[0m `
  const pipe = (stream) => {
    stream.setEncoding('utf8')
    let buf = ''
    stream.on('data', (d) => {
      buf += d
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) process.stdout.write(tag + line + '\n')
    })
  }
  pipe(child.stdout)
  pipe(child.stderr)
  child.on('exit', (code) => {
    console.log(`${tag}退出 (code ${code})，正在关闭其它进程…`)
    shutdown()
  })
  return child
})

let closing = false
function shutdown() {
  if (closing) return
  closing = true
  for (const c of children) {
    try {
      c.kill('SIGTERM')
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => process.exit(0), 300)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
