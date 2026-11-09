import { AnalitikaSite } from './types.js';

interface PageViewProps {
    /** `addons.analitika` of the cached `/site`. Absent (the addon is off, or views are not counted) renders and sends nothing. */
    site: AnalitikaSite | undefined;
    /** The entry's id (`page.data.id`), so the dashboard can name the page. */
    entryId?: string;
    /** The path to count. Default: the current address. */
    path?: string;
    /** Do not count visitors whose browser says Do Not Track / Global Privacy Control. Default true: the addon stores no cookie and no address, so this is a courtesy, not a requirement. */
    respectDnt?: boolean;
}
/** The request that counts one view, or null when the browser asks not to be counted. Exported for the tests. */
declare function hitUrl(site: AnalitikaSite, input: {
    path: string;
    entryId?: string;
    referrer?: string;
    host?: string;
}): string;
/** Host of the page the visitor came from; nothing for a direct visit or a link from the site itself. */
declare function referrerHost(referrer: string | undefined, ownHost: string | undefined): string | undefined;
/**
 * Counts one page view in the Analitika addon, from the visitor's browser: the same pixel `{{ analitika:pixel }}` prints on Blade pages
 * (`GET /!/analitika/hit`), so the addon filters bots by user agent as ever, and, through the proxy, sees the visitor's own address
 * only via the edge secret. Put it in a page's template (once per page), not in the layout, so a page that is not an entry is not counted.
 * A page is counted once per path: re-renders, Strict Mode's second effect and a navigation to the same path send nothing more.
 * No cookie is sent or stored (`credentials: 'omit'`); the answer is `no-store`. Renders nothing.
 */
declare function PageView({ site, entryId, path, respectDnt }: PageViewProps): null;

export { PageView, type PageViewProps, hitUrl, referrerHost };
