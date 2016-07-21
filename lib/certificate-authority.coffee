###
  Pokemon Go (c) MITM node proxy certificate generator
  by Michael Strassburger <codepoet@cpan.org>
###

fs = require 'fs'
path = require 'path'
Forge = require 'node-forge'
pki = Forge.pki
async = require 'async'

class CA
  config:
    folder: 'cert'
    attributes: [
      name: 'commonName', value: 'PokemonGoMITM'
    ,
      name: 'countryName', value: 'Internet'
    ,
      shortName: 'ST', value: 'Internet'
    ,
      name: 'localityName', value: 'Internet'
    ,
      name: 'organizationName', value: 'pokemon-go-mitm'
    ,
      shortName: 'OU', value: 'CA'
    ]
    extensions: [
      name: 'basicConstraints', cA: true
    ,
      name: 'keyUsage', keyCertSign: true, digitalSignature: true, nonRepudiation: true, keyEncipherment: true, dataEncipherment: true
    ,
      name: 'extKeyUsage', serverAuth: true, clientAuth: true, codeSigning: true, emailProtection: true, timeStamping: true
    ,
      name: 'nsCertType', client: true, server: true, email: true, objsign: true, sslCA: true, emailCA: true, objCA: true
    ,
      name: 'subjectKeyIdentifier'
    ]

  randomSerialNumber: ->
    sn = ''
    for i in [0...4]
      sn += ('00000000' + Math.floor(Math.random()*Math.pow(256, 4)).toString(16)).slice(-8);
    sn

  generate: (cb) ->
    # Don't do anything if there's already a cert folder
    try
      fs.statSync @config.folder
      return

    fs.mkdirSync @config.folder

    pki.rsa.generateKeyPair bits: 2048, (err, keys) =>
      return callback err if err
      
      cert = pki.createCertificate()
      cert.publicKey = keys.publicKey
      cert.serialNumber = @randomSerialNumber()
      cert.validity.notBefore = new Date()
      cert.validity.notAfter = new Date()
      
      cert.validity.notAfter.setFullYear cert.validity.notBefore.getFullYear() + 10
      cert.setSubject @config.attributes
      cert.setIssuer @config.attributes
      cert.setExtensions @config.extensions
      
      cert.sign keys.privateKey, Forge.md.sha256.create()

      async.parallel [
        fs.writeFile.bind null, path.join(@config.folder, 'ca.pem'), pki.certificateToPem cert
        fs.writeFile.bind null, path.join(@config.folder, 'ca.key'), pki.privateKeyToPem keys.privateKey
      ], cb

module.exports = new CA