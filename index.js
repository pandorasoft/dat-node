const assert = require('assert')
const fs = require('fs')
const path = require('path')
const hyperdrive = require('hyperdrive')
const resolveDatLink = require('dat-link-resolve')
const debug = require('debug')('dat-node')
const datStore = require('./lib/storage')
const Dat = require('./dat')

module.exports = createDat

/**
 * Create a Dat instance, archive storage, and ready the archive.
 * @param {string|object} dirOrStorage - Directory or hyperdrive storage object.
 * @param {object} [opts] - Dat-node options and any hyperdrive init options.
 * @param {String|Buffer} [opts.key] - Hyperdrive key
 * @param {Boolean} [opts.createIfMissing = true] - Create storage if it does not exit.
 * @param {Boolean} [opts.errorIfExists = false] - Error if storage exists.
 * @param {Boolean} [opts.temp = false] - Use random-access-memory for temporary storage
 * @param {function(err, dat)} cb - callback that returns `Dat` instance
 * @see defaultStorage for storage information
 */
function createDat (dirOrStorage, opts, cb) {
  if (!cb) {
    cb = opts
    opts = {}
  }
  assert.ok(dirOrStorage, 'dat-node: directory or storage required')
  assert.strictEqual(typeof opts, 'object', 'dat-node: opts should be type object')
  assert.strictEqual(typeof cb, 'function', 'dat-node: callback required')

  let archive
  let key = opts.key
  const dir = (typeof dirOrStorage === 'string') ? dirOrStorage : null
  const storage = datStore(dirOrStorage, opts)
  const createIfMissing = !(opts.createIfMissing === false)
  const errorIfExists = opts.errorIfExists || false
  let hasDat = false
  opts = Object.assign({
    // TODO: make sure opts.dir is a directory, not file
    dir: dir,
    latest: true
  }, opts)

  if (!opts.dir) return create() // TODO: check other storage
  checkIfExists()

  /**
   * Check if archive storage folder exists.
   * @private
   */
  function checkIfExists () {
    // Create after we check for pre-sleep .dat stuff
    const createAfterValid = (createIfMissing && !errorIfExists)

    const missingError = new Error('Dat storage does not exist.')
    missingError.name = 'MissingError'
    const existsError = new Error('Dat storage already exists.')
    existsError.name = 'ExistsError'
    const oldError = new Error('Dat folder contains incompatible metadata. Please remove your metadata (rm -rf .dat).')
    oldError.name = 'IncompatibleError'

    fs.readdir(path.join(opts.dir, '.dat'), function (err, files) {
      // TODO: omg please make this less confusing.
      const noDat = !!(err || !files.length)
      hasDat = !noDat
      const validSleep = (files && files.length && files.indexOf('metadata.key') > -1)
      const badDat = !(noDat || validSleep)

      if ((noDat || validSleep) && createAfterValid) return create()
      else if (badDat) return cb(oldError)

      if (err && !createIfMissing) return cb(missingError)
      else if (!err && errorIfExists) return cb(existsError)

      return create()
    })
  }

  /**
   * Create the archive and call `archive.ready()` before callback.
   * Set `archive.resumed` if archive has a content feed.
   * @private
   */
  function create () {
    if (dir && !opts.temp && !key && (opts.indexing !== false)) {
      // Only set opts.indexing if storage is dat-storage
      // TODO: this should be an import option instead, https://github.com/mafintosh/hyperdrive/issues/160
      opts.indexing = true
    }
    if (!key) return createArchive()

    resolveDatLink(key, function (err, resolvedKey) {
      if (err) return cb(err)
      key = resolvedKey
      createArchive()
    })

    function createArchive () {
      archive = hyperdrive(storage, key, opts)
      archive.on('error', cb)
      archive.ready(function () {
        debug('archive ready. version:', archive.version)
        if (hasDat || (archive.metadata.has(0) && archive.version)) {
          archive.resumed = true
        } else {
          archive.resumed = false
        }
        archive.removeListener('error', cb)

        cb(null, Dat(archive, opts))
      })
    }
  }
}
