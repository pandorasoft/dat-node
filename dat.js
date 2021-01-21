const assert = require('assert')
const path = require('path')

const untildify = require('untildify')
const importFiles = require('./lib/import-files')
const createNetwork = require('./lib/network')
const stats = require('./lib/stats')
const serveHttp = require('./lib/serve')
const debug = require('debug')('arsel:Dat')
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

  async join (opts,swarmOpts = {},replicateOpts = {}) {
    if(this.network){
      debug('this.network exists - leave');
      await this.leave();
    }

    opts = Object.assign({
      announce:true,
      lookup:true,
      flush:true
    },opts);

    const _replicationOpts = Object.assign({
      download:true,
      upload:true,
      live:true
    },replicateOpts);

    this.network = await createNetwork(this.archive, swarmOpts,_replicationOpts);
    await this.network.configure(this.archive.discoveryKey, opts);
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

    /**bug from hyperdrive, when close it doesn't close this storage causing problem when fs.emptyDir Permission Denied */
    if(this.archive._latestStorage){
      try{
        await util.promisify(this.archive._latestStorage.destroy).bind(this.archive._latestStorage)();
      }catch(err){
        debug('bug hyperdrive',err);
      }
    }

    await util.promisify(this.archive.close).bind(this.archive)();
  }

  test(){
    if(this.network){
      const peers = this.network.peers.size;
      const connections = this.network.swarm.connections.size;
      const swarmPeers = this.network.swarm.peers;
      debug('network','peers',peers,'connections',connections,'swarm peers',swarmPeers);
    }else{
      debug('joinNetwork disabled')
    }

    if(this.stats){
      const peers = this.stats.peers;
      const speed = JSON.stringify(this.stats.get());
      debug('stats','peers',peers,'speed',speed);  
    }else{
      debug('stats disabled');
    }
  }

  /**must already join network by calling joinNetwork. remember to set download:false when joining network to prevent auto update */
  async isNewUpdate(opts,swarmOpts = {}){
    const {retry,timeout} = opts;
    try{
      await this.joinNetwork({lookup:true,announce:false,retry:retry,timeout:timeout,waitPeer:true},swarmOpts,{download:false});
      await util.promisify(this.archive.metadata.update).bind(this.archive.metadata)({ ifAvailable: true,minLength:this.archive.version+1 });
      await this.leave()
      return true;
    }catch(err){
      return false;
    }
  }

  async download(entries,{thread = 0,dispatch,ignore = true}){
    try{
      // "/PointBlankInstall - Copy.exe could not be found"
      let totalDownloaded = 0;
      let totalFailed = 0;
      let errors = [];
      let queue = [];
      let index = 0;
      if(thread === 0){
        thread = entries.length;
      }

      const updateStatus = (opts)=>{
        dispatch && dispatch(`${totalDownloaded},${totalFailed} of ${entries.length}`);
      }

      updateStatus();
      for(let entry of entries){
        queue.push(this._download(entry).then(()=>{
          totalDownloaded++;
          updateStatus();
        }).catch(err=>{
          let isError = true;
          if(ignore !== false){
            if(ignore === true){
              if(err.message.includes("could not be found")){
                isError = false;
                totalDownloaded++;
                updateStatus();
              }
            }else{
              if(ignore(err.message)){
                isError = false;
                totalDownloaded++;
                updateStatus();
              }
            }
          }

          if(isError){
            totalFailed++;
            updateStatus();
            errors.push({file:entry,message:err.message});
          }
        }));
        index++;
        if(index % thread == 0){
          await Promise.all(queue);
          queue = [];
        }
      }

      if(queue.length){
        await Promise.all(queue);
        queue = [];
      }

      if(errors.length){
        return {
          totalDownloaded:totalDownloaded,
          errors:errors,
          totalFailed:totalFailed
        }
      }

      return true;
    }catch(err){
      throw err;
    }
  }

  async _download(entry){
    try{
        const stat = await util.promisify(this.archive.stat).bind(this.archive)(entry);
        if (stat.isFile()){
            await this._downloadFile(entry, stat)
        }else if(stat.isDirectory()){
          debug('is directory');
        }else{
          debug(stat);
        }
    }catch(err){
        throw err;
    }
  }

  async _downloadFile(entry, stat){
    const start = stat.offset
    const end = stat.offset + stat.blocks
    if (start === 0 && end === 0){
      debug('empty');
      return;
    }
    
    debug('downloading file', entry, start, end);
    await util.promisify(this.archive.content.download).bind(this.archive.content)({ start, end });
    debug('success downloading file', entry, start, end);
  }

  async joinNetwork(opts = {},swarmOpts = {},replicateOpts = {}){
    const {retry,lookup,announce,waitPeer = false,timeout,log=false} = opts;

    let checkerID = 0;
    const checker = () => {
      return new Promise((resolve,reject)=>{
        checkerID = setInterval(() => {
            try{
              if(this.archive._closed){
                log && debug('clear interval checker id');
                clearInterval(checkerID);
                return reject(new Error('Stopped'));
              }
              log && this.test();
              if (this.network.peers.size > 0) {
                clearInterval(checkerID);
                return resolve();
              }
            }catch(err){
              clearInterval(checkerID);
              return reject(err);
            }
        }, 2500);
      });
    }
  
    const run = () => {
      return new Promise(async (resolve, reject) => {
        try {
          log && debug('joining');
          await this.join({lookup:lookup,upload:announce},swarmOpts,replicateOpts);
          if(!waitPeer){
            return resolve();
          }

          try{
            await Promise.race([
              checker(),
              new Promise((resolve,reject)=>{
                setTimeout(()=>{
                  return reject(new Error('NETWORK_CONNECT_TIMEOUT'))
                }, timeout)
              })
            ]);

            log && debug('joined');
            clearInterval(checkerID);
            return resolve();
          }catch(err){
            clearInterval(checkerID);
            try{
              log && debug('leave');
              if(!this.archive._closed){
                await this.leave();
              }
            }catch(err2){debug('found bug leave network',err2)}//no need to do anything

            throw err;
          }
        }catch(err){
          clearInterval(checkerID);
          return reject(err);
        }
      })
    }
  
    let stop = false
    let innerRetry = 0
    do {
      try {
        await run();
        stop = true;
      } catch (err) {
        if(this.archive._closed){
          log && debug('stopped');
          stop = true;
        }
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
