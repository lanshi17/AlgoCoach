import React from 'react'

type Props = {
  title: string
  icon?: React.ReactNode
  actions?: React.ReactNode
}

/**
 * One masthead for every console route: icon tile, page title, trailing actions,
 * and a hairline that closes the block. No eyebrow, no subtitle — the controls
 * below explain the page.
 */
export default function PageHeader({ title, icon, actions }: Props) {
  return (
    <header className="mb-7 flex flex-wrap items-center gap-x-3 gap-y-3 border-b border-border pb-4">
      {icon && (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-border bg-surface text-accent">
          {icon}
        </span>
      )}
      <h1 className="min-w-0 truncate text-page font-semibold tracking-title text-text-primary">{title}</h1>
      {actions && <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{actions}</div>}
    </header>
  )
}
