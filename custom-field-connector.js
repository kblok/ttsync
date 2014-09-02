var _ = require('underscore');
var Q = require('q');

var TrelloTracConnector = function(ttsync, options) {
	
	var tts = ttsync;

	this.getTicket = function (ticketId){
		return _.find(tts.currentTickets, function(ticket) {
			return ticket.id = ticketId;
		});
	};

	this.getCardIdFromTicket = function (ticketId) {
		var ticket = this.getTicket(ticketId);

		if(ticket){
			return ticket[tts.options.ttconnectorConfig.customFieldId];
		}
	}

	this.link = function(ticket, card) {
		var tracDeferred = Q.defer();
    	var data = [ticket.id, "Link with trello", {}];
        data[2][options.customFieldId] = card.id;

        tts.getTracClient().callRpc('ticket.update',data, tracDeferred.makeNodeResolver());


        return tracDeferred.promise.then(function (){
        		console.log("supuestamente modifique el ticket", ticket.id);
        	})
        	.catch(function (err) {
        		console.log("Error",err);
        	});
	}
};

module.exports = TrelloTracConnector;