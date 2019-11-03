var express = require('express')
var session = require('express-session')
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser')
var multer = require('multer')
var lessMiddleware = require('less-middleware')
var browserifyMiddleware = require('browserify-middleware')
var config = require('./config')
var SequelizeStore = require('connect-sequelize')(session)
const db = require('./db')
const initSSE = require('./sse').initSSE
var cache = require('./cache')
var apiTokens = require('./apiTokens')
var alias = require('./auth/alias')
var path = require('path')
const access = require('./auth/access')

var views = {
  index: require('./views/index'),
  about: require('./views/about'),
  browse: require('./views/browse'),
  login: require('./views/login'),
  logout: require('./views/logout'),
  register: require('./views/register'),
  resetPassword: require('./views/resetPassword'),
  profile: require('./views/profile'),
  search: require('./views/search'),
  advancedSearch: require('./views/advancedSearch'),
  submit: require('./views/submit'),
  manage: require('./views/manage'),
  topLevel: require('./views/topLevel'),
  sharing: require('./views/sharing'),
  persistentIdentity: require('./views/persistentIdentity'),
  setup: require('./views/setup'),
  dataIntegration: require('./views/dataIntegration'),
  jobs: require('./views/jobs'),
  sparql: require('./views/sparql'),
  createShareLink: require('./views/createShareLink'),
  displayShareLink: require('./views/displayShareLink'),
  createShare: require('./views/createShare'),
  shared: require('./views/shared'),
  visualization: require('./views/visualization'),
  logo: require('./views/logo'),
  stream: require('./views/stream'),
  admin: {
    explorer: require('./views/admin/explorer'),
    status: require('./views/admin/status'),
    graphs: require('./views/admin/graphs'),
    sparql: require('./views/admin/sparql'),
    remotes: require('./views/admin/remotes'),
    users: require('./views/admin/users'),
    newUser: require('./views/admin/newUser'),
    update: require('./views/admin/update'),
    jobs: require('./views/admin/jobs'),
    theme: require('./views/admin/theme'),
    backup: require('./views/admin/backup'),
    backupRestore: require('./views/admin/backupRestore'),
    registries: require('./views/admin/registries'),
    mail: require('./views/admin/mail'),
    log: require('./views/admin/log'),
    plugins: require('./views/admin/plugins')
  }
}

var api = {
  search: require('./api/search'),
  sbol: require('./api/sbol'),
  sbolnr: require('./api/sbolnr'),
  omex: require('./api/omex'),
  persistentIdentity: require('./api/persistentIdentity'),
  summary: require('./api/summary'),
  fasta: require('./api/fasta'),
  genBank: require('./api/genBank'),
  metadata: require('./api/metadata'),
  autocomplete: require('./api/autocomplete'),
  count: require('./api/count'),
  rootCollections: require('./api/rootCollections'),
  subCollections: require('./api/subCollections'),
  download: require('./api/download'),
  datatables: require('./api/datatables'),
  sparql: require('./api/sparql'),
  stream: require('./api/stream'),
  updateWebOfRegistries: require('./api/updateWebOfRegistries'),
  editObject: require('./api/editObject'),
  addObject: require('./api/addObject'),
  removeObject: require('./api/removeObject'),
  attachUrl: require('./api/attachUrl'),
  admin: {
    sparql: require('./api/admin/sparql')
  }
}

var actions = {
  makePublic: require('./actions/makePublic'),
  copyFromRemote: require('./actions/copyFromRemote'),
  createBenchlingSequence: require('./actions/createBenchlingSequence'),
  createICEPart: require('./actions/createICEPart'),
  removeCollection: require('./actions/removeCollection'),
  cloneSubmission: require('./actions/cloneSubmission'),
  resetPassword: require('./actions/resetPassword'),
  setNewPassword: require('./actions/setNewPassword'),
  remove: require('./actions/remove'),
  replace: require('./actions/replace'),
  createImplementation: require('./actions/createImplementation'),
  createTest: require('./actions/createTest'),
  updateMutableDescription: require('./actions/updateMutableDescription'),
  updateMutableNotes: require('./actions/updateMutableNotes'),
  updateMutableSource: require('./actions/updateMutableSource'),
  updateCitations: require('./actions/updateCitations'),
  cancelJob: require('./actions/cancelJob'),
  restartJob: require('./actions/restartJob'),
  upload: require('./actions/upload'),
  createSnapshot: require('./actions/createSnapshot'),
  updateCollectionIcon: require('./actions/updateCollectionIcon'),
  removeShareLink: require('./actions/removeShareLink'),
  removeShare: require('./actions/removeShare'),
  admin: {
    saveRemote: require('./actions/admin/saveRemote'),
    saveRegistry: require('./actions/admin/saveRegistry'),
    deleteRegistry: require('./actions/admin/deleteRegistry'),
    savePlugin: require('./actions/admin/savePlugin'),
    deletePlugin: require('./actions/admin/deletePlugin'),
    deleteRemote: require('./actions/admin/deleteRemote'),
    updateUser: require('./actions/admin/updateUser'),
    deleteUser: require('./actions/admin/deleteUser'),
    federate: require('./actions/admin/federate'),
    retrieve: require('./actions/admin/retrieveFromWoR'),
    explorerUpdateIndex: require('./actions/admin/explorerUpdateIndex'),
    setAdministratorEmail: require('./actions/admin/updateAdministratorEmail')
  }
}

browserifyMiddleware.settings({
  mode: 'production',
  cache: '1 day',
  // debug: false,
  minify: true,
  precompile: true
})

function App () {
  var app = express()

  app.get('/bundle.js', browserifyMiddleware(path.join(__dirname, '/../browser/synbiohub.js')))

  app.use(lessMiddleware('public'))

  app.use(express.static('public'))

  app.use(cookieParser())

  app.use(session({
    secret: config.get('sessionSecret'),
    resave: false,
    saveUninitialized: false,
    store: new SequelizeStore(db.sequelize, {}, 'Session')
  }))

  app.use(bodyParser.urlencoded({
    extended: true
  }))

  app.use(bodyParser.json())

  app.use(function (req, res, next) {
    if (req.url !== '/setup' && config.get('firstLaunch') === true) {
      console.log('redirecting')

      res.redirect('/setup')
    } else {
      next()
    }
  })

  // Authenticate user
  app.use(function (req, res, next) {
    var userID = req.session.users

    if (userID !== undefined) {
      db.model.User.findAll({
        where: {
          id: req.session.users,
          virtual: false
        }
      }).then((users) => {
        req.user = users[0]

        next()
      })
    } else if (req.get('X-authorization') && req.get('X-authorization') !== '') {
      let expectedPromise = apiTokens.getUserFromToken(req.get('X-authorization'))

      if (expectedPromise) {
        apiTokens.getUserFromToken(req.get('X-authorization')).then((user) => {
          req.user = user
          next()
        })
      } else {
        next()
      }
    } else {
      next()
    }
  })

  app.use(authorize)

  var uploadToMemory = multer({
    storage: multer.memoryStorage({})
  })

  initSSE(app)

  if (config.get('experimental').dataIntegration) {
    app.get('/jobs', requireUser, views.jobs)
    app.post('/actions/job/cancel', requireUser, actions.cancelJob)
    app.post('/actions/job/restart', requireUser, actions.restartJob)
    app.get('/admin/jobs', requireAdmin, views.admin.jobs)
    app.all('/user/:userId/:collectionId/:displayId/:version([^\\.]+)/integrate', requireUser, views.dataIntegration)
    app.all('/public/:collectionId/:displayId/:version([^\\.]+)/integrate', views.dataIntegration)
  }

  app.get('/', views.index)
  app.get('/about', views.about)

  if (config.get('firstLaunch')) {
    app.get('/setup', views.setup)
    app.post('/setup', uploadToMemory.single('logo'), views.setup)
  }

  app.all('/browse', views.browse)

  function forceNoHTML (req, res, next) {
    req.forceNoHTML = true

    next()
  }

  if (config.get('allowPublicSignup')) {
    app.all('/register', views.register)
  }

  app.all('/login', views.login)
  app.post('/remoteLogin', forceNoHTML, views.login) // Deprecated
  app.all('/logout', views.logout)
  app.all('/resetPassword/token/:token', actions.resetPassword)
  app.all('/resetPassword', views.resetPassword)
  app.post('/setNewPassword', actions.setNewPassword)
  app.all('/profile', requireUser, views.profile)
  app.get('/logo*', views.logo)

  app.get('/stream/:id', views.stream)

  app.get('/api/stream/:id', api.stream.serve)
  app.delete('/api/stream/:id', api.stream.serve)

  app.get('/share/:id/delete', actions.removeShare)
  app.get('/alias/:tag/delete', actions.removeShareLink)
  app.use('/alias/:tag', alias.route)

  app.post('/updateMutableDescription', requireUser, actions.updateMutableDescription)
  app.post('/updateMutableNotes', requireUser, actions.updateMutableNotes)
  app.post('/updateMutableSource', requireUser, actions.updateMutableSource)
  app.post('/updateCitations', requireUser, actions.updateCitations)

  app.get('/submit/', requireUser, views.submit)
  app.post('/submit/', requireUser, views.submit)
  app.post('/remoteSubmit/', forceNoHTML, /* requireUser, */ views.submit) // Deprecated

  app.get('/autocomplete/:query', api.autocomplete)
  app.get('/manage', requireUser, views.manage)

  app.get('/shared', requireUser, views.shared)

  app.get('/api/datatables', bodyParser.urlencoded({ extended: true }), api.datatables)

  app.get('/admin', requireAdmin, views.admin.status)
  app.get('/admin/search/:query?', views.search)
  app.get('/admin/graphs', requireAdmin, views.admin.graphs)
  app.get('/admin/log', requireAdmin, views.admin.log)
  app.get('/admin/plugins', requireAdmin, views.admin.plugins)
  app.get('/admin/remotes', requireAdmin, views.admin.remotes)
  app.get('/admin/users', requireAdmin, views.admin.users)
  app.get('/admin/newUser', requireAdmin, views.admin.newUser)
  app.get('/admin/update', requireAdmin, views.admin.update)
  app.get('/admin/theme', requireAdmin, views.admin.theme)
  app.post('/admin/theme', requireAdmin, uploadToMemory.single('logo'), views.admin.theme)
  app.post('/admin/explorerUpdateIndex', requireAdmin, actions.admin.explorerUpdateIndex)
  app.get('/admin/explorer', requireAdmin, views.admin.explorer)
  app.post('/admin/explorer', requireAdmin, bodyParser.urlencoded({ extended: true }), views.admin.explorer)
  app.get('/admin/backup', requireAdmin, views.admin.backup)
  app.get('/admin/registries', requireAdmin, views.admin.registries)
  app.post('/admin/backup', requireAdmin, bodyParser.urlencoded({ extended: true }), views.admin.backup)
  app.post('/admin/users', requireAdmin, views.admin.users)
  app.post('/admin/backup/restore/:prefix', requireAdmin, bodyParser.urlencoded({ extended: true }), views.admin.backupRestore)
  app.post('/admin/newUser', requireAdmin, bodyParser.urlencoded({ extended: true }), views.admin.newUser)
  app.post('/admin/updateUser', requireAdmin, bodyParser.urlencoded({ extended: true }), actions.admin.updateUser)
  app.post('/admin/deleteUser', requireAdmin, bodyParser.urlencoded({ extended: true }), actions.admin.deleteUser)
  app.post('/admin/deleteRemote', requireAdmin, bodyParser.urlencoded({ extended: true }), actions.admin.deleteRemote)
  app.post('/admin/saveRemote', requireAdmin, bodyParser.urlencoded({ extended: true }), actions.admin.saveRemote)
  app.post('/admin/saveRegistry', requireAdmin, bodyParser.urlencoded({ extended: true }), actions.admin.saveRegistry)
  app.post('/admin/deleteRegistry', requireAdmin, bodyParser.urlencoded({ extended: true }), actions.admin.deleteRegistry)
  app.post('/admin/savePlugin', requireAdmin, bodyParser.urlencoded({ extended: true }), actions.admin.savePlugin)
  app.post('/admin/deletePlugin', requireAdmin, bodyParser.urlencoded({ extended: true }), actions.admin.deletePlugin)
  app.get('/admin/mail', requireAdmin, views.admin.mail)
  app.post('/admin/mail', requireAdmin, bodyParser.urlencoded({ extended: true }), views.admin.mail)
  app.post('/admin/setAdministratorEmail', requireAdmin, bodyParser.urlencoded({ extended: true }), actions.admin.setAdministratorEmail)

  app.post('/updateWebOfRegistries', bodyParser.json(), api.updateWebOfRegistries)
  app.post('/admin/federate', requireAdmin, bodyParser.urlencoded({ extended: true }), actions.admin.federate)
  app.post('/admin/retrieveFromWebOfRegistries', requireAdmin, actions.admin.retrieve)

  app.get('/admin/sparql', requireAdmin, sparqlAdmin)
  app.post('/admin/sparql', requireAdmin, bodyParser.urlencoded({ extended: true }), sparqlAdmin)

  app.get('/search/:query?', views.search)
  app.get('/searchCount/:query?', views.search)
  app.get('/remoteSearch/:query?', forceNoHTML, views.search) /// DEPRECATED, use /search
  app.get('/advancedSearch', views.advancedSearch)
  app.post('/advancedSearch', views.advancedSearch)
  app.get('/advancedSearch/:query?', views.search)

  app.get('/createCollection', views.advancedSearch)
  app.post('/createCollection', views.advancedSearch)
  app.get('/createCollection/:query?', views.search)

  app.get('/:type/count', api.count)
  app.get('/rootCollections', api.rootCollections)

  // PersistentIdentity endpoints
  app.get('/public/:collectionId/:displayId', views.persistentIdentity)
  app.get('/public/:collectionId/:displayId/sbol', api.persistentIdentity)
  app.get('/public/:collectionId/:displayId/sbolnr', api.persistentIdentity)
  app.get('/public/:collectionId/:displayId/search/:query?', views.search)

  app.get('/user/:userId/:collectionId/:displayId', views.persistentIdentity)
  app.get('/user/:userId/:collectionId/:displayId/sbol', api.persistentIdentity)
  app.get('/user/:userId/:collectionId/:displayId/sbolnr', api.persistentIdentity)
  app.get('/user/:userId/:collectionId/:displayId/search/:query?', views.search)

  // TODO: missing share endpoints, perhaps okay

  // Public only endpoints
  app.get('/public/:collectionId/:displayId/:version/copyFromRemote', requireUser, actions.copyFromRemote)
  app.post('/public/:collectionId/:displayId/:version/copyFromRemote', requireUser, uploadToMemory.single('file'), actions.copyFromRemote)
  app.get('/public/:collectionId/:displayId/:version/createSnapshot', actions.createSnapshot)

  // TODO: need to decide if createSnapshot is functional and should be kept or not

  // User only endpoints
  app.get('/user/:userId/:collectionId/:displayId/:version/cloneSubmission/', requireUser, actions.cloneSubmission)
  app.post('/user/:userId/:collectionId/:displayId/:version/cloneSubmission/', requireUser, uploadToMemory.single('file'), actions.cloneSubmission)
  app.get('/user/:userId/:collectionId/:displayId/:version/makePublic', requireUser, actions.makePublic)
  app.post('/user/:userId/:collectionId/:displayId/:version/makePublic', requireUser, uploadToMemory.single('file'), actions.makePublic)

  // TODO: these should NOT be GET!
  app.get('/user/:userId/:collectionId/:displayId/:version/remove', requireUser, actions.remove)
  app.get('/user/:userId/:collectionId/:displayId/:version/replace', requireUser, actions.replace)
  app.get('/user/:userId/:collectionId/:displayId/:version/createImplementation', requireUser, actions.createImplementation)
  app.get('/user/:userId/:collectionId/:displayId/:version/createTest', requireUser, actions.createTest)
  app.post('/user/:userId/:collectionId/:displayId/:version/edit/:field', requireUser, api.editObject)
  app.post('/user/:userId/:collectionId/:displayId/:version/add/:field', requireUser, api.addObject)
  app.post('/user/:userId/:collectionId/:displayId/:version/remove/:field', requireUser, api.removeObject)

  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/remove', actions.remove)
  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/replace', actions.replace)
  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/makePublic', actions.makePublic)
  app.post('/user/:userId/:collectionId/:displayId/:version/:hash/share/makePublic', uploadToMemory.single('file'), actions.makePublic)

  // Remote ICE/Benchling endpoints
  app.get('/public/:collectionId/:displayId/:version/createBenchlingSequence', requireUser, actions.createBenchlingSequence)
  app.post('/public/:collectionId/:displayId/:version/createBenchlingSequence', requireUser, uploadToMemory.single('file'), actions.createBenchlingSequence)
  app.get('/public/:collectionId/:displayId/:version/createICEPart', requireUser, actions.createICEPart)
  app.post('/public/:collectionId/:displayId/:version/createICEPart', requireUser, uploadToMemory.single('file'), actions.createICEPart)

  app.get('/user/:userId/:collectionId/:displayId/:version/createBenchlingSequence', requireUser, actions.createBenchlingSequence)
  app.post('/user/:userId/:collectionId/:displayId/:version/createBenchlingSequence', requireUser, uploadToMemory.single('file'), actions.createBenchlingSequence)
  app.get('/user/:userId/:collectionId/:displayId/:version/createICEPart', requireUser, actions.createICEPart)
  app.post('/user/:userId/:collectionId/:displayId/:version/createICEPart', requireUser, uploadToMemory.single('file'), actions.createICEPart)

  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/createBenchlingSequence', actions.createBenchlingSequence)
  app.post('/user/:userId/:collectionId/:displayId/:version/:hash/share/createBenchlingSequence', uploadToMemory.single('file'), actions.createBenchlingSequence)
  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/createICEPart', actions.createICEPart)
  app.post('/user/:userId/:collectionId/:displayId/:version/:hash/share/createICEPart', uploadToMemory.single('file'), actions.createICEPart)

  // Endpoints for attachments
  app.post('/public/:collectionId/:displayId/:version/attach', requireUser, actions.upload)
  app.post('/public/:collectionId/:displayId/:version/attachUrl', requireUser, api.attachUrl)
  app.get('/public/:collectionId/:displayId/:version/download', api.download)

  app.post('/user/:userId/:collectionId/:displayId/:version/attach', requireUser, actions.upload)
  app.post('/user/:userId/:collectionId/:displayId/:version/attachUrl', requireUser, api.attachUrl)
  app.get('/user/:userId/:collectionId/:displayId/:version/download', requireUser, api.download)

  app.post('/user/:userId/:collectionId/:displayId/:version/:hash/share/attach', actions.upload)
  app.post('/user/:userId/:collectionId/:displayId/:version/:hash/share/attachUrl', api.attachUrl)
  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/download', api.download)

  // Download data endpoints
  app.get('/public/:collectionId/:displayId/:version/:filename.xml', api.sbol)
  app.get('/public/:collectionId/:displayId/:version/:filename.omex', api.omex)
  app.get('/public/:collectionId/:displayId/:version/:filename.json', api.summary)
  app.get('/public/:collectionId/:displayId/:version/:filename.fasta', api.fasta)
  app.get('/public/:collectionId/:displayId/:version/:filename.gb', api.genBank)
  app.get('/public/:collectionId/:displayId/:version/sbol', api.sbol)
  app.get('/public/:collectionId/:displayId/:version/sbolnr', api.sbolnr)
  app.get('/public/:collectionId/:displayId/:version/metadata', api.metadata)

  app.get('/user/:userId/:collectionId/:displayId/:version/:filename.xml', api.sbol)
  app.get('/user/:userId/:collectionId/:displayId/:version/:filename.omex', api.omex)
  app.get('/user/:userId/:collectionId/:displayId/:version/:filename.json', api.summary)
  app.get('/user/:userId/:collectionId/:displayId/:version/:filename.fasta', api.fasta)
  app.get('/user/:userId/:collectionId/:displayId/:version/:filename.gb', api.genBank)
  app.get('/user/:userId/:collectionId/:displayId/:version/sbol', api.sbol)
  app.get('/user/:userId/:collectionId/:displayId/:version/sbolnr', api.sbolnr)
  app.get('/user/:userId/:collectionId/:displayId/:version/metadata', api.metadata)

  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/:filename.xml', api.sbol)
  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/:filename.omex', api.omex)
  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/:filename.json', api.summary)
  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/:filename.fasta', api.fasta)
  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/:filename.gb', api.genBank)
  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/sbol', api.sbol)
  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/sbolnr', api.sbolnr)
  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/metadata', api.metadata)

  // Update submission endpoints
  app.post('/public/:collectionId/:displayId/:version/icon', requireUser, uploadToMemory.single('collectionIcon'), actions.updateCollectionIcon)
  app.get('/public/:collectionId/:displayId/:version/removeCollection', requireAdmin, actions.removeCollection)

  app.get('/user/:userId/:collectionId/:displayId/:version/removeCollection', requireUser, actions.removeCollection)

  // TODO: should perhaps be able to add icon to private collection, but it will be tricky to update on makePublic

  // Search endpoints
  app.get('/public/:collectionId/:displayId/:version/search/:query?', views.search)
  app.get('/public/:collectionId/:displayId/:version/subCollections', api.subCollections)
  app.get('/public/:collectionId/:displayId/:version/twins', views.search)
  app.get('/public/:collectionId/:displayId/:version/uses', views.search)
  app.get('/public/:collectionId/:displayId/:version/similar', views.search)

  app.get('/user/:userId/:collectionId/:displayId/:version/search/:query?', views.search)
  app.get('/user/:userId/:collectionId/:displayId/:version/subCollections', api.subCollections)
  app.get('/user/:userId/:collectionId/:displayId/:version/twins', views.search)
  app.get('/user/:userId/:collectionId/:displayId/:version/uses', views.search)
  app.get('/user/:userId/:collectionId/:displayId/:version/similar', views.search)

  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/search/:query?', views.search)
  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/subCollections', api.subCollections)
  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/twins', views.search)
  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/uses', views.search)
  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/similar', views.search)

  // Share management endpoints
  app.get('/user/:userId/:collectionId/:displayId/:version/createShareLink', requireUser, views.createShareLink)
  app.post('/user/:userId/:collectionId/:displayId/:version/createShareLink', requireUser, views.createShareLink)

  app.get('/user/:userId/:collectionId/:displayId/:version/displayShareLink', requireUser, views.displayShareLink)
  app.post('/user/:userId/:collectionId/:displayId/:version/displayShareLink', requireUser, views.displayShareLink)

  app.get('/user/:userId/:collectionId/:displayId/:version/createShare', requireUser, views.createShare)
  app.post('/user/:userId/:collectionId/:displayId/:version/createShare', requireUser, views.createShare)

  app.get('/user/:userId/:collectionId/:displayId/:version/sharing', requireUser, views.sharing)

  // Visualization Endpoints
  app.get('/user/:userId/:collectionId/:displayId/:version/:hash/share/visualization', views.visualization)
  app.get('/user/:userId/:collectionId/:displayId/:version([^\\.]+)/visualization', views.visualization)

  app.get('/public/:collectionId/:displayId/:version([^\\.]+)/visualization', views.visualization)

  // View endpoints
  app.get('/user/:userId/:collectionId/:displayId(*)/:version/:hash/share/full', views.topLevel)
  app.get('/user/:userId/:collectionId/:displayId(*)/:version/:hash/share', views.topLevel)

  //    app.get('/public/:collectionId/:displayId/:version/:query?', views.topLevel);
  app.get('/public/:collectionId/:displayId(*)/:version/full', views.topLevel)
  app.get('/public/:collectionId/:displayId(*)/:version', views.topLevel)

  //    app.get('/user/:userId/:collectionId/:displayId/:version/:query?', views.topLevel);
  app.get('/user/:userId/:collectionId/:displayId(*)/:version/full', views.topLevel)
  app.get('/user/:userId/:collectionId/:displayId(*)/:version', views.topLevel)

  app.get('/sparql', sparql)
  app.post('/sparql', bodyParser.urlencoded({ extended: true }), sparql)

  function sparql (req, res) {
    // jena sends accept: */* and then complains when we send HTML
    // back. so only send html if the literal string text/html is present
    // in the accept header.

    let accept = req.header('accept')
    if (accept && accept.indexOf('text/html') !== -1) {
      views.sparql(req, res)
    } else {
      api.sparql(req, res)
    }
  }

  function sparqlAdmin (req, res) {
    // jena sends accept: */* and then complains when we send HTML
    // back. so only send html if the literal string text/html is present
    // in the accept header.

    let accept = req.header('accept')
    if (accept && accept.indexOf('text/html') !== -1) {
      views.admin.sparql(req, res)
    } else {
      api.admin.sparql(req, res)
    }
  }

  function requireUser (req, res, next) {
    if (req.user === undefined) {
      if (!req.accepts('text/html')) {
        res.status(401).send('Login required')
      } else {
        res.redirect('/login?next=' + encodeURIComponent(req.url))
      }
    } else { next() }
  }

  function requireAdmin (req, res, next) {
    if (req.user === undefined || !req.user.isAdmin) {
      if (!req.accepts('text/html')) {
        res.status(401).send('Administrator login required')
      } else {
        res.redirect('/login?next=' + encodeURIComponent(req.url))
      }
    } else { next() }
  }

  async function authorize (req, res, next) {
    if (!req.url.startsWith('/user/')) {
      next()
      return
    }

    let users = req.session.users || []
    let allowed = await access.view(users, req.url)
    if (allowed) {
      next()
      return
    }

    if (!req.accepts('text/html')) {
      res.status(401).send('Login required')
    } else {
      res.redirect('/login?next=' + encodeURIComponent(req.url))
    }
  }

  if (config.get('prewarmSearch')) {
    cache.update()
  }

  return app
}

module.exports = App
