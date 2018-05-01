var config = require('../config')
var validator = require('validator');
var extend = require('xtend')

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

  var locals = extend({
        config: config.get(),
        section: 'component',
        user: req.user,
        errors: [],
        submission: submissionData
    }, locals)

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

    const submissionData = {
        org_name: fields['org_name'][0],
        email: fields['email'][0],
        website: fields['website'][0],
    }

    if (fields['org_name'][0] === ''){

      errors.push('Please write the Organisation name.')
    }


    if (fields['website'][0] === ''){

      errors.push('Please write the Organisation\'s website.')
    }

    if (fields['email'][0] === ''){

      errors.push('Please write the Organisation\'s email.')

    }

    else if (!validator.isEmail(fields['email'][0])){

      errors.push('Please write a correct email.')
      submissionData.email = ''
    }


    if (errors.length > 0) {
        if (req.forceNoHTML || !req.accepts('text/html')) {
            res.status(500).type('text/plain').send(errors)
            return
        } else {
            return submitForm(req, res, submissionData, {
                errors: errors
            })
        }
    }

  else{

    db.model.Org.insertOrUpdate({'name': fields['org_name'][0], 'email': fields['email'][0],
      'website': fields['website'][0]}).then(() => {

        res.redirect('/manage')

      })

  }


  })


}
