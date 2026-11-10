import * as react from 'react';
import { ReactNode } from 'react';
import { ApiOptions } from './csrf.js';
import { CoursesSite, LessonCompleted, CoursePageBlock, LessonPageBlock } from './types.js';

interface LockedLessonProps {
    /** `addons.courses` of the lesson page. */
    lesson: LessonPageBlock;
    /** `addons.courses` of the cached `/site`. */
    site?: Pick<CoursesSite, 'lesson' | 'enroll'>;
    /** The lesson's id (`page.id`). */
    lessonId: string;
    /** Rendered with the lesson's full `data` once the student may read it. */
    children: (data: Record<string, unknown>) => ReactNode;
    /** Shown while the person is not signed in or not enrolled. */
    locked?: ReactNode;
    onSignedOut?: () => void;
    api?: ApiOptions;
    className?: string;
}
/**
 * The lesson page is a stub everyone gets from the cache; the body is asked for here, per person (`private, no-store`). 200 → `children(data)`,
 * 401 / 403 → the locked state (`locked`, default a short text) with `data-reason="signed-out" | "not-enrolled"`. Class hook `orman-lesson`.
 */
declare function LockedLesson({ lesson, site, lessonId, children, locked, onSignedOut, api: apiOptions, className }: LockedLessonProps): react.JSX.Element;
interface CompleteLessonProps {
    lessonId: string;
    site?: Pick<CoursesSite, 'complete'>;
    labels?: Partial<{
        complete: string;
        completing: string;
        done: string;
        next: string;
    }>;
    /** Called with the answer: go to `next`, or celebrate `course_done`. */
    onCompleted?: (result: LessonCompleted) => void;
    onSignedOut?: () => void;
    api?: ApiOptions;
    className?: string;
}
/** The "mark as complete" button: `POST /!/courses/lessons/{id}/complete`. After it, a link to the next lesson. Class hooks `orman-complete`, `__button`, `__next`, `__error`. */
declare function CompleteLesson({ lessonId, site, labels, onCompleted, onSignedOut, api: apiOptions, className }: CompleteLessonProps): react.JSX.Element;
interface CourseProgressProps {
    /** `addons.courses` of the course page: the lessons in order. */
    course: CoursePageBlock;
    /** The course's id (`page.id`). */
    courseId: string;
    site?: Pick<CoursesSite, 'me'>;
    onSignedOut?: () => void;
    api?: ApiOptions;
    className?: string;
}
/** The syllabus with the person's progress: done lessons marked (`data-done`), the next one highlighted (`data-next`). A guest sees the plain list. Class hooks `orman-progress`, `__lesson`. */
declare function CourseProgress({ course, courseId, site, onSignedOut, api: apiOptions, className }: CourseProgressProps): react.JSX.Element;

export { CompleteLesson, type CompleteLessonProps, CourseProgress, type CourseProgressProps, LockedLesson, type LockedLessonProps };
