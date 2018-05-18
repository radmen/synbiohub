const { fetchSBOLObjectRecursive } = require('../fetch/fetch-sbol-object-recursive')

var loadTemplate = require('../loadTemplate')

var sbolmeta = require('sbolmeta')

var async = require('async')

var pug = require('pug')

var sparql = require('../sparql/sparql-collate')

var config = require('../config')

var URI = require('sboljs').URI

var getUrisFromReq = require('../getUrisFromReq')

const attachments = require('../attachments')

const getAttachmentsFromList = require('../attachments')

module.exports = async function(req, res) {

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

    result = await fetchSBOLObjectRecursive(uri , graphUri)

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

		try {
			await renderView(req, res, locals, remote, genericTopLevel, meta)

		}

		catch(err){

			locals = {
					config: config.get(),
					section: 'errors',
					user: req.user,
					errors: [ err.stack ]
			}
			res.send(pug.renderFile('templates/views/errors/errors.jade', locals))

		}

};


async function renderView(req, res, locals, remote, genericTopLevel, meta) {

		const { graphUri, uri, designId, share, url } = getUrisFromReq(req, res)

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

		    name : 'Experiment',
		    url : 'http://wiki.synbiohub.org/wiki/Terms/SynBioHub#Experiment'
		}

		locals.share = share
		locals.sbolUrl = url + '/' + meta.id + '.xml'

		if(req.params.userId) {

		    locals.searchUsesUrl = '/user/' + encodeURIComponent(req.params.userId) + '/' + designId + '/uses'
		    locals.remove = '/user/' + encodeURIComponent(req.params.userId) + '/' + designId + '/remove'
		}

		locals.meta.description = locals.meta.description.split('<br/>').join('')

		result = await fetchSBOLObjectRecursive(genericTopLevel._wasGeneratedBys.toString(), graphUri)

		asc = result.object._sbolDocument._provAssociations[0]

		agent = asc._agent._displayId
		plan = asc._plan._displayId

		locals.agent = agent
		locals.plan = plan

		var templateParams = {
				uri: uri
		}
 
		var getAttachmentsQuery = loadTemplate('sparql/GetAttachments.sparql', templateParams)

		metadataAttachmentList = await sparql.queryJson(getAttachmentsQuery, graphUri)

		locals.meta.metadataattachments = await getAttachmentsFromList.getAttachmentsFromList(graphUri, metadataAttachmentList,
				 req.url.toString().endsWith('/share'))

		for (attachment of locals.meta.metadataattachments){
				if (attachment.size === 0){
					locals.meta.dataurl = attachment.url
				}

		}

		console.log(locals.meta.dataurl)

		result = await fetchSBOLObjectRecursive(asc._plan._uri.toString(), graphUri)

		sbol = result.sbol
		genericTopLevel = result.object

		locals.meta.planattachments = await attachments.getAttachmentsFromTopLevel(sbol, genericTopLevel,
						req.url.toString().endsWith('/share'))

		res.send(pug.renderFile('templates/views/test.jade', locals))

    }
