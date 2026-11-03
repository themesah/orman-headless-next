import * as react from 'react';
import { ComponentPropsWithoutRef, ReactNode } from 'react';

interface MaintenancePageProps extends Omit<ComponentPropsWithoutRef<'main'>, 'title'> {
    title?: ReactNode;
    /** The explanation under the title. */
    message?: ReactNode;
    /** Extra content, e.g. the unlock or "notify me" form once 6.4 provides it. */
    children?: ReactNode;
}
/**
 * What a gate answers with while maintenance is on. Unstyled and without client code, so it works as a server component and
 * as the body of a 503 answer. Class hooks: `orman-maintenance`, `__title`, `__message`, `__extra`.
 * (Countdown, the e-mail list form and the unlock field come with the Maintenance gate in 6.4.)
 */
declare function MaintenancePage({ title, message, children, className, ...rest }: MaintenancePageProps): react.JSX.Element;

export { MaintenancePage, type MaintenancePageProps };
