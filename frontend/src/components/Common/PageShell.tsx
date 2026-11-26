import React from 'react'
import PageHeader from './PageHeader'

type Width = 'wide' | 'narrow'

type Props = {
  title: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  width?: Width
  children: React.ReactNode
}

const WIDTH: Record<Width, string> = {
  wide: 'max-w-[1200px]',
  narrow: 'max-w-[880px]',
}

/**
 * The scroll surface and gutter contract for console pages. Dashboards, tables
 * and graphs use `wide`; forms and reading pages use `narrow`. Nothing outside
 * this component declares its own page width.
 */
export default function PageShell({ title, icon, actions, width = 'wide', children }: Props) {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-canvas">
      <div className={`mx-auto w-full px-5 pb-20 pt-7 sm:px-8 ${WIDTH[width]}`}>
        <PageHeader title={title} icon={icon} actions={actions} />
        {children}
      </div>
    </main>
  )
}
