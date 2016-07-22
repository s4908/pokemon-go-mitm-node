
/*
  Pokemon Go(c) MITM node proxy
  by Michael Strassburger <codepoet@cpan.org>

  Plays with your displayed level and XP

  Be aware: this is just visible to you and won't gain you any special powers
 */
var PokemonGoMITM, server;

PokemonGoMITM = require('./lib/pokemon-go-mitm');

server = new PokemonGoMITM({
  port: 8081
}).addResponseHandler("GetInventory", function(data) {
  var i, item, len, ref, stats;
  ref = data.inventory_delta.inventory_items;
  for (i = 0, len = ref.length; i < len; i++) {
    item = ref[i];
    if (stats = item.inventory_item_data.player_stats) {
      stats.level = 99;
      stats.experience = 1337;
    }
  }
  return data;
});
