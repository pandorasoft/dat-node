const fs = require('fs')
const path = require('path')
const mirror = require('mirror-folder')
const ram = require('random-access-memory')
const Dat = require('..')
const util = require('util');

const key = "b65a1e9327fdfcb8751e4ff520785ce6b9b59da3f06f1a8f757a561f2b1721eb";//process.argv[2]

const dest = path.join(__dirname, 'tmp2')
if(!fs.existsSync(dest)){
  fs.mkdirSync(dest)
}

/**download sparse:true */
(async()=>{
  const dat = await Dat(dest, { key: key, sparse: false });
  setInterval(()=>{
    dat.test();
  },5000);
        
  dat.trackStats();
  dat.stats.on('update', stats => {
      if (!stats) stats = dat.stats.get();
      
      const progress = Math.min(1,stats.downloaded / stats.length);

      const payload2 = {
          progress:Number.isNaN(progress) ? 0 : parseInt(progress*100)
      };

      if(progress.payload === 100){
        console.log('progress',progress);
      }
  });

  await dat.joinNetwork({lookup:true,announce:true,retry:5,timeout:15000,waitPeer:true},{},{download:true});
})();