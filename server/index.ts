// 轻量 HTTP 服务端：/api 提供数据，生产环境同时托管构建后的前端（单进程可部署）
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join, normalize, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadState, saveState, resetToSeed, ensureSeeded, getRev, bumpRev, DB_PATH } from './db.ts'
import type { AppState } from '../src/types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST_DIR = join(__dirname, '..', 'dist')
const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '0.0.0.0'
const PROD = process.env.NODE_ENV === 'production'

ensureSeeded()

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

function sendJson(
  res: import('node:http').ServerResponse,
  code: number,
  data: unknown,
  rev?: number,
) {
  const body = JSON.stringify(data)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,If-Match',
    'Access-Control-Expose-Headers': 'ETag',
  }
  if (rev !== undefined) headers['ETag'] = String(rev)
  res.writeHead(code, headers)
  res.end(body)
}

const MAX_BODY_BYTES = 5_000_000

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let settled = false
    req.on('data', (c: Buffer) => {
      if (settled) return
      size += c.length // Buffer 字节数（而非 UTF-16 字符数）
      if (size > MAX_BODY_BYTES) {
        settled = true
        req.destroy() // 立即断开并停止累积，防止无界缓冲导致进程崩溃
        reject(new Error('payload too large'))
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      if (settled) return
      settled = true
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', (e) => {
      if (settled) return
      settled = true
      reject(e)
    })
  })
}

async function serveStatic(res: import('node:http').ServerResponse, urlPath: string): Promise<void> {
  // 防目录穿越
  const clean = normalize(urlPath).replace(/^(\.\.[/\\])+/, '')
  let filePath = join(DIST_DIR, clean === '/' ? 'index.html' : clean)
  try {
    const s = await stat(filePath)
    if (s.isDirectory()) filePath = join(filePath, 'index.html')
    const buf = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' })
    res.end(buf)
  } catch {
    // SPA fallback → index.html
    try {
      const buf = await readFile(join(DIST_DIR, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(buf)
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)
  const path = url.pathname

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {})
    return
  }

  // ---- API ----
  if (path === '/api/state') {
    try {
      if (req.method === 'GET') {
        sendJson(res, 200, loadState(), getRev())
        return
      }
      if (req.method === 'PUT') {
        // 乐观并发：If-Match 与当前 rev 不一致 → 409 + 返回最新状态，客户端在最新状态上重放变更
        const ifMatch = req.headers['if-match']
        if (ifMatch !== undefined && String(ifMatch) !== String(getRev())) {
          sendJson(res, 409, loadState(), getRev())
          return
        }
        const body = await readBody(req)
        const state = JSON.parse(body) as AppState
        if (!state || !Array.isArray(state.members)) {
          sendJson(res, 400, { error: 'invalid state' })
          return
        }
        saveState(state)
        const rev = bumpRev()
        sendJson(res, 200, loadState(), rev)
        return
      }
    } catch (e) {
      sendJson(res, 500, { error: String((e as Error).message) })
      return
    }
    sendJson(res, 405, { error: 'method not allowed' })
    return
  }

  if (path === '/api/reset' && req.method === 'POST') {
    const state = resetToSeed()
    sendJson(res, 200, state, getRev())
    return
  }

  if (path === '/api/health') {
    sendJson(res, 200, { ok: true, db: DB_PATH })
    return
  }

  if (path.startsWith('/api/')) {
    sendJson(res, 404, { error: 'not found' })
    return
  }

  // ---- 静态前端（生产环境） ----
  if (PROD) {
    await serveStatic(res, path)
    return
  }

  // 开发环境下前端由 vite 提供，这里只兜底提示
  sendJson(res, 404, { error: 'dev mode: 前端请访问 vite (5173)' })
})

server.listen(PORT, HOST, () => {
  console.log(`[server] 家庭积分乐园 API 运行于 http://${HOST}:${PORT}  (${PROD ? '生产·托管前端' : '开发'})`)
  console.log(`[server] 数据库: ${DB_PATH}`)
})
