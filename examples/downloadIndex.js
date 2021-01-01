const fs = require('fs')
const path = require('path')
const mirror = require('mirror-folder')
const ram = require('random-access-memory')
const Dat = require('..')
const util = require('util');
const fsExtra = require('fs-extra');

const dft = require('diff-file-tree')
const key = "c037b8f3a93cff2f39a32de252ad321dd42cb8d7d0bd191b0372e78534fe3601";//process.argv[2]

const dest = path.join(__dirname, 'tmp2')
if(!fs.existsSync(dest)){
  fs.mkdirSync(dest)
}

/**download sparse:true */
(async()=>{
  //1. check apakah foldernya ada .dat, jika tidak ada maka download .dat nya
  //2. bandingkan dan cari file yang tidak ada di sistem kemudian download file yang tidak ada atau berubah tersebut
  //3. done kalo sudah selesai download

  const dat = await Dat(dest, { key: key, sparse: true });
  const diff = await dft.diff(dest,{fs:dat.archive,path:'/'},{
    compareContent:true,
    filter:(path)=>path.includes('\\.dat'),
    shallow:false
  });
  
  // console.log('sebelum filter',diff);
  const selective = diff.filter(val=>!['add'].includes(val.change)).filter(val=>val.type == 'file').map((val)=>val.path);
  // console.log('setelah filter',selective);

  // const selective =  [
  //   '\\ndp48-web - Copy (2).exe',
  //   '\\ndp48-web - Copy.exe',
  //   '\\ndp48-web.exe',
  //   '\\visualcppbuildtools_full.exe',
  //   '\\test\\test.txt',
  //   '\\test\\ndp48-web - Copy.exe',
  //   '\\test\\ndp48-web.exe'
  // ];
  

  await dat.joinNetwork({lookup:true,announce:true,retry:5,timeout:15000,waitPeer:false},{},{download:true});
  const resp = await dat.download(selective,{dispatch:console.log});

  await dat.close();
  setInterval(async()=>{
    try{
      console.log('coba hapus');
      await fsExtra.emptyDir(dest);
      console.log('success');
      process.exit(0);
    }catch(err){
      console.log('gagal hapus');
    }
  },10000);
})();