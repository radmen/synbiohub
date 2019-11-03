const pug = require('pug')
const db = require('../../db')
const config = require('../../config')

module.exports = function (req, res) {
  if (req.method === 'POST') {
    if (req.body.allowPublicSignup) {
      config.set('allowPublicSignup', true)
    } else {
      config.set('allowPublicSignup', false)
    }
  }

  db.model.User.findAll().then((users) => {
    users = users.filter(user => !user.virtual)

    var locals = {
      config: config.get(),
      section: 'admin',
      adminSection: 'users',
      user: req.user,
      users: users,
      canSendEmail: config.get('mail').sendgridApiKey !== ''
    }

    res.send(pug.renderFile('templates/views/admin/users.jade', locals))
  }).catch((err) => {
    res.status(500).send(err.stack)
  })
}
