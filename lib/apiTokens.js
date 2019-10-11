
const uuid = require('uuid/v4')
const db = require('./db')

const tokens = Object.create(null)

function createToken (user) {
  const token = uuid()

  tokens[token] = user.id

  return token
}

function getUserFromToken (token) {
  const uid = tokens[token]

  if (uid === undefined) {
    return Promise.reject(new Error('No user'))
  }

  return db.model.User.findById(uid).then((user) => {
    return Promise.resolve(user)
  })
}

module.exports = {
  createToken: createToken,
  getUserFromToken: getUserFromToken
}
