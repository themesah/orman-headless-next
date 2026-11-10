import { useEffect, useState } from 'react'
import type { ApiOptions } from '../csrf'
import { callAccount } from './account-api'
import type { MyScoreData, MyTasksData, ScoringSite } from '../types'

export interface MyScoreProps {
  site?: Pick<ScoringSite, 'my_score'>
  labels?: Partial<{ balance: string; badges: string; history: string; signedOut: string }>
  onSignedOut?: () => void
  api?: ApiOptions
  className?: string
}

/** The signed-in person's points, badges and recent history. Only their own ledger is ever asked for or sent. Class hooks `orman-score`, `__balance`, `__badge`, `__history`. */
export function MyScore({ site, labels, onSignedOut, api: apiOptions, className }: MyScoreProps) {
  const text = { balance: 'Points', badges: 'Badges', history: 'History', signedOut: 'Sign in to see your points.', ...labels }
  const [score, setScore] = useState<MyScoreData | null | undefined>(undefined)

  useEffect(() => {
    void callAccount(onSignedOut, apiOptions)<MyScoreData>('GET', site?.my_score ?? '/!/scoring/my-score').then(res => setScore(res.ok ? res.body : null))
  }, [apiOptions, onSignedOut, site?.my_score])

  const root = ['orman-score', className].filter(Boolean).join(' ')
  if (score === undefined) return <div className={root} aria-busy="true" />
  if (!score) return <p className={root}>{text.signedOut}</p>
  return (
    <section className={root}>
      <p className="orman-score__balance">
        {text.balance}: {score.balance}
      </p>
      {score.badges.length ? (
        <ul className="orman-score__badges" aria-label={text.badges}>
          {score.badges.map(badge => (
            <li key={badge.key} className="orman-score__badge" title={badge.description ?? undefined}>
              {badge.icon ? <img src={badge.icon} alt="" /> : null}
              {badge.name}
            </li>
          ))}
        </ul>
      ) : null}
      {score.history.length ? (
        <ul className="orman-score__history" aria-label={text.history}>
          {score.history.map((row, i) => (
            <li key={`${row.created_at}-${i}`}>
              {row.amount > 0 ? '+' : ''}
              {row.amount} {row.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export interface MyTasksProps {
  site?: Pick<ScoringSite, 'my_tasks' | 'submit'>
  labels?: Partial<{ empty: string; submit: string; pending: string; signedOut: string }>
  onSignedOut?: () => void
  api?: ApiOptions
  className?: string
}

/** The tasks open to the person, with a "submit" button for review tasks. Class hooks `orman-tasks`, `__task`, `__submit`, `__empty`. */
export function MyTasks({ site, labels, onSignedOut, api: apiOptions, className }: MyTasksProps) {
  const text = { empty: 'No tasks right now.', submit: 'Submit', pending: 'Waiting for review', signedOut: 'Sign in to see your tasks.', ...labels }
  const [data, setData] = useState<MyTasksData | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const call = callAccount(onSignedOut, apiOptions)

  async function load() {
    const res = await call<MyTasksData>('GET', site?.my_tasks ?? '/!/scoring/my-tasks')
    setData(res.ok ? res.body : null)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [site?.my_tasks])

  async function submit(id: string | number) {
    setError(null)
    const res = await call('POST', (site?.submit ?? '/!/scoring/tasks/{task}/submit').replace('{task}', encodeURIComponent(String(id))), {})
    if (!res.ok) return setError(res.message)
    await load()
  }

  const root = ['orman-tasks', className].filter(Boolean).join(' ')
  if (data === undefined) return <div className={root} aria-busy="true" />
  if (!data) return <p className={root}>{text.signedOut}</p>
  if (!data.tasks.length) return <p className={`${root} orman-tasks__empty`}>{text.empty}</p>
  const pending = new Set(data.pendingSubmissionTaskIds.map(String))
  return (
    <ul className={root}>
      {data.tasks.map(task => (
        <li key={task.id} className="orman-tasks__task">
          <strong>{task.title}</strong> <span>+{task.points}</span>
          {task.description ? <p>{task.description}</p> : null}
          {task.submit_url ? (
            pending.has(String(task.id)) ? (
              <em>{text.pending}</em>
            ) : (
              <button type="button" className="orman-tasks__submit" onClick={() => void submit(task.id)}>
                {text.submit}
              </button>
            )
          ) : null}
        </li>
      ))}
      {error ? <li role="alert">{error}</li> : null}
    </ul>
  )
}
