var getUrisFromReq = require('../getUrisFromReq')
var pug = require('pug')
var config = require('../config')
var extend = require('xtend')
var sparql = require('../sparql/sparql')

const request = require('request')
const multiparty = require('multiparty')
const uriToUrl = require('../uriToUrl')
const attachments = require('../attachments')
const uploads = require('../uploads')
const fs = require('mz/fs')
const db = require('../db')

module.exports = function(req, res) {

    if (req.method === 'POST'){

      submitPost(req, res)
    }

    else{

      submitForm(req, res, {}, {})

    }

}


async function submitForm(req, res, submissionData, locals){

  req.setTimeout(0) // no timeout

  var plan_names = []
  var plan_uris = []

  const { graphUri, uri, designId, baseUri, url } = getUrisFromReq(req, res)

  var locals = extend({
    config: config.get(),
    user: req.user,
    errors: [],
    submission: submissionData,
    canEdit: true,
  }, locals)

  var plan_query = "PREFIX prov: <http://www.w3.org/ns/prov#> SELECT ?s WHERE { ?s a prov:Plan .}"

  let plans = await sparql.queryJson(plan_query, graphUri)

  for (plan of plans){
    plan_names.push(plan['s'].split('/').pop())
    plan_uris.push(plan['s'])
  }

  let users = await db.model.User.findAll()

  locals = extend({
    agent_names: users.map(x=>x.name),
    agent_uris: users.map(x=>x.graphUri),
    plan_names: plan_names,
    plan_uris: plan_uris
  }, locals)

  res.send(pug.renderFile('templates/views/createTest.jade', locals))


}

async function submitPost(req, res){

  const { graphUri, uri, designId, baseUri, url } = getUrisFromReq(req, res)

  req.setTimeout(0) // no timeout

  const form = new multiparty.Form()

  form.on('error', (err) => {
      res.status(500).send(err)
  })


}
