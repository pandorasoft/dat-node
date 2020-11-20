const fs = require('fs')
const path = require('path')
const mirror = require('mirror-folder')
const ram = require('random-access-memory')
const Dat = require('..')

const key = '17cee6c1520455b893c5bbe3db7fa0f71b8f9810d21f68d394d17983406359de';//process.argv[2]
// if (!key) {
//   console.error('Run with: node examples/download.js <key>')
//   process.exit(1)
// }

const dest = path.join(__dirname, 'tmp')
if(fs.existsSync(dest)){
  fs.rmdirSync(dest);
}

fs.mkdirSync(dest)

Dat(ram, { key: key, sparse: true }, function (err, dat) {
  if (err) throw err

  const network = dat.joinNetwork()
  network.once('connection', function () {
    console.log('Connected')
  })
  dat.archive.metadata.update(download)

  function download () {
    const progress = mirror({ fs: dat.archive, name: '/' }, dest, function (err) {
      if (err) throw err
      console.log('Done')
    })
    progress.on('put', function (src) {
      console.log('Downloading', src.name)
    })
  }

  console.log(`Downloading: ${dat.key.toString('hex')}\n`)
})
