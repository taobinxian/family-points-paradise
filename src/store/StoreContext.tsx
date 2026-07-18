import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AppState } from '../types'

// 基址感知：部署在子路径（如 /jifen/）时，API 也走同一前缀 → /jifen/api
const API = import.meta.env.BASE_URL.replace(/\/+$/, '') + '/api'

// ---------- Toast ----------
export type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface StoreValue {
  state: AppState
  /** 以纯函数变换 state，本地乐观更新并异步落库到后端 SQLite */
  mutate: (fn: (s: AppState) => AppState) => void
  reset: () => void
  toast: (message: string, kind?: ToastKind) => void
}

const StoreCtx = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)

  // 乐观并发：authRef=最近一次服务端确认的权威状态；revRef=对应版本号；writeQueue=串行化写队列
  const authRef = useRef<AppState | null>(null)
  const revRef = useRef<string>('0')
  const writeQueue = useRef<Promise<void>>(Promise.resolve())

  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = (toastId.current += 1)
    setToasts((t) => [...t, { id, kind, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400)
  }, [])

  // 首次从后端加载（记录初始 rev）
  useEffect(() => {
    let alive = true
    fetch(`${API}/state`)
      .then((r) => (r.ok ? r.json().then((s) => ({ s, rev: r.headers.get('ETag') })) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(({ s, rev }: { s: AppState; rev: string | null }) => {
        if (!alive) return
        authRef.current = s
        revRef.current = rev ?? '0'
        setState(s)
      })
      .catch((e) => alive && setError(String(e.message || e)))
    return () => {
      alive = false
    }
  }, [])

  // 回读服务端权威状态对账（网络失败/冲突耗尽时用）
  const reconcile = useCallback(async () => {
    try {
      const r = await fetch(`${API}/state`)
      if (!r.ok) return
      const s = (await r.json()) as AppState
      authRef.current = s
      revRef.current = r.headers.get('ETag') ?? revRef.current
      setState(s)
    } catch {
      /* 网络仍不可用，保持现状 */
    }
  }, [])

  // 串行化落库：在最新权威状态上重放纯函数变更；If-Match 冲突(409)时基于服务端最新状态重放并重试
  const persist = useCallback(
    (fn: (s: AppState) => AppState) => {
      const run = async () => {
        for (let attempt = 0; attempt < 5; attempt++) {
          const base = authRef.current
          if (!base) return
          const next = fn(base)
          let res: Response
          try {
            res = await fetch(`${API}/state`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'If-Match': revRef.current },
              body: JSON.stringify(next),
            })
          } catch {
            toast('保存失败，请检查后端服务', 'error')
            // 回读服务端权威状态对账，避免本地停留在未落库的乐观状态
            await reconcile()
            return
          }
          if (res.status === 409) {
            // 版本冲突：采用服务端最新状态为新基线，下一轮用同一 fn 重放
            const latest = (await res.json()) as AppState
            authRef.current = latest
            revRef.current = res.headers.get('ETag') ?? revRef.current
            setState(latest)
            continue
          }
          if (!res.ok) {
            toast('保存失败，请检查后端服务', 'error')
            await reconcile()
            return
          }
          const saved = (await res.json()) as AppState
          authRef.current = saved
          revRef.current = res.headers.get('ETag') ?? revRef.current
          setState(saved)
          return
        }
        toast('保存冲突过多，请刷新重试', 'error')
        await reconcile()
      }
      // 串行执行，保证同一时刻只有一个 PUT 在途
      writeQueue.current = writeQueue.current.then(run, run)
    },
    [toast, reconcile],
  )

  const mutate = useCallback(
    (fn: (s: AppState) => AppState) => {
      setState((prev) => (prev ? fn(prev) : prev)) // 乐观更新
      persist(fn)
    },
    [persist],
  )

  const reset = useCallback(() => {
    fetch(`${API}/reset`, { method: 'POST' })
      .then((r) => r.json().then((s) => ({ s, rev: r.headers.get('ETag') })))
      .then(({ s, rev }: { s: AppState; rev: string | null }) => {
        authRef.current = s
        revRef.current = rev ?? revRef.current
        setState(s)
        toast('已恢复初始数据')
      })
      .catch(() => toast('恢复失败', 'error'))
  }, [toast])

  const value = useMemo<StoreValue | null>(
    () => (state ? { state, mutate, reset, toast } : null),
    [state, mutate, reset, toast],
  )

  if (error && !state) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 text-slate-500">
        <div className="text-4xl">😵</div>
        <div>无法连接后端服务：{error}</div>
        <div className="text-sm text-slate-400">请确认后端已启动（npm run dev 或 npm start）</div>
      </div>
    )
  }

  if (!value) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">
        <div className="animate-pulse text-lg">🏆 家庭积分乐园 加载中…</div>
      </div>
    )
  }

  return (
    <StoreCtx.Provider value={value}>
      {children}
      <ToastHost toasts={toasts} />
    </StoreCtx.Provider>
  )
}

function ToastHost({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed left-1/2 top-6 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={
            'pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg ' +
            (t.kind === 'success'
              ? 'bg-emerald-500'
              : t.kind === 'error'
                ? 'bg-rose-500'
                : 'bg-slate-700')
          }
        >
          <span>{t.kind === 'success' ? '✅' : t.kind === 'error' ? '⚠️' : 'ℹ️'}</span>
          {t.message}
        </div>
      ))}
    </div>
  )
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore 必须在 StoreProvider 内使用')
  return ctx
}
