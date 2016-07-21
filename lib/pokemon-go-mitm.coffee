###
  Pokemon Go (c) MITM node proxy
  by Michael Strassburger <codepoet@cpan.org>
###

POGOProtos = require 'pokemongo-protobuf'
changeCase = require 'change-case'
fs = require 'fs'
_ = require 'lodash'
hoxy = require 'hoxy'
CA = require './certificate-authority'

class PokemonGoMITM
  responseEnvelope: 'POGOProtos.Networking.Envelopes.ResponseEnvelope'
  requestEnvelope: 'POGOProtos.Networking.Envelopes.RequestEnvelope'

  requestHandlers: {}
  responseHandlers: {}
  requestEnvelopeHandlers: []
  responseEnvelopeHandlers: []

  messageInjectQueue: []

  gameHost: 'pgorelease.nianticlabs.com'

  constructor: (options) ->
    @port = options.port or 8081
    @debug = options.debug or false

    console.log "[+++] PokemonGo MITM Proxy listening on #{@port}"
    console.log "[!] Make sure to have the generated CA cert installed on your device!"

    @setupProxy()

  setupProxy: ->
    @proxy = hoxy
      .createServer certAuthority: @getCertificates()
      .listen port: @port

    @proxy.log 'error warn debug info', process.stdout

    @proxy.intercept
      hostname: @gameHost
      phase: 'request'
      as: 'buffer'
      @handleAppRequest
    
    @proxy.intercept
      hostname: @gameHost
      phase: 'response'
      as: 'buffer'
      @handleServerResponse

  getCertificates: ->
    # Backwards compatibility for installations prior v1.3 (switching to hoxy)
    try
      fs.statSync '.http-mitm-proxy'
      
      key: fs.readFileSync '.http-mitm-proxy/keys/ca.private.key'
      cert: fs.readFileSync '.http-mitm-proxy/certs/ca.pem'
    catch e
      CA.generate()

      key: fs.readFileSync 'cert/ca.key'
      cert: fs.readFileSync 'cert/ca.pem'

  handleAppRequest: (req, resp, cycle) =>
    @log "[+++] Request to #{req.hostname}"

    try
      data = POGOProtos.parse req.buffer, @requestEnvelope
    catch e
      @log "[-] couldn't parse RequestEnvelope.."
      return

    originalData = _.cloneDeep data

    for handler in @requestEnvelopeHandlers
      data = handler(data, url: req.url) or data

    requested = []

    for id,request of data.requests
      protoId = changeCase.pascalCase request.request_type
    
      # Queue the ProtoId for the response handling
      requested.push "POGOProtos.Networking.Responses.#{protoId}Response"
      
      proto = "POGOProtos.Networking.Requests.Messages.#{protoId}Message"
      unless proto in POGOProtos.info()
        @log "[-] Request handler for #{protoId} isn't implemented yet.."
        continue

      try
        decoded = if request.request_message
          POGOProtos.parse request.request_message, proto
        else {}
      catch e
        @log "[-] Couln't parse #{protoId} request.."
        continue
      
      if overwrite = @handleRequest protoId, decoded
        unless _.isEqual decoded, overwrite
          @log "[!] Overwriting "+proto
          request.request_message = POGOProtos.serialize overwrite, proto

    for message in @messageInjectQueue
      @log "[+] Injecting request to #{message.action}"
      @log message.data if message

      requested.push "POGOProtos.Networking.Responses.#{message.action}Response"
      data.requests.push
        request_type: changeCase.constantCase message.action
        request_message: POGOProtos.serialize message.data, "POGOProtos.Networking.Requests.Messages.#{message.action}Message"

    @messageInjectQueue = []

    
    unless _.isEqual originalData, data
      req.buffer = POGOProtos.serialize data, @requestEnvelope

    cycle.data 'requested', requested
    @log "[+] Waiting for response..."

  handleServerResponse: (req, resp, cycle) =>
    @log "[+++] Answer from #{req.url}"
    requested = cycle.data 'requested'

    try
      data = POGOProtos.parse resp.buffer, @responseEnvelope
    catch e
      @log "[-] Couldn't parse ResponseEnvelope.."
      return

    originalData = _.cloneDeep data

    for handler in @responseEnvelopeHandlers
      data = handler(data, {}) or data

    for id,response of data.returns
      proto = requested[id]
      if proto in POGOProtos.info()
        protoId = proto.split(/\./).pop().split(/Response/)[0]

        try
          decoded = POGOProtos.parse response, proto
        catch e
          @log "[-] Couldn't parse #{protoId} response.."
          continue
        
        if overwrite = @handleResponse protoId, decoded
          unless _.isEqual decoded, overwrite
            @log "[!] Overwriting "+protoId
            data.returns[id] = POGOProtos.serialize overwrite, proto

      else
        @log "[-] Response handler for #{requested[id]} isn't implemented yet.."

    # Overwrite the response in case a hook hit the fan
    unless _.isEqual originalData, data
      resp.buffer = POGOProtos.serialize data, @responseEnvelope

  handleRequest: (action, data) ->
    @log "[+] Request for action #{action}: "
    @log data if data

    handlers = [].concat @requestHandlers[action] or [], @requestHandlers['*'] or []
    for handler in handlers
      data = handler(data, action) or data

      return data

    false

  handleResponse: (action, data) ->
    @log "[+] Response for action #{action}"
    @log data if data

    handlers = [].concat @responseHandlers[action] or [], @responseHandlers['*'] or []
    for handler in handlers
      data = handler(data, action) or data

      return data

    false

  injectMessage: (action, data) ->
    unless "POGOProtos.Networking.Requests.Messages.#{action}Message" in POGOProtos.info()
      @log "[-] Can't inject action #{action} - proto not implemented"
      return

    @messageInjectQueue.push
      action: action
      data: data

  setResponseHandler: (action, cb) ->
    @addResponseHandler action, cb
    this

  addResponseHandler: (action, cb) ->
    @responseHandlers[action] ?= []
    @responseHandlers[action].push(cb)
    this

  setRequestHandler: (action, cb) ->
    @addRequestHandler action, cb
    this

  addRequestHandler: (action, cb) ->
    @requestHandlers[action] ?= []
    @requestHandlers[action].push(cb)
    this

  addRequestEnvelopeHandler: (cb, name=undefined) ->
    @requestEnvelopeHandlers.push cb
    this

  addResponseEnvelopeHandler: (cb, name=undefined) ->
    @responseEnvelopeHandlers.push cb
    this

  log: (text) ->
    console.log text if @debug

module.exports = PokemonGoMITM
