var _ = require('underscore');
var Q = require('q');

var TrelloTracConnector = function (ttsync, options) {

    var tts = ttsync;

    this.getTicket = function (ticketId) {

        return _.find(tts.getTickets(), function (ticket) {
            return ticket.id === ticketId;
        });
    };

    this.getCardIdFromTicket = function (ticketId) {
        var ticket = this.getTicket(ticketId);

        if (ticket) {
            return ticket[tts.getOptions().ttconnectorConfig.customFieldId];
        }
    };

    this.getCardFromTicket = function (ticketId) {
        var cardId = this.getCardIdFromTicket(ticketId);

        if (cardId) {
            return _.find(tts.getCards(), function (card) {
                return card.id === cardId;
            });
        }
    };

    this.getTicketFromCard = function (cardId) {

        return _.find(tts.getTickets(), function (ticket) {
            return ticket[tts.getOptions().ttconnectorConfig.customFieldId] === cardId;
        });

    };

    this.link = function (ticket, card) {

        var tracDeferred = Q.defer();
        var data = [ticket.id, "Link with trello", {}];
        data[2][options.customFieldId] = card.id;

        tts.getTracClient().callRpc('ticket.update', data, function (error) {
            if (error) {
                tracDeferred.reject(error);
            } else {
                tracDeferred.resolve({ ticket: ticket, card: card});
            }
        });


        return tracDeferred.promise;
    };
};

module.exports = TrelloTracConnector;