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
    <header className="mb-6 flex items-center gap-2.5">
      {icon && <span className="shrink-0 text-accent">{icon}</span>}
      <h1 className="min-w-0 truncate text-xl font-semibold text-text-primary dark:text-text-dark-primary">{title}</h1>
      {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
