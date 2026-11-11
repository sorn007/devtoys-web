/// <reference lib="webworker" />
/** Dedicated worker for JSON→table/CSV so large documents never block the UI thread. */
import { serve, str } from './protocol'
import { jsonToTable, tableToCsv, type CsvOptions } from '@/tools/jsontable'

serve(async (kind, payload) => {
  switch (kind) {
    case 'json-table':
      return jsonToTable(str(payload.input))
    case 'table-csv':
      return tableToCsv(payload.table as never, {
        delimiter: payload.delimiter as CsvOptions['delimiter'],
        crlf: payload.crlf as boolean,
        safeExport: payload.safeExport as boolean,
      })
    default:
      throw new Error(`Unknown job kind: ${kind}`)
  }
})
