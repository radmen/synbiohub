
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
const uriToUrl = require('../uriToUrl')

module.exports = function(req, res) {


    var sbol
    var genericTopLevel
    var collectionIcon
    var remote

    req.setTimeout(0) // no timeout

    // const { graphUri, uri, designId, baseUri } = getUrisFromReq(req, res)

    const { graphUri, uri, designId, baseUri, url } = getUrisFromReq(req, res)
    // meta = sbolmeta.summarizeGenericTopLevel(genericTopLevel)
    console.log(uri)
    console.log(graphUri)

    var implementationId = req.params.displayId  + '_build'
    var implementationVersion = '1'
    var implementationPersistentIdentity = baseUri + '/' + implementationId
    var implementationUri = implementationPersistentIdentity + '/' + implementationVersion

    const userUri = config.get('databasePrefix') + 'user/' + req.user.username

    var templateParams = {
        uri: sparql.escapeIRI(implementationUri),
        persistentIdentity: sparql.escapeIRI(implementationPersistentIdentity),
        displayId: JSON.stringify(implementationId),
        version: JSON.stringify(implementationVersion),
        implementationOf: sparql.escapeIRI(uri),
        ownedBy: userUri
    }

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
      console.log(meta)

      // doc= new SBOLDocument();
      // var document = doc
      // asc = doc.provAssociation('testasc')
      // asc.agent = 'Chris'
      // asc.plan = 'DNA Protocol'
      //
      // act = doc.provActivity('testact')
      // act.associations = asc
      //
      // impl = doc.implementation('testimpl')
      //
      // impl.wasGeneratedBy = 'testact'
      // mdef = doc.moduleDefinition('testmdef')
      // impl.wasDerivedFrom = 'testmdef'

      console.log(cas9_generic_cd)

      if (componentDefinition.wasGeneratedBy) {
    	    meta.wasGeneratedBy = { uri: componentDefinition.wasGeneratedBy.uri?componentDefinition.wasGeneratedBy.uri:componentDefinition.wasGeneratedBy,
    				    url: uriToUrl(componentDefinition.wasGeneratedBy,req)
    				  }
    	}
      var query = loadTemplate('sparql/CreateImplementation.sparql', templateParams)
      var locals = {
            config: config.get(),
            section: 'component',
            user: req.user,
            meta: meta,
            rdfType: "Component"
        }
      res.send(pug.renderFile('templates/views/createImplementation.jade', locals))
    })



	// sparql.updateQuery(query, graphUri).then((r) => {
  //
  //           console.log(r)
  //           // res.redirect('/'+implementationUri.replace(config.get('databasePrefix'),''))
  //
  //   }).catch((err) => {
  //
  //       res.status(500).send(err.stack)
  //
  //   })
};
