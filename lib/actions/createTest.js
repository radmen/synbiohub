var getUrisFromReq = require('../getUrisFromReq')
var pug = require('pug')
var config = require('../config')
var extend = require('xtend')

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

  var locals = extend({
    config: config.get(),
    user: req.user,
    errors: [],
    submission: submissionData,
    canEdit: true,
  }, locals)

  const { graphUri, uri, designId, baseUri, url } = getUrisFromReq(req, res)



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
