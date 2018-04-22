
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

      submitPost(req, res)
    }

    else{

      submitForm(req, res)

    }

}


function submitForm(req, res){

    var sbol
    var genericTopLevel
    var collectionIcon
    var remote

    req.setTimeout(0) // no timeout

    var locals = {
          config: config.get()
      }

    const { graphUri, uri, designId, baseUri, url } = getUrisFromReq(req, res)

    res.send(pug.renderFile('templates/views/createImplementation.jade', locals))


}

function submitPost(req, res){

  const { graphUri, uri, designId, baseUri, url } = getUrisFromReq(req, res)

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
    displayId = fields['design_name'][0].replace(/\s+/g, '')
    version = '1'

    console.log(prefix)
    console.log(displayId)

    var templateParams = {
       uri: prefix + '/' + displayId + '/' + version

    }

    var countQuery = loadTemplate('sparql/getImplementations.sparql', templateParams)
    console.log(templateParams)

    sparql.queryJson(countQuery, graphUri).then((count) => {

      // count = String(parseInt(count[0]['callret-0']) + 1)

      count = JSON.parse(JSON.stringify(count))
      console.log('count ' + count.length)

      if (count!=0){
        console.log('IMPLEMENTATION ALREADY EXISTS') //TODO refresh the page with an error message
        res.redirect('/manage')

      }

      doc= new SBOLDocument();
      var document = doc
      asc = doc.provAssociation(prefix + '/' + displayId + '_association/' + version) //TODO FIX URL
      asc.displayId = displayId + '_association'
      asc.persistentIdentity = prefix + '/' + asc.displayId
      asc.version = version
      asc.addRole('http://sbols.org/v2#build')


      agent_str = fields['agent'][0]
      agent_uri = uri + '/'+ agent_str.replace(/\s+/g, '')
      plan_str = fields['plan'][0]
      plan_uri = uri + '/' + plan_str.replace(/\s+/g, '')

      agent = doc.provAgent(agent_uri)
      agent.displayId = agent_str
      agent.name = agent_str
      plan = doc.provPlan(plan_uri)
      plan.displayId = plan_str
      plan.name = plan_str

      agent.addUriAnnotation('http://wiki.synbiohub.org/wiki/Terms/synbiohub#topLevel', agent.uri)
      plan.addUriAnnotation('http://wiki.synbiohub.org/wiki/Terms/synbiohub#topLevel', plan.uri)

      asc.agent = agent_uri
      asc.plan = plan_uri

      act = doc.provActivity(prefix + '/' + displayId + '_activity/' + version) //TODO FIX URL
      act.displayId = displayId + '_activity'
      act.persistentIdentity = prefix + '/' + act.displayId
      act.version = version

      act.addUriAnnotation('http://wiki.synbiohub.org/wiki/Terms/synbiohub#topLevel', act.uri)

      act.addAssociation(asc)

      usg = doc.provUsage(prefix + '/' + displayId + '_usage/' + version) //TODO FIX URL
      usg.displayId = displayId + '_usage'
      usg.persistentIdentity = prefix + '/' + usg.displayId
      usg.version = version
      usg.entity = uri

      usg.addRole('http://sbols.org/v2#design')
      act.addUsage(usg)

      impl = doc.implementation(prefix + '/' + displayId + '/' + version) //TODO FIX URL

      impl.displayId = displayId
      impl.persistentIdentity = prefix + '/' + impl.displayId  //TODO FIX URL
      impl.version = version
      impl.description = fields['description'][0]
      impl.built = prefix + '/' + displayId + '/' + version

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
