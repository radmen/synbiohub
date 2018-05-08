// This file manages the rendering of an Implementation

const { fetchSBOLObjectRecursive } = require('../fetch/fetch-sbol-object-recursive')

var filterAnnotations = require('../filterAnnotations')

var loadTemplate = require('../loadTemplate')

var sbolmeta = require('sbolmeta')

var pug = require('pug')

var sparql = require('../sparql/sparql-collate')

var config = require('../config')

var URI = require('sboljs').URI

var getUrisFromReq = require('../getUrisFromReq')

const attachments = require('../attachments')

const uriToUrl = require('../uriToUrl')

var sha1 = require('sha1');

module.exports = function(req, res) {

	var locals = {
        config: config.get(),
        section: 'component',
        user: req.user
    }

    var meta
    var sbol
    var genericTopLevel

    var remote

    const { graphUri, uri, designId, share, url } = getUrisFromReq(req, res)

    var templateParams = {
        uri: uri
    }

    fetchSBOLObjectRecursive(uri , graphUri).then((result) => {

        sbol = result.sbol
        genericTopLevel = result.object
        remote = result.remote

        if(!genericTopLevel || genericTopLevel instanceof URI) {
            locals = {
                config: config.get(),
                section: 'errors',
                user: req.user,
                errors: [ uri + ' Record Not Found: ' + genericTopLevel ]
            }
            res.send(pug.renderFile('templates/views/errors/errors.jade', locals))
            return Promise.reject()
        }

        meta = sbolmeta.summarizeGenericTopLevel(genericTopLevel)

        if(!meta) {
            locals = {
                config: config.get(),
                section: 'errors',
                user: req.user,
                errors: [ uri + ' summarizeGenericTopLevel returned null' ]
            }
            res.send(pug.renderFile('templates/views/errors/errors.jade', locals))
            return Promise.reject()
        }


      }).then(function renderView() {
        // meta.attachments = attachments.getAttachmentsFromTopLevel(sbol, genericTopLevel,
				// 			  req.url.toString().endsWith('/share'))

        locals.canEdit = false

        if(!remote && req.user) {

            const ownedBy = genericTopLevel.getAnnotations('http://wiki.synbiohub.org/wiki/Terms/synbiohub#ownedBy')
            const userUri = config.get('databasePrefix') + 'user/' + req.user.username

            if(ownedBy && ownedBy.indexOf(userUri) > -1) {
                locals.canEdit = true

            }

        }

				meta.url = '/' + meta.uri.toString().replace(config.get('databasePrefix'),'')

				if (req.url.toString().endsWith('/share')) {
				    meta.url += '/' + sha1('synbiohub_' + sha1(meta.uri) + config.get('shareLinkSalt')) + '/share'
				}

				meta.wasGeneratedBy = genericTopLevel.wasGeneratedBy
			        locals.meta = meta
			        locals.meta.triplestore = graphUri ? 'private' : 'public'
			        locals.meta.remote = remote

				locals.rdfType = {

				    name : 'Implementation',
				    url : 'http://wiki.synbiohub.org/wiki/Terms/SynBioHub#Implementation'
				}

        locals.annotations = filterAnnotations(req,genericTopLevel.annotations);

				locals.share = share
        locals.sbolUrl = url + '/' + meta.id + '.xml'

        if(req.params.userId) {

            locals.searchUsesUrl = '/user/' + encodeURIComponent(req.params.userId) + '/' + designId + '/uses'
            locals.remove = '/user/' + encodeURIComponent(req.params.userId) + '/' + designId + '/remove'
				}

				locals.meta.description = locals.meta.description.split('<br/>').join('')

				fetchSBOLObjectRecursive(genericTopLevel._wasGeneratedBys.toString(), graphUri).then((result) => {

						asc = result.object._sbolDocument._provAssociations[0]
						agent = asc._agent._displayId
						plan = asc._plan._displayId
						location = genericTopLevel._annotations[2]['value'].split('/').pop()


						locals.agent = agent
						locals.plan = plan
						locals.location = location


						fetchSBOLObjectRecursive(asc._plan._uri.toString(), graphUri).then((result) => {

							sbol = result.sbol
			        genericTopLevel = result.object

							locals.meta.attachments = attachments.getAttachmentsFromTopLevel(sbol, genericTopLevel,
											req.url.toString().endsWith('/share'))


						}).then(() => {
						res.send(pug.renderFile('templates/views/implementation.jade', locals))

				})

    }).catch((err) => {

        locals = {
            config: config.get(),
            section: 'errors',
            user: req.user,
            errors: [ err.stack ]
        }
        res.send(pug.renderFile('templates/views/errors/errors.jade', locals))
    })

})};
