const fs = require('fs')
const path = require('path')
const mirror = require('mirror-folder')
const ram = require('random-access-memory')
const Dat = require('..')
const util = require('util');

const key = "b65a1e9327fdfcb8751e4ff520785ce6b9b59da3f06f1a8f757a561f2b1721eb";//process.argv[2]

const dest = path.join(__dirname, 'tmp1')
if(!fs.existsSync(dest)){
  fs.mkdirSync(dest)
}

/**download sparse:true */
(async()=>{
  const dat = await Dat(dest, { key: key, sparse: false });
  console.log(await dat.isNewUpdate({retry:5,timeout:15000}));
})();

