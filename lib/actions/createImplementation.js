
const { fetchSBOLObjectRecursive } = require('../fetch/fetch-sbol-object-recursive')
const { getContainingCollections } = require('../query/local/collection')

var async = require('async');

var request = require('request')

var loadTemplate = require('../loadTemplate')
var implementation = require('../views/implementation')
var config = require('../config')
var pug = require('pug')
var getUrisFromReq = require('../getUrisFromReq')
var splitUri = require('../splitUri')
var sbolmeta = require('sbolmeta')
var sparql = require('../sparql/sparql')
var URI = require('sboljs').URI
var SBOLDocument = require('sboljs')
var meta

const triplestoreConfig = config.get('triplestore')
const multiparty = require('multiparty')

const uriToUrl = require('../uriToUrl')

module.exports = function(req, res) {

    const { graphUri, uri, designId, baseUri, url } = getUrisFromReq(req, res)

    console.log( graphUri)

    if (req.method === 'POST'){

      submitPost(req, res, uri)
    }

    else{

    var sbol
    var genericTopLevel
    var collectionIcon
    var remote

    req.setTimeout(0) // no timeout

    // const { graphUri, uri, designId, baseUri } = getUrisFromReq(req, res)


    // meta = sbolmeta.summarizeGenericTopLevel(genericTopLevel)
    console.log(uri)
    console.log(graphUri)

    var locals = {
          config: config.get()
      }

    res.send(pug.renderFile('templates/views/createImplementation.jade', locals))


}
};


function submitPost(req, res, uri){

  req.setTimeout(0) // no timeout

  const form = new multiparty.Form()

  form.on('error', (err) => {
      res.status(500).send(err)
  })

  var overwrite_merge = "unset"
  var collectionUri
  var collectionId = ''
  var version = ''
  var name = ''
  var description = ''
  var citations = ''


  form.parse(req, (err, fields, files) => {

    const { graphUri, uri, designId, baseUri, url } = getUrisFromReq(req, res)

    console.log('graphUri ' + graphUri)

    prefix = baseUri
    displayId = designId.split('/')[1]
    version = '1'

    console.log(prefix)
    console.log(displayId)

    var templateParams = {
       uri: uri

    }

    var countQuery = loadTemplate('sparql/getImplementations.sparql', templateParams)
    console.log(templateParams)

    sparql.queryJson(countQuery, graphUri).then((count) => {

      // count = String(parseInt(count[0]['callret-0']) + 1)

      count = JSON.parse(JSON.stringify(count))
      console.log('count ' + count.length)
      count = count.length + 1


      doc= new SBOLDocument();
      var document = doc
      asc = doc.provAssociation(prefix + '/' + displayId + '_association_' + count + '/' + version) //TODO FIX URL
      asc.displayId = displayId + '_association_' + count
      asc.persistentIdentity = prefix + asc.displayId
      asc.version = version
      asc.addRole('http://sbols.org/v2#build')


      agent_str = fields['agent'][0]
      agent_uri = uri + '/'+ agent_str.replace(/\s+/g, '')
      plan_str = fields['plan'][0]
      plan_uri = uri + '/' + plan_str.replace(/\s+/g, '')

      // console.log(agent_uri)
      agent = doc.provAgent(agent_uri)
      agent.description = agent_str
      plan = doc.provPlan(plan_uri)
      plan.description = plan_str

      agent.addUriAnnotation('http://wiki.synbiohub.org/wiki/Terms/synbiohub#topLevel', agent.uri)
      plan.addUriAnnotation('http://wiki.synbiohub.org/wiki/Terms/synbiohub#topLevel', plan.uri)

      asc.agent = agent_uri
      asc.plan = plan_uri

      act = doc.provActivity(prefix + '/' + displayId + '_activity_' + count + '/' + version) //TODO FIX URL
      act.displayId = displayId + '_activity_' + count
      act.persistentIdentity = prefix + '/' + act.displayId
      act.version = version

      act.addUriAnnotation('http://wiki.synbiohub.org/wiki/Terms/synbiohub#topLevel', act.uri)

      act.addAssociation(asc)

      usg = doc.provUsage(prefix + '/' + displayId + '_usage_' + count + '/' + version) //TODO FIX URL
      usg.displayId = displayId + '_usage_' + count
      usg.persistentIdentity = prefix + '/' + usg.displayId
      usg.version = version

      usg.addRole('http://sbols.org/v2#design')
      act.addUsage(usg)

      impl = doc.implementation(prefix + '/' + displayId + '_implementation_' + count + '/' + version) //TODO FIX URL

      impl.displayId = displayId + '_implementation_' + count
      impl.persistentIdentity = prefix + '/' + impl.displayId  //TODO FIX URL
      impl.version = version
      impl.description = fields['description'][0]
      impl.built = prefix + '/' + displayId + '_implementation_' + count + '/' + version

      impl.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/synbiohub#physicalLocation', fields['location'][0])

      impl.addWasGeneratedBy(act.uri) //TODO FIX URL

      impl.wasDerivedFrom = uri

      impl.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/synbiohub#ownedBy', graphUri)

      impl.addUriAnnotation('http://wiki.synbiohub.org/wiki/Terms/synbiohub#topLevel', impl.uri)

      console.log(doc.serializeXML())

      sparql.upload(graphUri, doc.serializeXML(), 'application/rdf+xml').then( () => {

        res.redirect(impl.uri) //TODO FIX URL

      })

    })

    // console.log(count)
    // fetchSBOLObjectRecursive('ComponentDefinition', uri, graphUri).then((result) => {
    //
    //   console.log
    //
    // })




  })
}
