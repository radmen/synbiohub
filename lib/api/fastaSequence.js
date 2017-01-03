
var getSequence= require('../../lib/get-sbol').getSequence

var sbolmeta = require('sbolmeta')

var config = require('../config')

module.exports = function(req, res) {

    var stack = require('../../lib/stack')()

    stack.getPrefixes((err, prefixes) => {

        var baseUri
        var uri

	if(req.params.userId) {
	    var designId = req.params.collectionId + '/' + req.params.displayId + '/' + req.params.version
	    uri = config.get('databasePrefix') + 'user/' + encodeURIComponent(req.params.userId) + '/' + designId
	} else {
	    var designId = req.params.collectionId + '/' + req.params.displayId + '/' + req.params.version
	    uri = config.get('databasePrefix') + 'public/' + designId
	} 

        var stores = [
            stack.getDefaultStore()
        ]

        if(req.userStore)
            stores.push(req.userStore)

        getSequence(null, uri, stores, function(err, sbol, sequence) {

            if(err) {

                res.status(500).send(err)

            } else {
                var meta = sbolmeta.summarizeSequence(sequence)

                var lines = []
                var charsPerLine = 70

                lines.push('>' + meta.name 
                           + ' (' + meta.length + ' ' + meta.lengthUnits + ')')

                for(var i = 0; i < meta.length; ) {

                    lines.push(meta.elements.substr(i, charsPerLine))
                    i += charsPerLine
                }

                var fasta = lines.join('\n')

                res.header('content-type', 'text/plain').send(fasta)
            }

        });

    })

};

