const assert = require('assert')
const EventEmitter = require('events').EventEmitter
const each = require('stream-each')
const networkSpeed = require('hyperdrive-network-speed')
const bitfield = require('sparse-bitfield')

module.exports = function (archive) {
  assert.ok(archive, 'lib/stats archive required')
  const stats = new EventEmitter()
  const counted = bitfield()

  const count = {
    files: 0,
    byteLength: 0,
    length: 0,
    version: 0
  }

  update()
  if (!archive.writable) {
    count.downloaded = 0
    downloadStats()
  }

  // TODO: put in hyperdrive-stats
  stats.get = function () {
    return count
  }
  stats.network = networkSpeed(archive, { timeout: 2000 })

  Object.defineProperties(stats, {
    peers: {
      enumerable: true,
      get: function () {
        if (!archive.content || !archive.content.peers) return {} // TODO: how to handle this?
        const peers = archive.content.peers
        const total = peers.length
        const complete = peers.filter(function (peer) {
          return peer.remoteLength === archive.content.length
        }).length

        return {
          total: total,
          complete: complete
        }
      }
    }
  })

  return stats

  function downloadStats () {
    if (!archive.content) return archive.once('content', downloadStats)

    const feed = archive.content
    count.downloaded = 0
    for (let i = 0; i < feed.length; i++) {
      if (feed.has(i) && counted.set(i, true)) count.downloaded++
    }
    stats.emit('update')

    archive.content.on('download', countDown)
    archive.content.on('clear', checkDownloaded)

    function checkDownloaded (start, end) {
      for (; start < end; start++) {
        if (counted.set(start, false)) count.downloaded--
      }
      stats.emit('update')
    }

    function countDown (index, data) {
      if (counted.set(index, true)) count.downloaded++
      stats.emit('update')
    }
  }

  function update () {
    if (stableVersion()) return wait()

    // get current size of archive
    const current = archive.tree.checkout(archive.version)
    const initial = archive.tree.checkout(count.version)
    const stream = initial.diff(current, { dels: true, puts: true })
    each(stream, ondata, function () {
      count.version = current.version
      stats.emit('update', count)
      if (!stableVersion()) return update()
      wait()
    })

    function ondata (data, next) {
      if (data.type === 'del') {
        count.byteLength -= data.value.size
        count.length -= data.value.blocks
        count.files--
      } else {
        count.byteLength += data.value.size
        count.length += data.value.blocks
        count.files++
      }
      next()
    }

    function stableVersion () {
      if (archive.version < 0) return false
      return count.version === archive.version
    }

    function wait () {
      archive.metadata.update(update)
    }
  }
}
