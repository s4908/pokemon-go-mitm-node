
/*
  Pokemon Go(c) MITM node proxy
  by Michael Strassburger <codepoet@cpan.org>

  This example replaces all your pokemons with Mew, Mewto, Dragonite, ...

  Be aware: this is just visible to you and won't gain you any special powers
            all display pokemons will act as their original ones
 */
var PokemonGoMITM, server;

PokemonGoMITM = require('./lib/pokemon-go-mitm');

server = new PokemonGoMITM({
  port: 8081
}).addResponseHandler("GetInventory", function(data) {
  var biggest, i, item, len, pokemon, ref;
  biggest = 151;
  if (data.inventory_delta) {
    ref = data.inventory_delta.inventory_items;
    for (i = 0, len = ref.length; i < len; i++) {
      item = ref[i];
      if (pokemon = item.inventory_item_data.pokemon_data) {
        pokemon.pokemon_id = biggest--;
        pokemon.cp = 1337;
        if (!biggest) {
          break;
        }
      }
    }
  }
  return data;
});
