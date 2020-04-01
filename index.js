const stream = require('stream')
const bodyParser = require('body-parser')
const morgan = require('morgan')
const debug = require('debug')('swc')
const express = require('express')
const querystring = require('querystring')
const ipaddr = require('ipaddr.js')

const app = express()
const router = express.Router()
router.__channels = {}
router.__state = {}

const morganDebugStream = new stream.Writable({
  write: function (chunk, encoding, done) {
    // strip newlines (to avoid extra empty log items in the 'tiny' morgan protocol)
    const chunkData = chunk.toString().replace(/[\n\r]/g, '')

    if (chunkData.length > 0) {
      debug(chunkData)
    }
    done()
  }
})

////////////////////////////////////////////////////////////////////////
// Functions
////////////////////////////////////////////////////////////////////////
const PRIVATE = 'private'
const PUBLIC = 'public'
const requiresKey = (category) => category == PRIVATE
const getRoutePath = (channelId, prefix) => '/channel/' + channelId + '/' + prefix
const parseQuery = (req) => querystring.parse(req._parsedUrl.query)
const pathToPrefixRegex = /^\/channel\/[^\/]+\/(.*)\/?$/i

function getRequestIp(request) {
  if (!request || !request.connection || !request.connection.remoteAddress) {
    return "";
  }

  const remoteIp = request.connection.remoteAddress;
  if (ipaddr.IPv4.isValid(remoteIp)) {
    return remoteIp;
  } 
  
  if (!ipaddr.IPv6.isValid(remoteIp)) {
    return "";
  }
    
  const ip = ipaddr.IPv6.parse(remoteIp);
  if (ip.isIPv4MappedAddress()) {
      return ip.toIPv4Address().toString();
  }
  
  return ip.toString();
}

function complete(req, res, state, data) {
    if (state.valid) {
      res.setHeader('channel', state.args.channelId)


      if (state.path) {
        res.setHeader('prefix', state.path)
      }

      if (state.message) {
        res.setHeader('request-ip', state.message.requestIp)
        res.setHeader('params', JSON.stringify(state.message.params))
      } else {
        res.setHeader('params', JSON.stringify(req.params))
      }
    }

    res.statusCode = state.statusCode
    res.end(data)
}

function validateState(req, channelId, key, prefix, category) {
  const args = {channelId, key, prefix, category}
  let state = {valid: true, statusCode: 200, args}

  state.channel = router.__channels[channelId]
  if (!state.channel) {
    return {valid: false, statusCode: 404}
  }

  if (key !== null && state.channel.key != key) {
    return {valid: false, statusCode: 403}
  }
  
  if (category !== null) {
    state.prefixes = state.channel[category]
    if (!state.prefixes) {
      return {valid: false, statusCode: 404}
    }

    if (prefix) {
      state.messageQueue = state.prefixes[prefix]
      if (!state.messageQueue) {
        return {valid: false, statusCode: 404}
      }
    }
  }

  if (prefix) {
    const path = req._parsedUrl.pathname
    const match = path.match(pathToPrefixRegex)
    if (match) {
      state.path = match[1]
    }
  }

  return state
}

function createChannel(req, res) {
  const channelId = req.params.channel
  const query = parseQuery(req)
  const key = query.key

  const state = validateState(req, channelId, key, null, null)
  if (state.statusCode == 404) {   
    let channel = {key}
    channel[PRIVATE] = {}
    channel[PUBLIC] = {}
    router.__channels[channelId] = channel
    state.statusCode = 200
  }
  
  complete(req, res, state)
}

function removeChannel(req, res) {
  const channelId = req.params.channel
  const query = parseQuery(req)
  const key = query.key

  const state = validateState(req, channelId, key, null, null)
  if (state.valid) {   
    removeRoutes(channelId, state.channel[PRIVATE])
    removeRoutes(channelId, state.channel[PUBLIC])
    delete router.__channels[channelId]
  }
  
  complete(req, res, state)
}

function createPrefix(req, res, category) {
  const channelId = req.params.channel
  const query = parseQuery(req)
  const key = query.key
  const prefix = query.prefix

  const state = validateState(req, channelId, key, null, category)
  if (state.valid) {
    state.prefixes[prefix] = []
    addRoute(channelId, prefix, category)
  }
  
  complete(req, res, state)
}

function removePrefix(req, res, category) {
  const channelId = req.params.channel
  const query = parseQuery(req)
  const key = query.key
  const prefix = query.prefix

  const state = validateState(req, channelId, key, prefix, category)
  if (state.valid) {   
    removeRoute(channelId, prefix, category)
    delete state.prefixes[prefix]
  }
  
  complete(req, res, state)
}

function postMessage(req, res, channelId, prefix, category) {
  const state = validateState(req, channelId, null, prefix, category)
  if (state.valid) {   
    state.messageQueue.push({
      path: state.path,
      contentType: req.headers['content-type'],
      body: req.body,
      requestIp: getRequestIp(req),
      params: req.params
    })
  }

  complete(req, res, state)
}

function getMessage(req, res, channelId, prefix, category) {
  const query = parseQuery(req)
  const key = requiresKey(category) ? (query.key || "") : null
  prefix = query.prefix || prefix

  const state = validateState(req, channelId, key, prefix, category)
  if (!state.valid) {
    complete(req, res, state)
    return
  }

  const data = state.messageQueue.shift()
  if (data === undefined) {
    state.statusCode = 404
    complete(req, res, state)
    return
  }

  state.path = data.path
  state.message = data
  complete(req, res, state, data.body)
}

function addRoute(channelId, prefix, category) {
  removeRoute(channelId, prefix, category)

  const path = getRoutePath(channelId, prefix)
  router.get(path, (req, res) => getMessage(req, res, channelId, prefix, category))
  router.post(path, (req, res) => postMessage(req, res, channelId, prefix, category))
}

function removeRoute(channelId, prefix, category) {
  const path = getRoutePath(channelId, prefix)

  for (var i = router.stack.length - 1; i >= 0; --i) {
    const layer = router.stack[i]
    if (layer.route && layer.route.path == path) {
      router.stack.splice(i, 1)
    }
  }

  delete router.__state[path]
}

function removeRoutes(channelId, prefixes) {
  for (const prefix in Object.keys(prefixes)) {
    removeRoute(channelId, prefix, true)
  }
}

function parseBody(body, contentType) {
  if (!(body instanceof Buffer)) {
    throw "Unknown body type"
  }
  
  if (contentType == "application/json") {
    return JSON.parse(body.toString())
  } else if (contentType.match(/^text\/.*$/i)) {
    return body.toString()
  } else {
    return body
  }
}


function listMessages(req, res, category) {
  const channelId = req.params.channel
  const query = parseQuery(req)
  const key = query.key || ""

  const state = validateState(req, channelId, key, null, category)
  if (!state.valid) {
    complete(req, res, state)
    return
  }

  let set = {}
  for (const key in state.prefixes) {
    let list = []
    state.prefixes[key].forEach(message => {
      const msg = {
        path: message.path,
        contentType: message.contentType,
        body: parseBody(message.body, message.contentType),
        requestIp: message.requestIp,
        params: message.params
      }
      list.push(msg)
    })
    set[key] = list
  }

  const data = JSON.stringify(set, null, '\t')
  complete(req, res, state, data)
}


////////////////////////////////////////////////////////////////////////
// Host Setup
////////////////////////////////////////////////////////////////////////
router.use(morgan('tiny', { stream: morganDebugStream }))
router.use(bodyParser.raw({ limit: '10mb', type: () => true }))

router.get('/', (req, res) => {
  res.statusCode = 200
  res.end(`
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

    GET /list/:channel/private?key=KEY -> <data>
    GET /list/:channel/public?key=KEY -> <data>

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

    GET /list/:channel/private?key=KEY&content=[0,1] -> <data>
      Lists all private messages currently on 
    GET /list/:channel/public?key=KEY -> <data>
  
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
  `)
})

router.get('/create/:channel', createChannel)
router.get('/remove/:channel', removeChannel)
router.get('/create/:channel/private', (req, res) => createPrefix(req, res, PRIVATE))
router.get('/remove/:channel/private', (req, res) => removePrefix(req, res, PRIVATE))
router.get('/create/:channel/public', (req, res) => createPrefix(req, res, PUBLIC))
router.get('/remove/:channel/public', (req, res) => removePrefix(req, res, PUBLIC))
router.get('/channel/:channel/', (req, res) => getMessage(req, res, req.params.channel, "", PRIVATE))
router.get('/list/:channel/private', (req, res) => listMessages(req, res, PRIVATE))
router.get('/list/:channel/public', (req, res) => listMessages(req, res, PUBLIC))

module.exports = router
