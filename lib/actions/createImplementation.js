
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

    fetchSBOLObjectRecursive('ComponentDefinition', uri, graphUri).then((result) => {

        sbol = result.sbol
        componentDefinition = result.object
        remote = result.remote || false

        // console.log(sbol)
        // console.log(componentDefinition)

        if(!componentDefinition || componentDefinition instanceof URI) {
            return Promise.reject(new Error(uri + ' not found: ' + componentDefinition))
        }

        meta = sbolmeta.summarizeComponentDefinition(componentDefinition)
        meta.url = uri
        if(!meta) {
            return Promise.reject(new Error('summarizeComponentDefinition returned null'))
        }

    }).then(() => {
      // console.log(meta)

      if (componentDefinition.wasGeneratedBy) {
    	    meta.wasGeneratedBy = { uri: componentDefinition.wasGeneratedBy.uri?componentDefinition.wasGeneratedBy.uri:componentDefinition.wasGeneratedBy,
    				    url: uriToUrl(componentDefinition.wasGeneratedBy,req)
    				  }
    	}
      // var query = loadTemplate('sparql/CreateImplementation.sparql', templateParams)
      var locals = {
            config: config.get(),
            section: 'component',
            user: req.user,
            meta: meta,
            rdfType: "Component"
        }
      res.send(pug.renderFile('templates/views/createImplementation.jade', locals))
    })

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
    console.log(uri)

    prefix = baseUri
    displayId = designId.split('/')[1]
    version = '1'

    console.log(prefix)
    console.log(displayId)


    doc= new SBOLDocument();
    var document = doc
    asc = doc.provAssociation(prefix + '/' + displayId + '_association/' + version) //TODO FIX URL
    asc.displayId = displayId + '_association'
    asc.persistentIdentity = prefix + asc.displayId
    asc.version = version

    agent_str = fields['agent'][0]
    agent_uri = uri + '/'+ agent_str.replace(/\s+/g, '')
    plan_str = fields['plan'][0]
    plan_uri = uri + '/' + plan_str.replace(/\s+/g, '')

    // console.log(agent_uri)
    agent = doc.provAgent(agent_uri)
    agent.description = agent_str
    plan = doc.provPlan(plan_uri)
    plan.description = plan_str

    asc.agent = agent_uri
    asc.plan = plan_uri

    act = doc.provActivity(prefix + '/' + displayId + '_activity/' + version) //TODO FIX URL
    act.displayId = displayId + '_activity'
    act.persistentIdentity = prefix + '/' + act.displayId
    act.version = version

    act.addAssociation(asc)

    usg = doc.provUsage(prefix + '/' + displayId + '_usage/' + version) //TODO FIX URL
    usg.displayId = displayId + '_usage'
    usg.persistentIdentity = prefix + '/' + usg.displayId
    usg.version = version

    usg.addRole('build')
    act.addUsage(usg)

    impl = doc.implementation(prefix + '/' + displayId + '_implementation/' + version) //TODO FIX URL

    impl.displayId = displayId + '_implementation'
    impl.persistentIdentity = prefix + '/' + impl.displayId  //TODO FIX URL
    impl.version = version
    impl.description = fields['description'][0]

    impl.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/synbiohub#physicalLocation', fields['location'][0])

    impl.addWasGeneratedBy(act.uri) //TODO FIX URL

    impl.wasDerivedFrom = uri

    console.log(doc.serializeXML())

    sparql.upload(graphUri, doc.serializeXML(), 'application/rdf+xml').then( () => {

      res.redirect(impl.uri) //TODO FIX URL

    })

  })
}
