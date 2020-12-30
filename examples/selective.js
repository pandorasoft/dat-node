const fs = require('fs')
const path = require('path')
const mirror = require('mirror-folder')
const ram = require('random-access-memory')
const Dat = require('..')
// const dft = require('diff-file-tree')
const util = require('util');
const debug = require('debug')('test');

const key = 'b65a1e9327fdfcb8751e4ff520785ce6b9b59da3f06f1a8f757a561f2b1721eb'// process.argv[2]


const dest = path.join(__dirname, 'tmp3')
if(!fs.existsSync(dest)){
  fs.mkdirSync(dest)
}

/**for selective to work, sparse must be true */

(async()=>{
    const dat = await Dat(dest, { key: key, sparse: true });
    dat.trackStats()
    await dat.joinNetwork({retry:50,lookup:true,announce:false,timeout:15000,waitPeer:true});
    console.log('joined');

    const selective = [{path:'\\visualcppbuildtools_full - Copy.exe'}].map((val)=>val.path);

    const archive = dat.archive;
    let selectedByteLength = 0;
    const download = async(dirname)=>{
      try{
          const stat = await util.promisify(archive.stat).bind(archive)(dirname);
          if (stat.isDirectory()){
              await downloadDir(dirname, stat)
          }else if (stat.isFile()){
              await downloadFile(dirname, stat)
          }
      }catch(err){
          throw err;
      }
    }

    const downloadDir = async(dirname, stat) => {
      console.log('downloading dir', dirname)
      const entries = await util.promisify(archive.readdir).bind(archive)(dirname);
      const queue = [];
      for(let i=0;i<entries.length;i++){
          queue.push(download(path.join(dirname, entry)));
      }
      
      await Promise.all(queue);
    }

    const downloadFile = async(entry, stat) => {
      const start = stat.offset
      const end = stat.offset + stat.blocks
      selectedByteLength += stat.size
      if (start === 0 && end === 0) return
      console.log('downloading file', entry, start, end);
      const res = await util.promisify(archive.content.download).bind(archive.content)({ start, end });
      console.log('success download file', entry,selectedByteLength);
    }
    
    const queue = [];
    for(let i=0;i<selective.length;i++){
        queue.push(download(selective[i]));
    }
    await Promise.all(queue);
    console.log('done');
})();