
/*
  Pokemon Go(c) MITM node proxy
  by Michael Strassburger <codepoet@cpan.org>
  This example just dumps all in-/outgoing messages and responses
 */
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', function(req, res){
  res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', function(socket){
  socket.on('chat message', function(msg){
    io.emit('chat message', msg);
  });
});

http.listen(3003, function(){
  console.log('listening on *:3003');
});

var PokemonGoMITM, ignore, server,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

PokemonGoMITM = require('./lib/pokemon-go-mitm.js');

ignore = [];

server = new PokemonGoMITM({
  port: 8081
}).addRequestHandler("GetMapObjects", function(data, action) {
  if (indexOf.call(ignore, action) < 0) {
    //console.log("[<-] Request for " + action + " ", data, "\n");
  }
  return false;
}).addResponseHandler("GetMapObjects", function(data, action) {
  if (indexOf.call(ignore, action) < 0) {
    //console.log("[<-] Response for " + action + " ", data, "\n");
    data.map_cells.forEach(function(map_cell){
      io.emit('map_objects', map_cell);
    })
  }
  return false;
}).addResponseHandler("FortDetails", function(data) {
  data.name = "找活休息區";
  data.image_urls = ["https://scontent-tpe1-1.xx.fbcdn.net/v/t1.0-9/12798835_1264353660248662_4737120243500883139_n.jpg?oh=3101e41ee4f4840d78c775f790059d07&oe=57EB87A7"];
  return data;
});
