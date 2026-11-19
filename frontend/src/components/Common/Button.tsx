import React from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md'

const BASE =
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium tracking-cn ' +
  'transition-[background-color,border-color,color,opacity] duration-150 disabled:cursor-not-allowed disabled:opacity-40'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-ink-950 text-white hover:opacity-90',
  secondary:
    'border border-line-300 text-ink-900 hover:border-[#C9CFDB] ' +
    'dark:border-border-dark dark:text-text-dark-primary dark:hover:border-[#3A404C]',
  ghost: 'text-ink-700 hover:bg-surface-muted dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted',
}

// 36px is the measured console action height. Size only changes type and inset.
const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-xs',
  md: 'h-9 px-[18px] text-sm',
}

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}

/** The single button primitive: every page action uses one of these variants. */
export default function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', ...rest }: Props) {
  return <button type={type} className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`} {...rest} />
}
