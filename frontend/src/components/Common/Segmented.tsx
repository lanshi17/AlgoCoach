import React from 'react'

type Option<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
  label: string
}

/**
 * Two-or-more exclusive views. Every option stays visible and the active one is
 * filled, so the current state is legible without reading a label twice.
 */
export default function Segmented<T extends string>({ value, options, onChange, label }: Props<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-md border border-border p-0.5 dark:border-border-dark"
    >
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`h-7 rounded px-2.5 text-xs transition-colors ${
            value === option.value
              ? 'bg-accent text-white'
              : 'text-text-secondary hover:bg-surface-muted dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
