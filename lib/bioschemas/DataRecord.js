
var extend = require('xtend')
var config = require('../config')
var uriToUrl = require('../uriToUrl')


module.exports = function generateDataRecord(metadata) {

  let url = config.get('instanceUrl').slice(0, -1) + uriToUrl(metadata.uri)

  let keywords = []

  for(let role of metadata.roles) {
    if(role.description && role.description.name) {
      keywords.push(role.description.name)
    } else if(role.term && role.term.indexOf('http') !== 0) {
      keywords.push(role.term)
    }
  }

  return extend({

    "identifier": [
      metadata.name
    ],
    "mainEntity": {
      "@type": metadata.rdfType,
      "identifier": metadata.name,
      "hasBioChemRole": metadata.roles.map((role) => role.uri),
      "url": url,
      "description": (metadata.description || '').trim(),
      "keywords": keywords.join(' ')
    },
    "keywords": keywords.join(' '),
    "url": url

  }, config.get('bioschemas').DataRecord)

}
