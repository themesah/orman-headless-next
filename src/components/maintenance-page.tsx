import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export interface MaintenancePageProps extends Omit<ComponentPropsWithoutRef<'main'>, 'title'> {
  title?: ReactNode
  /** The explanation under the title. */
  message?: ReactNode
  /** Extra content, e.g. the unlock or "notify me" form once 6.4 provides it. */
  children?: ReactNode
}

/**
 * What a gate answers with while maintenance is on. Unstyled and without client code, so it works as a server component and
 * as the body of a 503 answer. Class hooks: `orman-maintenance`, `__title`, `__message`, `__extra`.
 * (Countdown, the e-mail list form and the unlock field come with the Maintenance gate in 6.4.)
 */
export function MaintenancePage({ title = 'Back soon', message = 'The site is down for maintenance. Please check back shortly.', children, className, ...rest }: MaintenancePageProps) {
  return (
    <main {...rest} className={['orman-maintenance', className].filter(Boolean).join(' ')}>
      <h1 className="orman-maintenance__title">{title}</h1>
      {message ? <p className="orman-maintenance__message">{message}</p> : null}
      {children ? <div className="orman-maintenance__extra">{children}</div> : null}
    </main>
  )
}
