import { buildReportRows, reportFileName, reportName, rowsToText, type ReportEntry } from '../../../presence/insights'

const save = (name: string, mime: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/** Build the report client-side and hand it to the browser. Returns false when a pop-up blocker stops the PDF window. */
export function downloadReport(e: ReportEntry, counts?: { source: string; count: number; avg: number }[]): boolean {
  const rows = buildReportRows(e.type, { start: e.start, end: e.end }, e.campaign, counts)
  if (e.format === 'CSV') { save(reportFileName(e), 'text/csv;charset=utf-8', rowsToText(rows, ',')); return true }
  if (e.format === 'XLSX') { save(reportFileName({ ...e, format: 'XLSX' }), 'application/vnd.ms-excel', rowsToText(rows, '\t')); return true }
  const win = window.open('', '_blank')
  if (!win) return false
  const body = rows.map((r, i) => (r.length ? `<tr>${r.map((c) => (i === 0 || r.length === 1 ? `<th>${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join('')}</tr>` : '<tr><td>&nbsp;</td></tr>')).join('')
  win.document.write(`<!doctype html><title>${esc(reportName(e.type))}</title><style>body{font:14px system-ui;margin:32px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:6px 10px;text-align:left}</style><h1>${esc(reportName(e.type))}</h1><table>${body}</table>`)
  win.document.close()
  win.focus()
  win.print()
  return true
}
