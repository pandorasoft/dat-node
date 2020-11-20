const fs = require('fs')
const path = require('path')
const test = require('tape')
const rimraf = require('rimraf')
const ram = require('random-access-memory')
const countFiles = require('count-files')
const helpers = require('./helpers')

const Dat = require('..')

// os x adds this if you view the fixtures in finder and breaks the file count assertions
try { fs.unlinkSync(path.join(__dirname, 'fixtures', '.DS_Store')) } catch (e) { /* ignore error */ }

const fixtures = path.join(__dirname, 'fixtures')
const fixtureStats = {
  files: 3,
  bytes: 1452,
  dirs: 1
}
let liveKey

test('share: prep', function (t) {
  cleanFixtures(function () {
    t.end()
  })
})

test('share: create dat with default ops', function (t) {
  Dat(fixtures, function (err, dat) {
    t.error(err, 'cb err okay')
    t.ok(dat.path === fixtures, 'correct directory')
    t.ok(dat.archive, 'has archive')
    t.ok(dat.key, 'has key')
    t.ok(dat.live, 'is live')
    t.ok(dat.writable, 'is writable')
    t.ok(!dat.resumed, 'is not resumed')

    fs.stat(path.join(fixtures, '.dat'), function (err, stat) {
      t.error(err)
      t.pass('creates .dat dir')
    })

    liveKey = dat.key
    let putFiles = 0
    const stats = dat.trackStats()
    const network = dat.joinNetwork()

    network.once('listening', function () {
      t.pass('network listening')
    })

    const progress = dat.importFiles(function (err) {
      t.error(err, 'file import err okay')
      const archive = dat.archive
      const st = stats.get()
      if (archive.version === st.version) return check()
      stats.once('update', check)

      function check () {
        const st = stats.get()
        t.same(st.files, 3, 'stats files')
        t.same(st.length, 2, 'stats length')
        t.same(st.version, archive.version, 'stats version')
        t.same(st.byteLength, 1452, 'stats bytes')

        t.same(putFiles, 3, 'importer puts')
        t.same(archive.version, 3, 'archive version')
        t.same(archive.metadata.length, 4, 'entries in metadata')

        helpers.verifyFixtures(t, archive, function (err) {
          t.ifError(err)
          dat.close(function (err) {
            t.ifError(err)
            t.pass('close okay')
            t.end()
          })
        })
      }
    })

    progress.on('put', function () {
      putFiles++
    })
  })
})

test('share: resume with .dat folder', function (t) {
  Dat(fixtures, function (err, dat) {
    t.error(err, 'cb without error')
    t.ok(dat.writable, 'dat still writable')
    t.ok(dat.resumed, 'resume flag set')
    t.same(liveKey, dat.key, 'key matches previous key')
    const stats = dat.trackStats()

    countFiles({ fs: dat.archive, name: '/' }, function (err, count) {
      t.ifError(err, 'count err')
      const archive = dat.archive

      t.same(archive.version, 3, 'archive version still')

      const st = stats.get()
      t.same(st.byteLength, fixtureStats.bytes, 'bytes total still the same')
      t.same(count.bytes, fixtureStats.bytes, 'bytes still ok')
      t.same(count.files, fixtureStats.files, 'bytes still ok')
      dat.close(function () {
        cleanFixtures(function () {
          t.end()
        })
      })
    })
  })
})

test('share: resume with empty .dat folder', function (t) {
  const emptyPath = path.join(__dirname, 'empty')
  Dat(emptyPath, function (err, dat) {
    t.error(err, 'cb without error')
    t.false(dat.resumed, 'resume flag false')

    dat.close(function () {
      Dat(emptyPath, function (err, dat) {
        t.error(err, 'cb without error')
        t.ok(dat.resumed, 'resume flag set')

        dat.close(function () {
          rimraf(emptyPath, function () {
            t.end()
          })
        })
      })
    })
  })
})

// TODO: live = false, not implemented yet in hyperdrive v8
// test('share snapshot', function (t) {
//   Dat(fixtures, { live: false }, function (err, dat) {
//     t.error(err, 'share cb without error')

//     t.ok(!dat.live, 'live false')
//     dat.importFiles(function (err) {
//       t.error(err, 'no error')
//       dat.archive.finalize(function (err) {
//         t.error(err, 'no error')

//         // TODO: saving mtime breaks this
//         // t.skip(fixturesKey, dat.key, 'TODO: key matches snapshot key')

//         dat.close(cleanFixtures(function () {
//           rimraf.sync(path.join(fixtures, '.dat'))
//           t.end()
//         }))
//       })
//     })
//   })
// })

if (!process.env.TRAVIS) {
  test('share: live - editing file', function (t) {
    Dat(fixtures, function (err, dat) {
      t.ifError(err, 'error')

      const importer = dat.importFiles({ watch: true }, function (err) {
        t.ifError(err, 'error')
        if (!err) t.fail('live import should not cb')
      })
      importer.on('put-end', function (src) {
        if (src.name.indexOf('empty.txt') > -1) {
          if (src.live) return done()
          fs.writeFileSync(path.join(fixtures, 'folder', 'empty.txt'), 'not empty')
        }
      })

      function done () {
        dat.archive.stat('/folder/empty.txt', function (err, stat) {
          t.ifError(err, 'error')
          t.same(stat.size, 9, 'empty file has new content')
          dat.close(function () {
            // make file empty again
            fs.writeFileSync(path.join(fixtures, 'folder', 'empty.txt'), '')
            t.end()
          })
        })
      }
    })
  })

  test('share: live resume & create new file', function (t) {
    const newFile = path.join(fixtures, 'new.txt')
    Dat(fixtures, function (err, dat) {
      t.error(err, 'error')
      t.ok(dat.resumed, 'was resumed')

      const importer = dat.importFiles({ watch: true }, function (err) {
        t.error(err, 'error')
        if (!err) t.fail('watch import should not cb')
      })

      importer.on('put-end', function (src) {
        if (src.name.indexOf('new.txt') === -1) return
        t.ok(src.live, 'file put is live')
        process.nextTick(done)
      })
      setTimeout(writeFile, 500)

      function writeFile () {
        fs.writeFile(newFile, 'hello world', function (err) {
          t.ifError(err, 'error')
        })
      }

      function done () {
        dat.archive.stat('/new.txt', function (err, stat) {
          t.ifError(err, 'error')
          t.ok(stat, 'new file in archive')
          fs.unlink(newFile, function () {
            dat.close(function () {
              t.end()
            })
          })
        })
      }
    })
  })
}

test('share: cleanup', function (t) {
  cleanFixtures(function () {
    t.end()
  })
})

test('share: dir storage and opts.temp', function (t) {
  Dat(fixtures, { temp: true }, function (err, dat) {
    t.error(err, 'error')
    t.false(dat.resumed, 'resume flag false')

    dat.importFiles(function (err) {
      t.error(err, 'error')
      helpers.verifyFixtures(t, dat.archive, done)
    })

    function done (err) {
      t.error(err, 'error')
      dat.close(function () {
        t.end()
      })
    }
  })
})

test('share: ram storage & import other dir', function (t) {
  Dat(ram, function (err, dat) {
    t.error(err, 'error')
    t.false(dat.resumed, 'resume flag false')

    dat.importFiles(fixtures, function (err) {
      t.error(err, 'error')
      helpers.verifyFixtures(t, dat.archive, done)
    })

    function done (err) {
      t.error(err, 'error')
      dat.close(function () {
        t.end()
      })
    }
  })
})

function cleanFixtures (cb) {
  cb = cb || function () {}
  rimraf(path.join(fixtures, '.dat'), cb)
}
