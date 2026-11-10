import * as react from 'react';
import { ApiOptions } from './csrf.js';
import { ScoringSite } from './types.js';

interface MyScoreProps {
    site?: Pick<ScoringSite, 'my_score'>;
    labels?: Partial<{
        balance: string;
        badges: string;
        history: string;
        signedOut: string;
    }>;
    onSignedOut?: () => void;
    api?: ApiOptions;
    className?: string;
}
/** The signed-in person's points, badges and recent history. Only their own ledger is ever asked for or sent. Class hooks `orman-score`, `__balance`, `__badge`, `__history`. */
declare function MyScore({ site, labels, onSignedOut, api: apiOptions, className }: MyScoreProps): react.JSX.Element;
interface MyTasksProps {
    site?: Pick<ScoringSite, 'my_tasks' | 'submit'>;
    labels?: Partial<{
        empty: string;
        submit: string;
        pending: string;
        signedOut: string;
    }>;
    onSignedOut?: () => void;
    api?: ApiOptions;
    className?: string;
}
/** The tasks open to the person, with a "submit" button for review tasks. Class hooks `orman-tasks`, `__task`, `__submit`, `__empty`. */
declare function MyTasks({ site, labels, onSignedOut, api: apiOptions, className }: MyTasksProps): react.JSX.Element;

export { MyScore, type MyScoreProps, MyTasks, type MyTasksProps };
