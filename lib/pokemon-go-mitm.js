
/*
  Pokemon Go (c) MITM node proxy
  by Michael Strassburger <codepoet@cpan.org>
 */
var POGOProtos, PokemonGoMITM, Proxy, _, changeCase, fs,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

Proxy = require('http-mitm-proxy');

POGOProtos = require('pokemongo-protobuf');

changeCase = require('change-case');

fs = require('fs');

_ = require('lodash');

PokemonGoMITM = (function() {
  PokemonGoMITM.prototype.responseEnvelope = 'POGOProtos.Networking.Envelopes.ResponseEnvelope';

  PokemonGoMITM.prototype.requestEnvelope = 'POGOProtos.Networking.Envelopes.RequestEnvelope';

  PokemonGoMITM.prototype.requestHandlers = {};

  PokemonGoMITM.prototype.responseHandlers = {};

  PokemonGoMITM.prototype.requestEnvelopeHandlers = [];

  PokemonGoMITM.prototype.responseEnvelopeHandlers = [];

  PokemonGoMITM.prototype.messageInjectQueue = [];

  function PokemonGoMITM(options) {
    this.handleProxyError = bind(this.handleProxyError, this);
    this.handleProxyRequest = bind(this.handleProxyRequest, this);
    this.port = options.port || 8081;
    this.debug = options.debug || false;
    this.setupProxy();
  }

  PokemonGoMITM.prototype.setupProxy = function() {
    var proxy;
    proxy = Proxy();
    proxy.use(Proxy.gunzip);
    proxy.onRequest(this.handleProxyRequest);
    proxy.onError(this.handleProxyError);
    proxy.listen({
      port: this.port
    });
    console.log("[+++] PokemonGo MITM Proxy listening on " + this.port);
    return console.log("[!] Make sure to have the CA cert .http-mitm-proxy/certs/ca.pem installed on your device");
  };

  PokemonGoMITM.prototype.handleProxyRequest = function(ctx, callback) {
    var requestChunks, requested, responseChunks;
    if (ctx.clientToProxyRequest.headers.host !== "pgorelease.nianticlabs.com") {
      return callback();
    }
    this.log("[+++] Request to " + ctx.clientToProxyRequest.url);

    /* Client Reuqest Handling */
    requestChunks = [];
    ctx.onRequestData((function(_this) {
      return function(ctx, chunk, callback) {
        requestChunks.push(chunk);
        return callback(null, null);
      };
    })(this));
    requested = [];
    ctx.onRequestEnd((function(_this) {
      return function(ctx, callback) {
        var buffer, data, decoded, handler, i, id, j, len, len1, message, originalData, overwrite, proto, protoId, ref, ref1, ref2, request;
        buffer = Buffer.concat(requestChunks);
        data = POGOProtos.parse(buffer, _this.requestEnvelope);
        originalData = _.cloneDeep(data);
        ref = _this.requestEnvelopeHandlers;
        for (i = 0, len = ref.length; i < len; i++) {
          handler = ref[i];
          data = handler(data, {
            url: ctx.clientToProxyRequest.url
          }) || data;
        }
        ref1 = data.requests;
        for (id in ref1) {
          request = ref1[id];
          protoId = changeCase.pascalCase(request.request_type);
          requested.push("POGOProtos.Networking.Responses." + protoId + "Response");
          proto = "POGOProtos.Networking.Requests.Messages." + protoId + "Message";
          if (indexOf.call(POGOProtos.info(), proto) < 0) {
            _this.log("[-] Request handler for " + protoId + " isn't implemented yet..");
            continue;
          }
          decoded = request.request_message ? POGOProtos.parse(request.request_message, proto) : {};
          if (overwrite = _this.handleRequest(protoId, decoded)) {
            _this.log("[!] Overwriting " + proto);
            request.request_message = POGOProtos.serialize(overwrite, proto);
          }
        }
        ref2 = _this.messageInjectQueue;
        for (j = 0, len1 = ref2.length; j < len1; j++) {
          message = ref2[j];
          console.log("[+] Injecting request to " + message.action);
          if (message) {
            console.log(message.data);
          }
          requested.push("POGOProtos.Networking.Responses." + message.action + "Response");
          data.requests.push({
            request_type: changeCase.constantCase(message.action),
            request_message: POGOProtos.serialize(message.data, "POGOProtos.Networking.Requests.Messages." + message.action + "Message")
          });
        }
        _this.messageInjectQueue = [];
        _this.log("[+] Waiting for response...");
        if (!_.isEqual(originalData, data)) {
          buffer = POGOProtos.serialize(data, _this.requestEnvelope);
        }
        ctx.proxyToServerRequest.write(buffer);
        return callback();
      };
    })(this));

    /* Server Response Handling */
    responseChunks = [];
    ctx.onResponseData((function(_this) {
      return function(ctx, chunk, callback) {
        responseChunks.push(chunk);
        return callback();
      };
    })(this));
    ctx.onResponseEnd((function(_this) {
      return function(ctx, callback) {
        var buffer, data, decoded, handler, i, id, len, originalData, overwrite, proto, protoId, ref, ref1, response;
        buffer = Buffer.concat(responseChunks);
        data = POGOProtos.parse(buffer, _this.responseEnvelope);
        originalData = _.cloneDeep(data);
        ref = _this.responseEnvelopeHandlers;
        for (i = 0, len = ref.length; i < len; i++) {
          handler = ref[i];
          data = handler(data, {}) || data;
        }
        ref1 = data.returns;
        for (id in ref1) {
          response = ref1[id];
          proto = requested[id];
          if (indexOf.call(POGOProtos.info(), proto) >= 0) {
            decoded = POGOProtos.parse(response, proto);
            protoId = proto.split(/\./).pop().split(/Response/)[0];
            if (overwrite = _this.handleResponse(protoId, decoded)) {
              _this.log("[!] Overwriting " + protoId);
              data.returns[id] = POGOProtos.serialize(overwrite, proto);
            }
          } else {
            _this.log("[-] Response handler for " + requested[id] + " isn't implemented yet..");
          }
        }
        if (!_.isEqual(originalData, data)) {
          buffer = POGOProtos.serialize(data, _this.responseEnvelope);
        }
        ctx.proxyToClientResponse.end(buffer);
        return callback(false);
      };
    })(this));
    return callback();
  };

  PokemonGoMITM.prototype.handleProxyError = function(ctx, err, errorKind) {
    var url;
    url = ctx && ctx.clientToProxyRequest ? ctx.clientToProxyRequest.url : '';
    return console.error(errorKind + ' on ' + url + ':', err);
  };

  PokemonGoMITM.prototype.handleRequest = function(action, data) {
    var handler, handlers, i, len;
    this.log("[+] Request for action " + action + ": ");
    if (data) {
      this.log(data);
    }
    handlers = [].concat(this.requestHandlers[action] || [], this.requestHandlers['*'] || []);
    for (i = 0, len = handlers.length; i < len; i++) {
      handler = handlers[i];
      data = handler(data, action) || data;
      return data;
    }
    return false;
  };

  PokemonGoMITM.prototype.handleResponse = function(action, data) {
    var handler, handlers, i, len;
    this.log("[+] Response for action " + action);
    if (data) {
      this.log(data);
    }
    handlers = [].concat(this.responseHandlers[action] || [], this.responseHandlers['*'] || []);
    for (i = 0, len = handlers.length; i < len; i++) {
      handler = handlers[i];
      data = handler(data, action) || data;
      return data;
    }
    return false;
  };

  PokemonGoMITM.prototype.injectMessage = function(action, data) {
    var ref;
    if (ref = "POGOProtos.Networking.Requests.Messages." + action + "Message", indexOf.call(POGOProtos.info(), ref) < 0) {
      this.log("[-] Can't inject action " + action + " - proto not implemented");
      return;
    }
    return this.messageInjectQueue.push({
      action: action,
      data: data
    });
  };

  PokemonGoMITM.prototype.setResponseHandler = function(action, cb) {
    this.addResponseHandler(action, cb);
    return this;
  };

  PokemonGoMITM.prototype.addResponseHandler = function(action, cb) {
    var base;
    if ((base = this.responseHandlers)[action] == null) {
      base[action] = [];
    }
    this.responseHandlers[action].push(cb);
    return this;
  };

  PokemonGoMITM.prototype.setRequestHandler = function(action, cb) {
    this.addRequestHandler(action, cb);
    return this;
  };

  PokemonGoMITM.prototype.addRequestHandler = function(action, cb) {
    var base;
    if ((base = this.requestHandlers)[action] == null) {
      base[action] = [];
    }
    this.requestHandlers[action].push(cb);
    return this;
  };

  PokemonGoMITM.prototype.addRequestEnvelopeHandler = function(cb, name) {
    if (name == null) {
      name = void 0;
    }
    this.requestEnvelopeHandlers.push(cb);
    return this;
  };

  PokemonGoMITM.prototype.addResponseEnvelopeHandler = function(cb, name) {
    if (name == null) {
      name = void 0;
    }
    this.responseEnvelopeHandlers.push(cb);
    return this;
  };

  PokemonGoMITM.prototype.log = function(text) {
    if (this.debug) {
      return console.log(text);
    }
  };

  return PokemonGoMITM;

})();

module.exports = PokemonGoMITM;
