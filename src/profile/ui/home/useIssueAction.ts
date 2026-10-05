import { useNavigate } from 'react-router-dom'
import type { OsIssue } from '../../../presence/noraOs'
import { useNoraFix } from '../../NoraContext'
import type { RecActionId } from '../../selectors'

/**
 * What a click on an issue does, in one place: NORA runs it when it can, a profile suggestion opens its editor, anything
 * else goes to the page that fixes it. Every issue comes from real application state (see `collectIssues`).
 */
export function useIssueAction(onProfile: (id: RecActionId) => void): (issue: OsIssue) => void {
  const nav = useNavigate()
  const fix = useNoraFix()
  return (issue) => {
    if (issue.nora) return fix(issue.nora)
    if (issue.id.startsWith('profile:')) return onProfile(issue.id.slice('profile:'.length) as RecActionId)
    nav(issue.to)
  }
}
