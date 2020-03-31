# node-swc

Signalling with Channels

## Why

Loosely based on [node-dss](https://travis-ci.org/bengreenier/node-dss).

Think of this as a message broker service. It allows you to pass messages to a predetermined reciever. We use this as a lightweight replacement for a signalling server, where both clients have known identities. This saves us from the more complex logic of tracking live clients, and communicating peer 'join' and 'leave' events.

It also adds support for public and private prefixes. All prefixes can be posted to, and public prefixes can be gotten from, but private prefixes require a key to download from.


## How

> Note: To see logs, use the environment variable `DEBUG` with the `swc` namespace. IE: `set DEBUG=swc*`.

You'll need to install [nodejs](https://nodejs.org) to leverage this service.

First install dependencies with [npm](http://npmjs.com/) - from the project directory run: `npm install`. Then run the service with `npm start` from the project directory.

__Without the `DEBUG` environment variable set as-documented above, there will be no output from the process indicating a successful start.__

### Overview
GET /create/:channel?key=KEY

GET /remove/:channel?key=KEY

GET /create/:channel/public?key=KEY&prefix=PREFIX

GET /remove/:channel/public?key=KEY&prefix=PREFIX

GET /create/:channel/private?key=KEY&prefix=PREFIX

GET /remove/:channel/private?key=KEY&prefix=PREFIX

POST /channel/:channel/* (BODY:<data>)

GET /channel/:channel/PATH -> <data>

GET /channel/:channel/PATH?key=KEY -> <data>

GET /channel/:channel/?key=KEY&prefix=PREFIX -> <data>

### Setting Up Channels and Prefixes
NOTE: Prefixes use express-router logic, see: http://forbeslindesay.github.io/express-route-tester/

GET /create/:channel
    Creates a new channel with a user-specified channel key
    Example: GET /create/myChannel?key=1234

GET /remove/:channel
    Removes an existing channel
    Example: GET /remove/myChannel?key=1234

GET /create/:channel/public?prefix
    Creates a public prefix that anyone can retrieve messages from
    Example: GET /create/myChannel/public?key=1234&prefix=client/:fromClient/:toClient

GET /remove/:channel/public?prefix
    Removes a public prefix
    Example: GET /remove/myChannel/public?key=KEY&prefix=client/:fromClient/:toClient

GET /create/:channel/private?prefix
    Creates a private prefix that requires channel key to retreive messages from
    Example: GET /remove/myChannel/private?key=KEY&prefix=server/:clientId/*

GET /remove/:channel/private?prefix
    Removes a private prefix
    Example: GET /remove/myChannel/private?key=KEY&prefix=server/:clientId/*

GET /list/:channel/private?key=KEY -> <data>
    Lists all private messages currently for that channel

GET /list/:channel/public?key=KEY -> <data>
    Lists all public messages currently for that channel

### Posting Messages
POST /channel/:channel/* (BODY:<data>)
    Posts a message to the message queue of the prefix (regardless of if it's a public or private prefix)
    Example: POST /channel/myChannel/server/client1/new (BODY:client1 just joined)
    Example: POST /channel/myChannel/server/client2/new (BODY:client2 just joined)
    Example: POST /channel/myChannel/client/client1/client2 (BODY:message for client1 from client2)

### Retrieving Public Messages
GET /channel/:channel/<prefix> -> <data>
    Gets the next message if available. Returns 404 if doesn't exist/empty. Returns 403 if actually a private prefix
    Example: GET /myChannel/client/client1/client2
    ['Prefix'] = myChannel

### Retrieving Private Messages
GET /channel/:channel/PATH?key=KEY -> <data>
    Gets the next message if available for specific <prefix>. Returns 404 if doesn't exist/empty. Returns 403 if incorrect key
    Example: GET /myChannel/server/client1/new?key=1234
    ['Prefix'] = myChannel
    ['Channel'] = server/client1/new

GET /channel/:channel/?key=KEY&prefix=PREFIX -> <data>
    Gets the next message if available for generic path prefix.
    Returns 404 if doesn't exist/empty.
    Returns 403 if actually a private prefix
    Returns posting url in header 'Prefix'
    Example: GET /myChannel?key=1234&prefix=server/:clientId/*
    ['Prefix'] = myChannel
    ['Channel'] = server/client1/new

## License

MIT
