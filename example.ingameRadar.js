
/*
  Pokemon Go (c) ManInTheMiddle Radar "mod"
  Michael Strassburger <codepoet@cpan.org>

  Enriches every PokeStop description with information about
  - directions to nearby wild pokemons
  - time left if a PokeStop has an active lure
 */
var LatLon, PokemonGoMITM, changeCase, currentLocation, moment, pokemonInfo, pokemons, server;

PokemonGoMITM = require('./lib/pokemon-go-mitm');

changeCase = require('change-case');

moment = require('moment');

LatLon = require('geodesy').LatLonSpherical;

pokemons = [];

currentLocation = null;

server = new PokemonGoMITM({
  port: 8081
}).addRequestHandler("GetMapObjects", function(data) {
  currentLocation = new LatLon(data.latitude, data.longitude);
  console.log("[+] Current position of the player " + currentLocation);
  return false;
}).addResponseHandler("GetMapObjects", function(data) {
  var addPokemon, cell, i, j, len, len1, pokemon, ref, ref1, seen;
  pokemons = [];
  seen = {};
  addPokemon = function(pokemon) {
    var hash;
    if (seen[hash = pokemon.spawnpoint_id + ":" + pokemon.pokemon_data.pokemon_id]) {
      return;
    }
    if (pokemon.expiration_timestamp_ms < 0) {
      return;
    }
    seen[hash] = true;
    return pokemons.push({
      type: pokemon.pokemon_data.pokemon_id,
      latitude: pokemon.latitude,
      longitude: pokemon.longitude,
      expirationMs: pokemon.expiration_timestamp_ms,
      data: pokemon.pokemon_data
    });
  };
  ref = data.map_cells;
  for (i = 0, len = ref.length; i < len; i++) {
    cell = ref[i];
    ref1 = cell.wild_pokemons;
    for (j = 0, len1 = ref1.length; j < len1; j++) {
      pokemon = ref1[j];
      addPokemon(pokemon);
    }
  }
  return false;
}).addResponseHandler("FortDetails", function(data) {
  var i, info, len, modifier, pokemon, ref;
  console.log("fetched fort request", data);
  info = "";
  ref = data.modifiers;
  for (i = 0, len = ref.length; i < len; i++) {
    modifier = ref[i];
    if (modifier.item_id === 'ITEM_TROY_DISK') {
      info += "Lock expires " + moment(data.modifiers[0].expirationMs).toNow() + "\n";
    }
  }
  info += pokemons.length ? ((function() {
    var j, len1, results;
    results = [];
    for (j = 0, len1 = pokemons.length; j < len1; j++) {
      pokemon = pokemons[j];
      results.push(pokemonInfo(pokemon));
    }
    return results;
  })()).join("\n") : "No wild pokemons nearby... yet!";
  data.description = info;
  return data;
});

pokemonInfo = function(pokemon) {
  var bearing, direction, distance, name, position;
  console.log(pokemon);
  name = changeCase.titleCase(pokemon.data.pokemon_id);
  position = new LatLon(pokemon.latitude, pokemon.longitude);
  distance = Math.floor(currentLocation.distanceTo(position));
  bearing = currentLocation.bearingTo(position);
  direction = (function() {
    switch (true) {
      case bearing > 330:
        return "N";
      case bearing > 285:
        return "NW";
      case bearing > 240:
        return "W";
      case bearing > 195:
        return "SW";
      case bearing > 150:
        return "S";
      case bearing > 105:
        return "SE";
      case bearing > 60:
        return "E";
      case bearing > 15:
        return "NE";
      default:
        return "N";
    }
  })();
  return name + " in " + distance + "m -> " + direction;
};
