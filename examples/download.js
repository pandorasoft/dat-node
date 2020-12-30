const fs = require('fs')
const path = require('path')
const mirror = require('mirror-folder')
const ram = require('random-access-memory')
const Dat = require('..')

const key = 'b65a1e9327fdfcb8751e4ff520785ce6b9b59da3f06f1a8f757a561f2b1721eb';//process.argv[2]

const dest = path.join(__dirname, 'tmp1')
if(!fs.existsSync(dest)){
  fs.mkdirSync(dest)
}

/**download sparse:true */
(async()=>{
  const dat = await Dat(dest, { key: key, sparse: false });
  dat.trackStats();
  await dat.joinNetwork({lookup:true,announce:true,retry:5,timeout:5000,waitPeer:true});
  console.log('joined');
  await dat.close();
  console.log('closed');
  setTimeout(()=>{
    console.log('hallo');
  },1000000000);
  // dat.archive.metadata.update(download)

  // function download () {
  //   const progress = mirror({ fs: dat.archive, name: '/' }, dest, function (err) {
  //     if (err) throw err
  //     console.log('Done')
  //   })
  //   progress.on('put', function (src) {
  //     console.log('Downloading', src.name)
  //   })
  // }
})();