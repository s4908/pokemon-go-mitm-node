###
  Pokemon Go(c) MITM node proxy
  by Michael Strassburger <codepoet@cpan.org>

  This example replaces all your pokemons with Mew, Mewto, Dragonite, ...

  Be aware: this is just visible to you and won't gain you any special powers
            all display pokemons will act as their original ones
###

PokemonGoMITM = require './lib/pokemon-go-mitm'

server = new PokemonGoMITM port: 8081
	.addResponseHandler "GetInventory", (data) ->
		
		count = 0
		console.log data
		if data.inventory_delta

			for item in data.inventory_delta.inventory_items
				console.log item
				if pokemon = item.inventory_item_data.pokemon_data
					pokemon.pokemon_id = 151 - count++
					pokemon.cp = 10000-count

					break if count is 151
		data
