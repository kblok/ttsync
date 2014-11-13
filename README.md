# TTSync :: Trac-Trello sync tool#

TTsync is an almost bidirectional sync tool between Trac and Trello.

## Data compatibility ##

Trello and Trac do not share the same concepts. This is how TTSync gets them closer:
 
Trac|Trelo
------------- | -------------
Project|Board
Ticket|Card
Status|List
Actions|Transtions between lists

From now on these words will be used without clarifying if the concept is from Trello or Trac.

## Syncing ##

**Ticket syncing<br/>**
It uses **Trac** as the master repository of tickets. It means that it will create cards for each ticket and it will delete cards if they are not related with any ticket.

**Status syncing<br/>**
Status syncing is bidirectional. If the status is changed the card will be moved to the right list. If the card is moved from one list to another it will execute the necessary actions in Trac in order to change the ticket to the corresponding status.

## Main Dependencies ##
* [trello](https://www.npmjs.org/package/trello): used to consume the Trello API
* [trac-jsonrpc-client](https://www.npmjs.org/package/trac-jsonrpc-client): used to consume the Trac API 

Temporarily it uses [another Trello module repository](https://github.com/kblok/trello "another repository") until [this pull request](https://github.com/GraemeF/trello/pull/9 "this pull request for the Trello module"), which upgrades [restler](https://www.npmjs.org/package/restler "restler"), is approved.

## Instalation ##
```
npm install ttsync
```

## Usage ##
```javascript
var Ttsync = require('ttsync');
var options = {
//some configuration (see: Configuration)
};

var ttsync = new Ttsync(options);
ttsync.init();
```

## Configuration ##
The options variable should have the needed data in order to set-up TTSync:

1. Trello API consumer
2. Trac API consumer
3. The Trac-Trello connector
4. The Mapping

### Trello configuration ###
The following data is needed to configure the Trello API consumer

1. **key and token**: go to the [Trello module help](https://github.com/GraemeF/trello "Trello module help") if you need more information about how to get this data. 
2. **boardId**: a board's URL has the boardId in it.
3. **callbackUrl**: an URL which TTSync will use to create [webhooks in Trello](https://trello.com/docs/gettingstarted/webhooks.html "webhooks in Trello").
4. **localCallbackUrlPort**: port number for the webhook listener.
 

```javascript
var option = {
        trello : {
            key: '',
            token: '',
            boardId: '',
            callbackUrl: '',
			localCallbackUrlPort: 1337
        }
};
```

### Trac configuration ###
The following data is needed to configure the Trac API consumer:

1. **server**: Trac server + project name + '/login/jsonrpc'. ie: 'http://trac/demo.project/login/jsonrpc'
2. **username** and **password**
3. **openTicketsQuery**: query sent to the Trac API. This will be the universe of tickets that will be sent to Trello.

```javascript
var option = {
        trac : {
            server : '<TRAC_SERVER>',
            auth : { username: '<USER_ID>', password: '<PASSWORD>' },
            openTicketsQuery: 'status!=closed'
        }
};
```

### Connector Configuration ###
The way that a ticket and a card are linked is not hardcoded in the code. The linking method can be modified or extended.

A ttconnector is a module which implements these methods:

 	- getTicket(ticketId)
    - getCard(cardId)
    - getCardIdFromTicket(ticketId)
    - getCardFromTicket(ticketId)
    - getTicketFromCard(cardId)
    - link(ticket, card)

And this data is needed to configure the connector: 

1. **ttconnector**: module path
2. **ttconnectorConfig**: configuration sent to the ttconnector to initialize it. 


```javascript
var option = {
		ttconnector: './custom-field-connector',
        ttconnectorConfig : {
            customFieldId : 'trello_card_id'
        }
};
```

### Mapping ###
Mapping is perhaps the most difficult section to configure and requires a deeper analysis.

It has three sections:

1. **userMap**: list of relations between a trelloUser and a tracUser
2. **statusListMap**: list of relations beetween statusFromTrac and listFromTrello
3. **actionsMap**: list that tells TTSync which actions have to be performed in Trac when a card changes from one list to another. Each item needs the following data:
	1. **fromList**: list's friendly name where the card was moved from
	2. **toList**: list's friendly name where the card was moved to
	3. **actions**: TTSync is prepared to perform more than one action if it is needed. Each action should have these properties:
		1. **name**: action name (you can find in the trac.ini)
		2. **operations**: list of fields that the action has to update, or that the operation to be executed requires as a mandatory update (ie: a change of owner). An operation can have these properties:
			1. **update**: field to update
			2. **setCurrentUser** (optional bool): it will set the current user
			3. **fieldValue** (optional): it will set the **update** field with the value of the **fieldValue** field
			4. **value** (optional): it will set the **update** field with its value 

```javascript
var option = {

        mapping : {
			userMap : [
                { trelloUser: '<TRELLO USER>', tracUser: '<TRAC USER>' }
            ],
            statusListMap : [
                { statusFromTrac: '<TRAC STATUS>', listFromTrello: '<TRELLO STATUS>' },
            ],
            actionsMap : [
                {
                    fromList: '<TRELLO LIST>',
                    toList : '<STATUS TRAC>',
                    actions: [
                        {
                            name: '<TRAC ACTION NAME>',
                            operations: [
                                { update: 'action_accept_reassign_owner', setCurrentUser: true },
                                { update: 'owner', setCurrentUser: true },
                            ]
                        }]
                },
            ]
        }
```

## How it works ##

```javascript
var Ttsync = require('ttsync');
var options = {
//some configuration (see: Configuration)
};

var ttsync = new Ttsync(options);
ttsync.init();
```

When the init method is called TTSync will execute all the tasks needed in order to get the Trello board in sync with the Trac project. After that, a server will be kept running and waiting for:

* POST requests from Trello (to the port configured) with any change in the cards.
* POST requests from Trac (to the port configured) but to the **trac** resource (ie: "http://localhost:1337/trac"). It will listen to any changes in tickets and will mirror them in Trello.

Trac is able to make post requests to TTSync installing a plugin

## Pendings features ##

- [ ] Publish the Trac plugin which makes a request whenever a ticket is changed.
- [ ] Implement verbosity.
