import React from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md'

const BASE =
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-40'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary:
    'border border-border text-text-secondary hover:bg-surface-muted ' +
    'dark:border-border-dark dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted',
  ghost: 'text-text-secondary hover:bg-surface-muted dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted',
}

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3.5 text-sm',
}

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}

/** The single button primitive: every page action uses one of these variants. */
export default function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', ...rest }: Props) {
  return <button type={type} className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`} {...rest} />
}
