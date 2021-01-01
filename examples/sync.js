const fs = require('fs')
const path = require('path')
const mirror = require('mirror-folder')
const ram = require('random-access-memory')
const Dat = require('..')
const util = require('util');

const key = "03bb7e223a1da6349acab366dcfc1fe83b8ed5c7c37cf86bfdcb17a1bedd8eed";//process.argv[2]

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

  console.log(dat.version);
  if(await dat.isNewUpdate({retry:5,timeout:15000})){
        console.log('new update',dat.archive.version);
        
        dat.trackStats();
        dat.stats.on('update', stats => {
            if (!stats) stats = dat.stats.get();
            
            const progress = Math.min(1,stats.downloaded / stats.length);

            const payload2 = {
                progress:Number.isNaN(progress) ? 0 : parseInt(progress*100)
            };

            console.log('done');
        });
        await dat.joinNetwork({lookup:true,announce:true,retry:5,timeout:15000,waitPeer:true},{},{download:true});
  }else{
      console.log('there is no new update');
  }
})();

