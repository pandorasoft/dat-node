const path = require('path')
const Dat = require('..')

const src = path.join(__dirname, '..')

Dat(src, { temp: true }, function (err, dat) {
  if (err) throw err

  const network = dat.joinNetwork()
  network.once('connection', function () {
    console.log('Connected')
  })
  const progress = dat.importFiles(src, {
    ignore: ['**/node_modules/**']
  }, function (err) {
    if (err) throw err
    console.log('Done importing')
    console.log('Archive size:', dat.archive.content.byteLength)
  })
  progress.on('put', function (src, dest) {
    console.log('Added', dest.name)
  })

  console.log(`Sharing: ${dat.key.toString('hex')}\n`)
})
