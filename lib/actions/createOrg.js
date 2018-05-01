var config = require('../config')

const db = require('../db')
const pug = require('pug')


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
