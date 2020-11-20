const fs = require('fs')
const path = require('path')
const mirror = require('mirror-folder')
const ram = require('random-access-memory')
const Dat = require('..')

const key = process.argv[2]
if (!key) {
  console.error('Run with: node examples/download.js <key>')
  process.exit(1)
}

const dest = path.join(__dirname, 'tmp')
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
