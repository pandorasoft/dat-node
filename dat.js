const assert = require('assert')
const path = require('path')

const untildify = require('untildify')
const importFiles = require('./lib/import-files')
// const Networker = require('@corestore/networker')
const createNetwork = require('./lib/network')
const stats = require('./lib/stats')
const serveHttp = require('./lib/serve')
const debug = require('debug')('dat-node')
const util = require('util');

module.exports = (...args) => new Dat(...args)

class Dat {
  constructor (archive, opts) {
    assert.ok(archive, 'archive required')

    this.archive = archive
    this.options = Object.assign({}, opts)
    if (opts.dir) {
      this.path = path.resolve(untildify(opts.dir))
    }
  }

  get key () {
    return this.archive.key
  }

  get live () {
    return this.archive.live
  }

  get resumed () {
    return this.archive.resumed
  }

  get writable () {
    return this.archive.metadata.writable
  }

  get version () {
    return this.archive.version
  }

  async join (opts) {

    var self = this
    if (!opts && self.options.network) opts = self.options.network // use previous options
    else opts = opts || {}

    var netOpts = Object.assign({}, {
      stream: function (peer) {
        var stream = self.archive.replicate({
          upload: !(opts.upload === false),
          download: !self.writable && opts.download,
          live: !opts.end
        })
        stream.on('close', function () {
          debug('Stream close')
        })
        stream.on('error', function (err) {
          debug('Replication error:', err.message)
        })
        stream.on('end', function () {
          self.downloaded = true
          debug('Replication stream ended')
        })
        return stream
      }
    }, opts)

    var network = self.network = await createNetwork(self.archive, netOpts)
    self.options.network = netOpts
    
    return network
  }

  leave (cb) {
    if (!cb) cb = noop
    if (!this || !this.network) return cb()
    debug('leaveNetwork()')
    // TODO: v8 unreplicate ?
    // this.archive.unreplicate()
    this.network.leave(this.archive.discoveryKey)
    this.network.destroy(cb)
    delete this.network
  }

  trackStats (opts) {
    opts = Object.assign({}, opts)
    this.stats = stats(this.archive, opts)
    return this.stats
  }

  importFiles (src, opts, cb) {
    if (!this.writable) throw new Error('Must be archive owner to import files.')
    if (typeof src !== 'string') return this.importFiles('', src, opts)
    if (typeof opts === 'function') return this.importFiles(src, {}, opts)

    const self = this
    src = src && src.length ? src : self.path
    opts = Object.assign({
      indexing: (opts && opts.indexing) || (src === self.path)
    }, opts)

    self.importer = importFiles(self.archive, src, opts, cb)
    self.options.importer = self.importer.options
    return self.importer
  }

  serveHttp (opts) {
    this.server = serveHttp(this.archive, opts)
    return this.server
  }

  close (cb) {
    cb = cb || noop
    if (this._closed) return cb(new Error('Dat is already closed'))

    var self = this
    self._closed = true

    debug('closing network')
    closeNet(function (err) {
      if (err) debug('Error while closing network:', err.message)
      debug('closing closeFileWatch')
      closeFileWatch(function () {
        // self.archive.unreplicate()
        debug('closing archive')
        self.archive.close(cb)
      })
    })

    function closeNet (cb) {
      if (!self.network) return cb()
      self.leave(cb)
    }

    function closeFileWatch (cb) {
      if (!self.importer) return cb()
      // Emitting an event, as imported doesn't emit an event on
      // destroy and there is no other means to see if this was called.
      self.importer.emit('destroy')
      self.importer.destroy()
      delete self.importer
      process.nextTick(cb)
    }
  }

  async joinNetwork({retry,lookup,announce,waitPeer = false,timeout}){
    const checker = async() => {
      try{
        
        if (this.stats.peers && this.stats.peers.total > 0) {
          return;
        }
  
        try{
          await util.promisify(this.leave).bind(dat)();
  
          await new Promise((resolve,reject)=>{
            setTimeout(()=>{
              return resolve();
            },1000);
          });
        }catch(err){
          throw new Error(`NETWORK_LEAVE_ERROR. Details:${err.message}`);
        }
        
        throw new Error('NETWORK_JOIN_ERROR');
      }catch(err){
        throw err;
      }
    }
  
    const run = () => {
      return new Promise(async (resolve, reject) => {
        try {
          await this.join({lookup:lookup,upload:announce});
          if(!waitPeer){
            return resolve();
          }
          /**jika server, maka langsung return */
          /**jika client, maka bisa nunggu sampai connect to peer */
  
          setTimeout(async()=>{
            try{
              console.log('checker');
              await checker();
              return resolve();
            }catch(err){
              return reject(err);
            }
          }, timeout)
        } catch (err) {
          return reject(err)
        }
      })
    }
  
    let stop = false
    let innerRetry = 0
    do {
      try {
        await run()
        stop = true
      } catch (err) {
        if (innerRetry > retry) {
          throw err;
        } else {
          innerRetry++
        }
      }
    } while (!stop)
  }
}

Dat.prototype.leaveNetwork = Dat.prototype.leave

function noop () { }
