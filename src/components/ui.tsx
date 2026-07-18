import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { IconX } from './icons'

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={
        'rounded-2xl border border-slate-100 bg-white shadow-card ' + className
      }
    >
      {children}
    </div>
  )
}

export function SectionTitle({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
      {icon}
      {children}
    </h2>
  )
}

const STAT_TONES = {
  indigo: { box: 'bg-indigo-50 text-indigo-500', value: 'text-indigo-600' },
  emerald: { box: 'bg-emerald-50 text-emerald-500', value: 'text-emerald-600' },
  amber: { box: 'bg-amber-50 text-amber-500', value: 'text-amber-600' },
  violet: { box: 'bg-violet-50 text-violet-500', value: 'text-violet-600' },
  rose: { box: 'bg-rose-50 text-rose-500', value: 'text-rose-600' },
  sky: { box: 'bg-sky-50 text-sky-500', value: 'text-sky-600' },
} as const
export type StatTone = keyof typeof STAT_TONES

export function StatCard({
  icon,
  label,
  value,
  tone = 'indigo',
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  tone?: StatTone
}) {
  const t = STAT_TONES[tone]
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ' + t.box}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm text-slate-500">{label}</div>
        <div className={'text-2xl font-bold ' + t.value}>{value}</div>
      </div>
    </Card>
  )
}

export function Badge({
  children,
  tone = 'slate',
}: {
  children: ReactNode
  tone?: 'slate' | 'green' | 'orange' | 'rose' | 'indigo' | 'amber'
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-100 text-emerald-700',
    orange: 'bg-orange-100 text-orange-600',
    rose: 'bg-rose-100 text-rose-600',
    indigo: 'bg-indigo-100 text-indigo-700',
    amber: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ' + tones[tone]}>
      {children}
    </span>
  )
}

type BtnVariant = 'primary' | 'ghost' | 'soft' | 'danger' | 'success'
export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: BtnVariant
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  const variants: Record<BtnVariant, string> = {
    primary:
      'bg-brand-gradient text-white shadow-sm hover:opacity-90',
    ghost: 'text-slate-600 hover:bg-slate-100',
    soft: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100',
    danger: 'bg-rose-500 text-white hover:bg-rose-600',
    success: 'bg-emerald-500 text-white hover:bg-emerald-600',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={
        'inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ' +
        variants[variant] +
        ' ' +
        className
      }
    >
      {children}
    </button>
  )
}

export function PillTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: ReactNode }[]
  active: T
  onChange: (k: T) => void
}) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={
            'rounded-lg px-4 py-1.5 text-sm font-medium transition ' +
            (active === t.key
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700')
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <IconX width={18} height={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  )
}

export function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-slate-400">
      <div className="mb-3 text-6xl opacity-40 grayscale">{emoji}</div>
      <div className="text-sm">{text}</div>
    </div>
  )
}
