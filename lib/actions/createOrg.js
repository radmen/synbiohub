var config = require('../config')
var validator = require('validator');

const db = require('../db')
const pug = require('pug')
const multiparty = require('multiparty')

module.exports = function(req, res) {

    if (req.method === 'POST'){

      submitPost(req, res)
    }

    else{

      submitForm(req, res, {}, {})

    }

}

async function submitForm(req, res, submissionData, locals){


  var locals = {
        config: config.get(),
        section: 'component',
        user: req.user,
        errors: []
    }

  let orgs = await db.model.Org.findAll()

  console.log(orgs)

  res.send(pug.renderFile('templates/views/createOrg.jade', locals))

}

async function submitPost(req, res){


  req.setTimeout(0)

  const form = new multiparty.Form()

  form.on('error', (err) => {
      res.status(500).send(err)
  })


  form.parse(req, (err, fields, files) => {

    var errors = []

    console.log(fields)

  })


}
