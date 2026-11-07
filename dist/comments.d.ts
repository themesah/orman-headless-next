import * as react from 'react';
import { ApiOptions } from './csrf.js';
import { DiskussiyaBlock, SiteResponse, CommentStatus } from './types.js';
export { PublicComment } from './types.js';

interface CommentsLabels {
    title: string;
    empty: string;
    name: string;
    email: string;
    comment: string;
    submit: string;
    waiting: string;
    closed: string;
    loginRequired: string;
    reply: string;
}
declare const DEFAULT_COMMENTS_LABELS: CommentsLabels;
interface CommentsProps {
    /** `page.addons.diskussiya` of the cached page. */
    block: DiskussiyaBlock | null | undefined;
    /** The cached `/site` answer, for the captcha config. */
    site: Pick<SiteResponse, 'addons'>;
    labels?: Partial<CommentsLabels>;
    api?: ApiOptions;
    className?: string;
}
/**
 * The approved comments (public content, cached with the page) plus the form. A new comment is posted through `/!/` with the
 * signed context from the page and the captcha when the site asks for one; the author sees it at once as "waiting for approval"
 * (only in their own browser: the cached page never contains it). Never shows e-mails or addresses. Class hooks: `orman-comments`,
 * `__item` (`data-depth`, `data-pending`), `__author|__text|__date`, `__form`, `__closed`.
 */
declare function Comments({ block, site, labels, api: apiOptions, className }: CommentsProps): react.JSX.Element | null;
interface MyCommentsLabels {
    title: string;
    empty: string;
    signedOut: string;
    status: Record<CommentStatus, string>;
}
declare const DEFAULT_MY_COMMENTS_LABELS: MyCommentsLabels;
interface MyCommentsProps {
    /** `addons.diskussiya.mine`. Default `/!/diskussiya/mine`. */
    url?: string;
    labels?: Partial<Omit<MyCommentsLabels, 'status'>> & {
        status?: Partial<MyCommentsLabels['status']>;
    };
    api?: ApiOptions;
    onSignedOut?: () => void;
    className?: string;
}
/** The signed-in person's comments with their status, each linking to its page. Per-user, never cached. Hooks: `orman-my-comments`, `__item` (`data-status`). */
declare function MyComments({ url, labels, api: apiOptions, onSignedOut, className }: MyCommentsProps): react.JSX.Element;

export { Comments, type CommentsLabels, type CommentsProps, DEFAULT_COMMENTS_LABELS, DEFAULT_MY_COMMENTS_LABELS, MyComments, type MyCommentsLabels, type MyCommentsProps };
