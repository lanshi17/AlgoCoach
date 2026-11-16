import React from 'react'

type Props = {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}

/**
 * One switch primitive. The knob is laid out by flexbox padding, not by an
 * absolute translate, so it can never sit outside the track; the track is
 * coloured only when the setting is on.
 */
export default function Switch({ checked, onChange, label, disabled = false }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
                  disabled:cursor-not-allowed disabled:opacity-40 ${
                    checked
                      ? 'justify-end bg-accent'
                      : 'justify-start bg-text-muted/45 ring-1 ring-inset ring-border dark:bg-text-dark-muted/55 dark:ring-border-dark'
                  }`}
    >
      <span className="h-4 w-4 rounded-full bg-white shadow-sm ring-1 ring-black/5" />
    </button>
  )
}
