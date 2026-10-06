import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import type { NodeHelperModule } from 'node_helper'
import NodeHelperMock from '../mocks/node-helper'
import * as Log from '../mocks/logger'

/** Load the actual CommonJS bundle with MagicMirror's two external modules supplied by the test. */
export function loadBuiltHelper(): new () => NodeHelperModule {
  const module = { exports: {} }
  const helperPath = new URL('../../../node_helper.js', import.meta.url)

  // Vitest's ESM aliases do not intercept CommonJS require calls inside a distributed bundle.
  runInNewContext(readFileSync(helperPath, 'utf8'), {
    module,
    Date,
    // The bundle runs in a fresh context without Node's web globals; delegate so tests can stub them.
    URL,
    AbortSignal,
    fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
    require(moduleName: string) {
      if (moduleName === 'node_helper') return NodeHelperMock
      if (moduleName === 'logger') return Log
      throw new Error(`Unexpected external module in the helper bundle: ${moduleName}`)
    },
  })

  return module.exports as new () => NodeHelperModule
}
