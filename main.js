var Trello = require('trello');
var Q = require('q');
var _ = require('underscore');
var fs = require('fs');
var restify = require('restify');

_.mixin({deepExtend: require('underscore-deep-extend')(_)});

var Ttsync = function (options) {

    var defaultOptions = {
        trac : {
            server : '<TRAC_SERVER>',
            auth : {username: '<USER_ID>', password: '<PASSWORD>'},
            openTicketsQuery: 'status!=closed'
        },
        trello : {
            key: '',
            secret: '',
            token: '',
            boardId: '',
            callbackUrl: '',
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

    if (!options) {
        options = defaultOptions;
    } else {
        //the default method is not deep so I have to default each sub-object
        options.trac = _.defaults(options.trac, defaultOptions.trac);
        options.trello = _.defaults(options.trello, defaultOptions.trello);

        options = _.defaults(options, defaultOptions);
    }

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

    this.getOptions = function () {
        return options;
    };

    this.getTickets = function () {
        return currentTickets;
    };

    this.getCards = function () {
        return currentTrelloCards;
    };

    this.getTracClient = function () {
        return tracClient;
    };

    var initTrello = function () {

        var cardsDeferred = Q.defer();

        trello.getCardsOnBoard(options.trello.boardId, cardsDeferred.makeNodeResolver());

        return cardsDeferred.promise.then(function (cards) {

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
            .fail(function (error) {
                console.log('Could setup trello:', error);
            });

    };

    var buildTicketInstance = function (ticket) {

        if (ticket && ticket.length && ticket.length >= 3) {
            var ticketInstance = ticket[3];
            ticketInstance.id = ticket[0];
            return ticketInstance;
        }
    };

    var initTrac = function () {
        var tracDeferred = Q.defer(),
            ticketObjectBuildFunctionList = [],
            ticketBuildPromise;

        tracClient.callRpc('ticket.query', [options.trac.openTicketsQuery], tracDeferred.makeNodeResolver());

        return tracDeferred.promise
            .then(function (data) {

                console.log("Open tickets", data.length);

                _.each(data, function (item) {
                    ticketBuildPromise = Q.defer();
                    tracClient.callRpc('ticket.get', [item], ticketBuildPromise.makeNodeResolver());

                    ticketObjectBuildFunctionList.push(
                        ticketBuildPromise.promise.then(function (ticket) {
                            currentTickets.push(buildTicketInstance(ticket));
                        }
                            )
                    );
                });

                return Q.allSettled(ticketObjectBuildFunctionList);
            })
            .then(function () {
                console.log("Tickets loaded");
            })
            .fail(function (error) {
                console.log('Could setup trac:', error);
            });
    };

    var getListIdFromTracStatus = function (status) {

        var map = _.find(options.mapping.statusListMap, function (map) {
            return map.statusFromTrac === status;
        });

        if (map) {
            var list = _.find(currentTrelloLists, function (list) {
                return list.name === map.listFromTrello;
            });
            if (list) {
                return list.id;
            }
        }
    };

    var createMissingCards = function () {
        var promise, cardCreationPromise, webHookCreationPromise;

        _.each(
            _.filter(currentTickets, function (ticket) {
                return !ttConnector.getCardFromTicket(ticket.id);
            }),
            function (ticket) {

                if (!promise) {
                    cardCreationPromise = Q.defer();
                    trello.addCard(ticket.summary, ticket.description, getListIdFromTracStatus(ticket.status), cardCreationPromise.makeNodeResolver());

                    promise = cardCreationPromise.promise.then(function (card) {
                        return ttConnector.link(ticket, card);
                    }).then(function (link) {
                        webHookCreationPromise = Q.defer();
                        trello.addWebHook("Ttsync hook", options.trello.callbackUrl, link.card.id, webHookCreationPromise.makeNodeResolver());
                        return webHookCreationPromise.promise;
                    }).then(function (e) {
                        console.log("hook result", e);
                    }
                        );
                } else {
                    promise = promise.then(function () {
                        cardCreationPromise = Q.defer();

                        trello.addCard(ticket.summary, ticket.description, getListIdFromTracStatus(ticket.status), cardCreationPromise.makeNodeResolver());
                        return cardCreationPromise.promise
                            .then(function (card) {
                                return ttConnector.link(ticket, card);
                            }).then(function (link) {
                                webHookCreationPromise = Q.defer();
                                trello.addWebHook("Ttsync hook", options.trello.callbackUrl, link.card.id, webHookCreationPromise.makeNodeResolver());
                                return webHookCreationPromise.promise;
                            });
                    });
                }
            }
        );

        return promise;

    };

    var removeUnlinkedCards = function () {
        var promise, cardRemovalPromise, unlinkedCards;

        unlinkedCards = _.filter(currentTrelloCards, function (card) {
            return !ttConnector.getTicketFromCard(card.id);
        });

        console.log("Unlinked cards:", unlinkedCards.length);

        _.each(unlinkedCards,
            function (card) {

                if (!promise) {
                    cardRemovalPromise = Q.defer();
                    trello.deleteCard(card.id, cardRemovalPromise.makeNodeResolver());
                    promise = cardRemovalPromise.promise;
                } else {
                    promise = promise.then(function () {
                        cardRemovalPromise = Q.defer();

                        trello.deleteCard(card.id, cardRemovalPromise.makeNodeResolver());
                        return cardRemovalPromise.promise;
                    });
                }
            });

        return promise;

    };

    var setupWebHookListener = function () {
        var server = restify.createServer();

        server.use(restify.bodyParser());

        server.post("/", function (req, res) {
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end('hola\n');
            console.log("called", req.params);
        });

        server.listen(1337, function () {
            console.log('Server running at http://EMMSANBOOK18:1337/');
        });
    };

    this.init = function () {

        setupWebHookListener();

        initTrello()
            .then(initTrac)
            .then(createMissingCards)
            .then(removeUnlinkedCards)
            .then(function () {
                console.log("finished");
            })
            .fail(function (err) {
                console.log("Error", err);
            });
            //then(updateTrelloFromTrac());

    };

};

var options = {};

if (fs.existsSync('./config.js')) {
    options = require('./config');
}

var ttsync = new Ttsync(options);
ttsync.init();

