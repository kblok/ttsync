var Trello = require('trello');
var Q = require('q');
var _ = require('underscore');
var fs = require('fs');

_.mixin({deepExtend: require('underscore-deep-extend')(_)});

var Ttsync = function (options) {

	var defaultOptions = {
        trac : {
            server : '<TRAC_SERVER>',
            auth : {username:'<USER_ID>',password:'<PASSWORD>'},    

            openTicketsQuery: 'status!=closed'
        },
        trello : {
            key: "",
            secret: "",
            token: "",
            boardId: ''
        },
        ttconnector: './custom-field-connector',
        ttconnectorConfig : {
            customFieldId : 'trello_card_id'
        },

        mapping : {
            statusListMap : [
                { statusFromTrac: 'new', listFromTrello: 'To Do'},
                { statusFromTrac: 'to do', listFromTrello: 'To Do'},
                { statusFromTrac: 'in progress', listFromTrello: 'Doing'},
                { statusFromTrac: 'testing', listFromTrello: 'Testing'},
            ]
        }

    };

	if(!options) {
		options = defaultOptions;
	}
	else {
		//the default method is not deep so I have to default each sub-object
		options.trac = _.defaults(options.trac, defaultOptions.trac);
		options.trello = _.defaults(options.trello, defaultOptions.trello);

		options = _.defaults(options, defaultOptions);
	} 

    console.log(options);
    //Setup servers
    var tracServer = require('trac-jsonrpc-client');

    var tracClient = tracServer(options.trac.server, {
        auth: options.trac.auth
      });

    var trello = new Trello(options.trello.key, options.trello.token);

    var TrelloTracConnector = require(options.ttconnector);
    var ttConnector = new TrelloTracConnector(this, options.ttconnectorConfig);
    //end setup
    
    var currentTrelloCards = [];
    var currentTrelloLists = [];
    var currentTickets = [];

    this.getTracClient= function () {
        return tracClient;
    };

    var initTrello = function() {
        
        var cardsDeferred = Q.defer();
    	
        trello.getCardsOnBoard(options.trello.boardId, cardsDeferred.makeNodeResolver());

		return cardsDeferred.promise.then(function(cards) {
			
			currentTrelloCards = cards;
		   	})
			.then(function () {
				var listsDeferred = Q.defer();    
				trello.getListsOnBoard(options.trello.boardId, listsDeferred.makeNodeResolver());
				return listsDeferred.promise;
			})
			.then(function (lists) {
				
				currentTrelloLists = lists;
			})
			.fail(function(error){
				console.log('Could setup trello:', error);
			});

    };

    var buildTicketInstance = function (ticket) {
        if(ticket && ticket.length && ticket.length >= 3)
        {
            var ticketInstance = ticket[3];
            ticketInstance.id = ticket[0];
            return ticketInstance;
        }
    };

    var initTrac = function() {
    	var tracDeferred = Q.defer(),
    		ticketObjectBuildFunctionList = [],
    		ticketBuildPromise;

        tracClient.callRpc('ticket.query',[options.trac.openTicketsQuery], tracDeferred.makeNodeResolver());

        return tracDeferred.promise
        	.then(function (data){
            
				console.log("Open tickets", data.length);
				
				_.each(data, function (item) {
					ticketBuildPromise = Q.defer();
					tracClient.callRpc('ticket.get',[item], ticketBuildPromise.makeNodeResolver());

					ticketObjectBuildFunctionList.push(
						ticketBuildPromise.promise.then(function(ticket) {
							currentTickets.push(buildTicketInstance(ticket));
						}));
				});

				return Q.allSettled(ticketObjectBuildFunctionList);
			})
			.then(function(s){
				console.log("Tickets loaded");
			})
            .fail(function(error){
	        	console.log('Could setup trac:', error);
	        });
    };

    var getListIdFromTracStatus = function (status) {
         
        var map = _.find(options.mapping.statusListMap, function(map) {
            return map.statusFromTrac === status;
        });

        if(map) {
            var list = _.find(currentTrelloLists, function(list) {
                return list.name == map.listFromTrello;
            });
            if(list) {
                return list.id
            }
        }
    }
    var i = 0;
    var createMissingCards = function () {
        var promise;

        _.each(
            _.filter(currentTickets, function(ticket){
               return !ttConnector.getCardIdFromTicket(ticket.id);
            }), function (ticket) {

                if(!promise) {
                    cardCreationPromise = Q.defer();
                    trello.addCard(ticket.summary, ticket.description, getListIdFromTracStatus(ticket.status), cardCreationPromise.makeNodeResolver());

                    promise = cardCreationPromise.promise.then(function (card) {
                        return ttConnector.link(ticket, card);
                    });
                } else {
                    promise = promise.then(function(e) {
                        cardCreationPromise = Q.defer();
                        trello.addCard(ticket.summary, ticket.description, getListIdFromTracStatus(ticket.status), cardCreationPromise.makeNodeResolver());
                        return cardCreationPromise.promise.then(function (card) {
                            return ttConnector.link(ticket, card);
                        });
                    });    
                }
                
                
            });

        return promise;
        
    }

    this.init = function() {
        var aux = 0;

        initTrello()
        	.then(initTrac)
            .then(createMissingCards)
        	.then(function(){
                console.log("finished?");
            })
            .fail(function(err) {
              console.log("Error", err);  
            })
            //then(updateTrelloFromTrac());

    }

    function printTicket(ticket)
    {
        client.callRpc('ticket.get',[ticket],function(err, data, result){
        if(err){
          console.log(err);
        } else{
          console.log(data);

          
        }
        });
    }



/*
    var http = require('http');
    http.createServer(function (req, res) {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('hola\n');
      console.log(req.headers.host);
    }).listen(1337, 'EMMSANBOOK18');
    console.log('Server running at http://EMMSANBOOK18:1337/');
*/
    
};

var options = {};

if(fs.existsSync('./config.js')) {
	options = require('./config');
}

var ttsync = new Ttsync(options);
ttsync.init();

