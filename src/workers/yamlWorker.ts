/// <reference lib="webworker" />
/** Dedicated worker for the JSON<>YAML tool: keeps `yaml` out of every other chunk. */
import { serve, str } from './protocol'
import { jsonToYaml, yamlToJson } from '@/tools/yamlx'

serve(async (kind, payload) => {
  switch (kind) {
    case 'yaml-to-json':
      return yamlToJson(str(payload.input))
    case 'json-to-yaml':
      return jsonToYaml(str(payload.input))
    default:
      throw new Error(`Unknown job kind: ${kind}`)
  }
})
