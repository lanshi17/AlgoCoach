import React from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md'

const BASE =
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium tracking-cn ' +
  'transition-[background-color,border-color,color,opacity] duration-150 disabled:cursor-not-allowed disabled:opacity-40'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-ink-950 text-canvas hover:bg-accent',
  secondary:
    'border border-line-300 bg-surface text-text-primary hover:border-ink-450 hover:bg-surface-soft',
  ghost: 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
}

// 36px is the console action height. Size only changes type and inset.
const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-meta',
  md: 'h-9 px-4 text-body',
}

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}

/** The single button primitive: every page action uses one of these variants. */
export default function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', ...rest }: Props) {
  return <button type={type} className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`} {...rest} />
}
