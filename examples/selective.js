const fs = require('fs')
const path = require('path')
const mirror = require('mirror-folder')
const ram = require('random-access-memory')
const Dat = require('..')
const dft = require('diff-file-tree')
const util = require('util');
const debug = require('debug')('test');

const key = '03bb7e223a1da6349acab366dcfc1fe83b8ed5c7c37cf86bfdcb17a1bedd8eed'// process.argv[2]


const dest = path.join(__dirname, 'tmp2')
if(!fs.existsSync(dest)){
  fs.mkdirSync(dest)
}

/**for selective to work, sparse must be true */

(async()=>{
    let dat = await Dat(dest, { key: key, sparse: true });
    // dat.trackStats()
    console.log(dat.archive.indexing);
    console.log('joined');
    const diff = await dft.diff(dest,{fs:dat.archive,path:'/'},{
      compareContent:true,
      filter:(path)=>path.includes('\\.dat')
    });
    
    // await dft.applyLeft(dest,{fs:dat.archive,path:'/'});
    // return;
    // console.log(diff);
    // return;
    if(!diff.length){
        console.log('tidak ada update');
        return;
    }

    console.log('before',diff);
    const selective = diff.filter(val=>!['add'].includes(val.change)).filter(val=>val.type == 'file').map((val)=>val.path);
    console.log('after',selective);
    await dat.close();
    
    dat = await Dat('./tmp3', { key: key, sparse: true });
    await dat.joinNetwork({retry:50,lookup:true,announce:false,timeout:15000,waitPeer:true});
    
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
          queue.push(download(path.join(dirname, entries[i])));
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