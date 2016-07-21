CA = require './lib/certificate-authority'
CA.generate (err, success) ->
	console.log "err: #{err} success: #{success}"