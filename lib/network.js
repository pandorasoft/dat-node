const assert = require('assert')
const pump = require('pump')
const hyperswarm = require('hyperswarm')
const debug = require('debug')('dat-node')
const Networker = require('@corestore/networker')
const xtend = Object.assign;

module.exports = async (archive,swarmOpts = {},replicateOpts = {})=>{
  const networker = new Networker(archive,swarmOpts,replicateOpts);

  return networker;
}

