import * as react from 'react';
import { ComponentPropsWithoutRef, ReactNode } from 'react';
import { MaintenanceSite } from './types.js';

interface MaintenancePageProps extends Omit<ComponentPropsWithoutRef<'main'>, 'title'> {
    /** `addons.maintenance` of `/site`: the title, message, countdown, price, contact and the two forms come from it. */
    site?: Partial<MaintenanceSite>;
    /** Overrides the title / message from `site` (or stands in for them without it). */
    title?: ReactNode;
    message?: ReactNode;
    /** Extra content under the page. */
    children?: ReactNode;
}
/**
 * What a gate answers with while maintenance is on. Without client code of its own (the two forms are `<Form>`s), so it works as a
 * server component and as the body of a 503 answer. Class hooks: `orman-maintenance`, `__title`, `__message`, `__countdown`,
 * `__price`, `__contact`, `__subscribe`, `__unlock`, `__extra`. `renderMaintenanceHtml()` produces the same markup as a string, for
 * a `proxy.ts` that cannot render React.
 */
declare function MaintenancePage({ site, title, message, children, className, ...rest }: MaintenancePageProps): react.JSX.Element;

export { MaintenancePage, type MaintenancePageProps };
