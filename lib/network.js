const assert = require('assert')
const pump = require('pump')
const hyperswarm = require('hyperswarm')
const debug = require('debug')('dat-node')
const Networker = require('@corestore/networker')
const xtend = Object.assign;

module.exports = async (archive,opts)=>{
  const networker = new Networker(archive);

  opts = xtend({
    announce:true,
    lookup:true,
    flush:true
  },opts);

  await networker.configure(archive.discoveryKey, opts);

  return networker;
}

