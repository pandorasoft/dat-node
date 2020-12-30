const assert = require('assert')
const path = require('path')

const untildify = require('untildify')
const importFiles = require('./lib/import-files')
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
    this.network = await createNetwork(this.archive, opts);
  }

  async leave () {
    if (!this || !this.network) return;
    debug('leaveNetwork()')
    
    await this.network.configure(this.archive.discoveryKey, {announce:false,lookup:false});
    await this.network.close();
    delete this.network;
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

  async close () {
    if (this._closed) return;

    this._closed = true;

    debug('closing network');
    if(this.network){
      await this.leave();
    }

    debug('closing closeFileWatch');
    if(this.importer){
      this.importer.emit('destroy')
      this.importer.destroy()
      delete this.importer
    }

    await util.promisify(this.archive.close).bind(this.archive)();
  }

  async joinNetwork({retry,lookup,announce,waitPeer = false,timeout}){
    const checker = async() => {
      try{
        const stats = this.stats ? JSON.stringify(this.stats.get()) : {};
        const peers = this.network.peers.size;
        const connections = this.network.swarm.connections.size;
        const swarmPeers = this.network.swarm.peers;
        const statsPeers = this.stats && this.stats.peers ? this.stats.peers : 0;
        console.log('peers',peers,'connections',connections,'swarm peers',swarmPeers,'stats peers',statsPeers,'speed','stats',stats);
        if (peers > 0) {
          return;
        }
  
        try{
          /**TODO consider to just leave instead of close the network for performance optimazion */
          await this.leave();
  
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
