import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, type ApiOptions } from '../csrf'
import { callAccount } from './account-api'
import type { CoursePageBlock, CoursesSite, LessonCompleted, LessonPageBlock, MyCourses } from '../types'

export interface LockedLessonProps {
  /** `addons.courses` of the lesson page. */
  lesson: LessonPageBlock
  /** `addons.courses` of the cached `/site`. */
  site?: Pick<CoursesSite, 'lesson' | 'enroll'>
  /** The lesson's id (`page.id`). */
  lessonId: string
  /** Rendered with the lesson's full `data` once the student may read it. */
  children: (data: Record<string, unknown>) => ReactNode
  /** Shown while the person is not signed in or not enrolled. */
  locked?: ReactNode
  onSignedOut?: () => void
  api?: ApiOptions
  className?: string
}

/**
 * The lesson page is a stub everyone gets from the cache; the body is asked for here, per person (`private, no-store`). 200 → `children(data)`,
 * 401 / 403 → the locked state (`locked`, default a short text) with `data-reason="signed-out" | "not-enrolled"`. Class hook `orman-lesson`.
 */
export function LockedLesson({ lesson, site, lessonId, children, locked, onSignedOut, api: apiOptions, className }: LockedLessonProps) {
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'open'; data: Record<string, unknown> } | { kind: 'locked'; reason: 'signed-out' | 'not-enrolled' }>({ kind: 'loading' })

  useEffect(() => {
    const url = (site?.lesson ?? '/!/courses/lessons/{id}').replace('{id}', encodeURIComponent(lessonId))
    void api<{ data: Record<string, unknown> }>('GET', url, undefined, apiOptions).then(res => {
      if (res.ok) return setState({ kind: 'open', data: res.body.data })
      if (res.status === 401) onSignedOut?.()
      setState({ kind: 'locked', reason: res.status === 401 ? 'signed-out' : 'not-enrolled' })
    })
  }, [apiOptions, lessonId, onSignedOut, site?.lesson])

  const root = ['orman-lesson', className].filter(Boolean).join(' ')
  if (state.kind === 'loading') return <div className={root} aria-busy="true" />
  if (state.kind === 'locked') {
    return (
      <div className={`${root} orman-lesson--locked`} data-reason={state.reason}>
        {locked ?? <p>{state.reason === 'signed-out' ? 'Sign in to read this lesson.' : 'Enroll in the course to read this lesson.'}</p>}
        {lesson.course ? <a href={lesson.course.uri ?? '#'}>{lesson.course.title}</a> : null}
      </div>
    )
  }
  return <div className={root}>{children(state.data)}</div>
}

export interface CompleteLessonProps {
  lessonId: string
  site?: Pick<CoursesSite, 'complete'>
  labels?: Partial<{ complete: string; completing: string; done: string; next: string }>
  /** Called with the answer: go to `next`, or celebrate `course_done`. */
  onCompleted?: (result: LessonCompleted) => void
  onSignedOut?: () => void
  api?: ApiOptions
  className?: string
}

/** The "mark as complete" button: `POST /!/courses/lessons/{id}/complete`. After it, a link to the next lesson. Class hooks `orman-complete`, `__button`, `__next`, `__error`. */
export function CompleteLesson({ lessonId, site, labels, onCompleted, onSignedOut, api: apiOptions, className }: CompleteLessonProps) {
  const text = { complete: 'Mark as complete', completing: 'Saving…', done: 'Completed', next: 'Next lesson', ...labels }
  const [result, setResult] = useState<LessonCompleted | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function complete() {
    setBusy(true)
    setError(null)
    const url = (site?.complete ?? '/!/courses/lessons/{id}/complete').replace('{id}', encodeURIComponent(lessonId))
    const res = await callAccount(onSignedOut, apiOptions)<LessonCompleted>('POST', url)
    setBusy(false)
    if (!res.ok) return setError(res.message)
    setResult(res.body)
    onCompleted?.(res.body)
  }

  return (
    <div className={['orman-complete', className].filter(Boolean).join(' ')}>
      <button type="button" className="orman-complete__button" disabled={busy || !!result} onClick={() => void complete()}>
        {result ? text.done : busy ? text.completing : text.complete}
      </button>
      {result?.next ? (
        <a className="orman-complete__next" href={result.next.uri ?? '#'}>
          {text.next}: {result.next.title}
        </a>
      ) : null}
      {error ? <p role="alert" className="orman-complete__error">{error}</p> : null}
    </div>
  )
}

export interface CourseProgressProps {
  /** `addons.courses` of the course page: the lessons in order. */
  course: CoursePageBlock
  /** The course's id (`page.id`). */
  courseId: string
  site?: Pick<CoursesSite, 'me'>
  onSignedOut?: () => void
  api?: ApiOptions
  className?: string
}

/** The syllabus with the person's progress: done lessons marked (`data-done`), the next one highlighted (`data-next`). A guest sees the plain list. Class hooks `orman-progress`, `__lesson`. */
export function CourseProgress({ course, courseId, site, onSignedOut, api: apiOptions, className }: CourseProgressProps) {
  const [mine, setMine] = useState<MyCourses | null>(null)

  useEffect(() => {
    void callAccount(onSignedOut, apiOptions)<MyCourses>('GET', site?.me ?? '/!/courses/me').then(res => res.ok && setMine(res.body))
  }, [apiOptions, onSignedOut, site?.me])

  const done = new Set(mine?.completed ?? [])
  const nextId = mine?.courses.find(c => c.id === courseId)?.next?.id
  return (
    <ol className={['orman-progress', className].filter(Boolean).join(' ')}>
      {course.lessons.map(lesson => (
        <li key={lesson.id} className="orman-progress__lesson" data-done={done.has(lesson.id) || undefined} data-next={lesson.id === nextId || undefined}>
          <a href={lesson.uri ?? '#'}>{lesson.title}</a>
        </li>
      ))}
    </ol>
  )
}
