const fs = require('fs')
const path = require('path')
const mirror = require('mirror-folder')
const ram = require('random-access-memory')
const Dat = require('..')
const util = require('util');
const fsExtra = require('fs-extra');

const dft = require('diff-file-tree')
const key = "cf5cee85db4fb22236b66112e0e2dfef4484dd829d651840d59e629dc8f0fd7a";//process.argv[2]

const dest = path.join(__dirname, 'tmp2')
if(!fs.existsSync(dest)){
  fs.mkdirSync(dest)
}

/**download sparse:true */
(async()=>{

  const dat = await Dat(dest, { key: key, sparse: false });
  await dat.joinNetwork({lookup:true,announce:true,retry:5,timeout:15000,waitPeer:true},{},{download:true});
  
  await dat.close();
  
  try{
    console.log(dat.archive._latestStorage);
  console.log('coba hapus');
  await fsExtra.emptyDir(dest);
  console.log('success');
  process.exit(0);
}catch(err){
  console.log('gagal hapus',err);
}
})();