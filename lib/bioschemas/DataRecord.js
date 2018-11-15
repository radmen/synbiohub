
var extend = require('xtend')
var config = require('../config')
var uriToUrl = require('../uriToUrl')


module.exports = function generateDataRecord(metadata) {

  let url = config.get('instanceUrl').slice(0, -1) + uriToUrl(metadata.uri)

  let keywords = generateDataRecordKeywords(metadata)

  let schema = generateDataRecordGeneric(metadata, url, keywords)

  console.log(JSON.stringify(schema, null, 2))
  console.log(metadata.type)
  if(metadata.type.uri === 'http://www.biopax.org/release/biopax-level3.owl#DnaRegion') {

    schema = extend(schema, generateDataRecordDNA(metadata, url, keywords))
  } else if(metadata.type.uri === 'http://www.biopax.org/release/biopax-level3.owl#Protein') {
    schema = extend(schema, generateDataRecordProtein(metadata, url, keywords))
  }

  console.log(JSON.stringify(schema, null, 2))

  return schema

}


function generateDataRecordKeywords(metadata){

  keywords = []

  for(let role of metadata.roles) {
    if(role.description && role.description.name) {
      keywords.push(role.description.name)
    } else if(role.term && role.term.indexOf('http') !== 0) {
      keywords.push(role.term)
    }
  }

  return keywords.map((keyword) => keyword.toLowerCase())

}

function generateDataRecordDNA(metadata, url, keywords){

  keywords = ['dna'].concat(keywords)

  return {
    "keywords":keywords.join(' '),
    "mainEntity": {
      "@type": "https://bioschemas.org/DNA",
      "identifier": metadata.name,
      "hasBioChemRole": metadata.roles.map((role) => role.uri),
      "url": url,
      "description": (metadata.description || '').trim(),
      "keywords": keywords.join(' ')
      }
    }

}

function generateDataRecordProtein(metadata, url, keywords){

  keywords = ['protein'].concat(keywords)

  return {
    "keywords":keywords.join(' '),
    "mainEntity": {
      "@type": "https://bioschemas.org/Protein",
      "identifier": metadata.name,
      "hasBioChemRole": metadata.roles.map((role) => role.uri),
      "url": url,
      "description": (metadata.description || '').trim(),
      "keywords": keywords.join(' ')
      }
    }

}

function generateDataRecordGeneric(metadata, url, keywords) {

  return extend({
    "identifier": [
      metadata.name
    ],
    "url": url
  }, config.get('bioschemas').DataRecord)

}
