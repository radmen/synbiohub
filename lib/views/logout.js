
module.exports = function (req, res) {
  if (req.session.users !== undefined) { delete req.session.users }
  req.session.save(() => {
    res.redirect('/')
  })
}
