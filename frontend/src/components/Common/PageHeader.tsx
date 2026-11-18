import React from 'react'

type Props = {
  title: string
  icon?: React.ReactNode
  actions?: React.ReactNode
}

/**
 * One page header for every route: icon + title, optional trailing actions.
 * No eyebrow, no subtitle — the controls below are the explanation.
 */
export default function PageHeader({ title, icon, actions }: Props) {
  return (
    <header className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
      {icon && <span className="shrink-0 text-accent">{icon}</span>}
      <h1 className="min-w-0 truncate text-2xl font-semibold tracking-title text-text-primary dark:text-text-dark-primary">{title}</h1>
      {actions && <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:ml-auto sm:w-auto">{actions}</div>}
    </header>
  )
}
