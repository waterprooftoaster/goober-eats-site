// Replaces the throwing `server-only` module with a no-op when running
// node/tsx scripts outside of Next.js. Use with --require=scripts/server-only-stub.cjs.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module')
const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'server-only') return {}
  return originalLoad.call(this, request, parent, isMain)
}
