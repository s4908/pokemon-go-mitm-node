###
  Pokemon Go(c) MITM node proxy
  by Michael Strassburger <codepoet@cpan.org>

  Directly release any catched Pokemon if you have the same with higher kp

  Be aware: this is just visible to you and won't gain you any special powers
            all display pokemons will act as their original ones
###

PokemonGoMITM = require './lib/pokemon-go-mitm'

highest = {}
updated = null

server = new PokemonGoMITM port: 8081, debug: true

server.addResponseHandler "GetInventory", (data) ->
	releasedOne = false

	if updated is data.inventory_delta.new_timestamp_ms
		return false
	updated = data.inventory_delta.new_timestamp_ms

	for item in data.inventory_delta.inventory_items
		continue unless pokemon = item.inventory_item_data.pokemon_data
		continue unless pokemon.pokemon_id

		if highest[pokemon.pokemon_id] and highest[pokemon.pokemon_id].id isnt pokemon.id
			old = highest[pokemon.pokemon_id]
			releaseId = if pokemon.cp > old.cp
				console.log "[+] Releasing old #{pokemon.pokemon_id} CP#{old.cp} for caught one with CP#{pokemon.cp}"
				highest[pokemon.pokemon_id] = pokemon
				old.id
			else
				console.log "[+] Releasing new #{pokemon.pokemon_id} CP#{pokemon.cp} as you have one with #{old.cp}"
				pokemon.id

			continue if releasedOne

			server.injectMessage "ReleasePokemon", pokemon_id: releaseId
			releasedOne = true

		else
			console.log "[+] Keeping new #{pokemon.pokemon_id} CP#{pokemon.cp}"
			highest[pokemon.pokemon_id] = pokemon
	false

server.addResponseHandler "ReleasePokemon", (data) ->
	console.log data