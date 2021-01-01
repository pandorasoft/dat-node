const fs = require('fs')
const path = require('path')
const mirror = require('mirror-folder')
const ram = require('random-access-memory')
const Dat = require('..')
const util = require('util');
const fsExtra = require('fs-extra');

const dft = require('diff-file-tree')
// const key = "c037b8f3a93cff2f39a32de252ad321dd42cb8d7d0bd191b0372e78534fe3601";//process.argv[2]
const key = "2aaf82d53013d7205454aecd2dc02dc75488c58672bc5a9b71c6d895de91fd68";
const dest = path.join(__dirname, 'tmp3')
if(!fs.existsSync(dest)){
  fs.mkdirSync(dest)
}

/**download sparse:true */
(async()=>{

  const dat = await Dat(dest, { key: key, sparse: false });
  dat.trackStats();
  
  setInterval(()=>{
    dat.test();
},1000);
  await dat.joinNetwork({lookup:true,announce:true,retry:5,timeout:60000,waitPeer:true},{},{download:true,live:false});
  
})();