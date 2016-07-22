
/*
  Pokemon Go(c) MITM node proxy
  by Michael Strassburger <codepoet@cpan.org>

  This example intercetps the server answer after a successful throw and signals
  the App that the pokemon has fleed - cleaning up can be done at home :)

  Be aware: This triggers an error message in the App but won't interfere further on
 */
var PokemonGoMITM, server;

PokemonGoMITM = require('./lib/pokemon-go-mitm');

server = new PokemonGoMITM({
  port: 8081
}).addResponseHandler("CatchPokemon", function(data) {
  if (data.status === 'CATCH_SUCCESS') {
    data.status = 'CATCH_FLEE';
  }
  return data;
});
