/// <reference lib="webworker" />
/** Dedicated worker for the SQL formatter: keeps `sql-formatter` isolated. */
import { serve, str } from './protocol'
import { formatSql, supportedDialects } from '@/tools/sql'

serve(async (kind, payload) => {
  switch (kind) {
    case 'sql-format':
      return formatSql(str(payload.input), {
        dialect: str(payload.dialect) || 'sql',
        uppercaseKeywords: payload.uppercaseKeywords !== false,
      })
    case 'sql-dialects':
      return supportedDialects()
    default:
      throw new Error(`Unknown job kind: ${kind}`)
  }
})
