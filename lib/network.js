const assert = require('assert')
const pump = require('pump')
const hyperswarm = require('hyperswarm')
const debug = require('debug')('dat-node')

module.exports = function (archive, opts, cb) {
  assert.ok(archive, 'dat-node: lib/network archive required')
  assert.ok(opts, 'dat-node: lib/network opts required')

  const DEFAULT_PORT = 3282
  const swarm = hyperswarm()
  swarm.listen(DEFAULT_PORT)
  swarm.once('error', function (err) {
    if (err) debug('ERROR:', err.stack)
    swarm.listen(0)
  })
  swarm.on('connection', function (socket, info) {
    pump(socket, opts.stream(info), socket, function (err) {
      if (err) return cb(err)
    })
  })
  swarm.join(archive.discoveryKey, {
    lookup: !(opts.lookup === false),
    announce: !(opts.upload === false)
  }, cb)

  return swarm
}
