/**
 * The demo agent used to be "Agent Arjunan" and is now "Matt Reeves". Data already saved in a browser still has the old
 * name, and a changed seed never overwrites saved data, so saved state is renamed as it is loaded. Edits are kept.
 * (The internal id `arjunan` and its URLs are unchanged.)
 */
const RENAMES: [string, string][] = [
  ['Agent Arjunan', 'Matt Reeves'],
  ['agentarjunan', 'mattreeves'],
  ['agent-arjunan', 'matt-reeves'],
  ['arjunan@newamerican.example', 'matt.reeves@newamerican.example'],
  ['arjunan.example.com', 'mattreeves.example.com'],
  ['Arjunan found us', 'Matt found us'],
  ['Hi Arjunan', 'Hi Matt'],
  ['lender-profile/arjunan', 'lender-profile/matt-reeves'],
  ['newamericanfunding.com/arjunan', 'newamericanfunding.com/matt-reeves'],
  ['newamerican.example/arjunan', 'newamerican.example/matt-reeves'],
]

export const renameLegacy = (raw: string): string => RENAMES.reduce((s, [from, to]) => s.split(from).join(to), raw)
