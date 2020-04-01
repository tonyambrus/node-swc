const http = require('http')
const assert = require('assert')
const finalhandler = require('finalhandler')
const request = require('supertest')
const router = require('../index')

const allocServer = () => {
  return http.createServer(function (req, res) {
    router(req, res, finalhandler(req, res))
  })
}

/* eslint-env node, mocha */
describe('node-swc', () => {

  ///////////////////////////////////////////////////////////////////////////////
  describe('create channel', () => {
    const agent = request.agent(allocServer())

    it('200 create channel', (done) => {
      agent
        .get('/create/test?key=1234')
        .expect(200, done)
    })

    it('403 recreate existing channel without key', (done) => {
      agent
        .get('/create/test?key=2345')
        .expect(403, done)
    })

    it('200 recreate existing channel with key', (done) => {
      agent
        .get('/create/test?key=1234')
        .expect(200, done)
    })
    
    it('200 remove existing channel with key', (done) => {
      agent
        .get('/remove/test?key=1234')
        .expect(200, done)
    })
    
    it('404 remove non-existant channel with key', (done) => {
      agent
        .get('/remove/test?key=1234')
        .expect(404, done)
    })
  })

  ///////////////////////////////////////////////////////////////////////////////
  describe('create public prefix', () => {  
    const agent = request.agent(allocServer())

    it('200 create channel', (done) => {
      agent
        .get('/create/test?key=1234')
        .expect(200, done)
    })

    it('200 create public prefix', (done) => {
      agent
        .get('/create/test/public?key=1234&prefix=data/:clientId')
        .expect(200, done)
    })

    it('403 remove public prefix with wrong key', (done) => {
      agent
        .get('/remove/test/public?key=0000&prefix=data/:clientId')
        .expect(403, done)
    })

    it('200 remove public prefix', (done) => {
      agent
        .get('/remove/test/public?key=1234&prefix=data/:clientId')
        .expect(200, done)
    })

    it('404 remove non-existant public prefix', (done) => {
      agent
        .get('/remove/test/public?key=1234&prefix=data/:clientId')
        .expect(404, done)
    })
  })   

  ///////////////////////////////////////////////////////////////////////////////
  describe('create private prefix', () => {  
    const agent = request.agent(allocServer())

    it('200 create channel', (done) => {
      agent
        .get('/create/test?key=1234')
        .expect(200, done)
    })

    it('200 create private prefix', (done) => {
      agent
        .get('/create/test/private?key=1234&prefix=data/:hostId')
        .expect(200, done)
    })

    it('403 remove private prefix with wrong key', (done) => {
      agent
        .get('/remove/test/private?key=0000&prefix=data/:hostId')
        .expect(403, done)
    })

    it('200 remove private prefix', (done) => {
      agent
        .get('/remove/test/private?key=1234&prefix=data/:hostId')
        .expect(200, done)
    })

    it('404 remove non-existent private prefix', (done) => {
      agent
        .get('/remove/test/private?key=1234&prefix=data/:hostId')
        .expect(404, done)
    })
  })

  ///////////////////////////////////////////////////////////////////////////////
  describe('post to public prefix', () => {
    const agent = request.agent(allocServer())

    it('200 create channel', (done) => {
      agent
        .get('/create/test?key=1234')
        .expect(200, done)
    })

    it('200 create public prefix', (done) => {
      agent
        .get('/create/test/public?key=1234&prefix=data/:clientId')
        .expect(200, done)
    })
  
    it('404 GET from testclient with no content', (done) => {
      agent
        .get('/channel/test/data/testclient')
        .expect(404, done) 
    })

    it('200 POST (x1) to testclient', (done) => {
      agent
        .post('/channel/test/data/testclient')
        .send({test: 'post1'})
        .expect(200, done)
    })

    it('200 POST (x2) to testclient', (done) => {
      agent
        .post('/channel/test/data/testclient')
        .send({test: 'post2'})
        .expect(200, done)
    })

    it('200 GET (x1) from testclient', (done) => {
      agent
        .get('/channel/test/data/testclient')
        .expect(200)
        .expect('request-ip', '127.0.0.1')
        .then((response) => {
          assert.deepStrictEqual(JSON.parse(response.headers['params']), { clientId: 'testclient' });
          assert.deepStrictEqual(JSON.parse(response.text), { test: 'post1' });
        })
        .then(done, done)  
    })

    it('200 GET (x2) from testclient', (done) => {
      agent
        .get('/channel/test/data/testclient')
        .expect(200)
        .expect('request-ip', '127.0.0.1')
        .then((response) => {
          assert.deepStrictEqual(JSON.parse(response.headers['params']), { clientId: 'testclient' });
          assert.deepStrictEqual(JSON.parse(response.text), { test: 'post2' });
        })
        .then(done, done)  
    })

    it('404 GET (x3) from testclient with no content', (done) => {
      agent
        .get('/channel/test/data/testclient')
        .expect(404, done)
    })

    it('200 POST (x3) to testclient', (done) => {
      agent
        .post('/channel/test/data/testclient')
        .send({test: 'post3'})
        .expect(200, done)
    })

    it('200 remove public prefix', (done) => {
      agent
        .get('/remove/test/public?key=1234&prefix=data/:clientId')
        .expect(200, done)
    })  

    it('404 GET (x3) from testclient with no content', (done) => {
      agent
        .get('/channel/test/data/testclient')
        .expect(404, done)
    })
  })  
    
  ///////////////////////////////////////////////////////////////////////////////
  describe('post to private prefix with fixed route', () => {
    const agent = request.agent(allocServer())

    it('200 create channel', (done) => {
      agent
        .get('/create/test?key=1234')
        .expect(200, done)
    })

    it('200 create private prefix', (done) => {
      agent
        .get('/create/test/private?key=1234&prefix=data/:hostId')
        .expect(200, done)
    })
  
    it('404 GET from testhost with no content', (done) => {
      agent
        .get('/channel/test/data/testhost?key=1234')
        .expect(404, done) 
    })

    it('200 POST (x1) to testhost', (done) => {
      agent
        .post('/channel/test/data/testhost')
        .send({test: 'post1'})
        .expect(200, done)
    })

    it('200 POST (x2) to testhost', (done) => {
      agent
        .post('/channel/test/data/testhost')
        .send({test: 'post2'})
        .expect(200, done)
    })

    it('403 GET (x1) from testhost with no key', (done) => {
      agent
        .get('/channel/test/data/testhost')
        .expect(403, done) 
    })  

    it('200 GET (x1) from testhost with key', (done) => {
      agent
        .get('/channel/test/data/testhost?key=1234')
        .expect(200)
        .expect('request-ip', '127.0.0.1')
        .expect('Channel', 'test')
        .then((response) => assert.deepStrictEqual(JSON.parse(response.text), { test: 'post1' }))
        .then(done, done)  
    })

    it('200 GET (x2) from testhost', (done) => {
      agent
        .get('/channel/test/data/testhost?key=1234')
        .expect(200)
        .expect('request-ip', '127.0.0.1')
        .expect('Channel', 'test')
        .then((response) => assert.deepStrictEqual(JSON.parse(response.text), { test: 'post2' }))
        .then(done, done)  
    })

    it('404 GET (x3) from testhost with no content', (done) => {
      agent
        .get('/channel/test/data/testhost?key=1234')
        .expect(404, done)
    })

    it('200 POST (x3) to testhost', (done) => {
      agent
        .post('/channel/test/data/testhost')
        .send({test: 'post3'})
        .expect(200, done)
    })

    it('200 remove private prefix', (done) => {
      agent
        .get('/remove/test/private?key=1234&prefix=data/:hostId')
        .expect(200, done)
    })  

    it('404 GET (x3) from testhost with no content', (done) => {
      agent
        .get('/channel/test/data/testhost?key=1234')
        .expect(404, done)
    })
  })
      
  ///////////////////////////////////////////////////////////////////////////////
  describe('post to private prefix with variable route', () => {
    const agent = request.agent(allocServer())

    it('200 create channel', (done) => {
      agent
        .get('/create/test?key=1234')
        .expect(200, done)
    })

    it('200 create private prefix with data/* route', (done) => {
      agent
        .get('/create/test/private?key=1234&prefix=data/*')
        .expect(200, done)
    })
  
    it('404 GET with no content', (done) => {
      agent
        .get('/channel/test/data?key=1234')
        .expect(404, done) 
    })

    it('200 POST (x1) to data/variable/path/1', (done) => {
      agent
        .post('/channel/test/data/variable/path/1')
        .send({test: 'post1'})
        .expect(200, done)
        .expect('Channel', 'test')
    })

    it('200 POST (x2) to data/path/for/post/2', (done) => {
      agent
        .post('/channel/test/data/path/for/post/2')
        .send({test: 'post2'})
        .expect(200, done)
    })

    it('200 POST (x3) to data/post3/path', (done) => {
      agent
        .post('/channel/test/data/post3/path')
        .send({test: 'post3'})
        .expect(200, done)
    })

    it('403 GET (x1) from ?prefix=data/* with no key', (done) => {
      agent
        .get('/channel/test/?prefix=data/*')
        .expect(403, done) 
    })  

    it('200 GET (x1) from data/variable/path/1 with key', (done) => {
      agent
        .get('/channel/test/data/variable/path/1?key=1234')
        .expect(200)
        .expect('request-ip', '127.0.0.1')
        .expect('Channel', 'test')
        .expect('Prefix', 'data/variable/path/1')
        .then((response) => {
          assert.deepStrictEqual(JSON.parse(response.headers['params']), { '0': 'variable/path/1' });
          assert.deepStrictEqual(JSON.parse(response.text), { test: 'post1' });
        })
        .then(done, done)  
    })

    it('200 GET (x2) from ?prefix=data/* with key', (done) => {
      agent
        .get('/channel/test?key=1234&prefix=data/*')
        .expect(200)
        .expect('request-ip', '127.0.0.1')
        .expect('Channel', 'test')
        .expect('Prefix', 'data/path/for/post/2')
        .then((response) => {
          assert.deepStrictEqual(JSON.parse(response.headers['params']), { channel: 'test' });
          assert.deepStrictEqual(JSON.parse(response.text), { test: 'post2' });
        })
        .then(done, done)  
    })

    it('200 GET (x3) from ?prefix=data/* with key', (done) => {
      agent
        .get('/channel/test?key=1234&prefix=data/*')
        .expect(200)
        .expect('request-ip', '127.0.0.1')
        .expect('Channel', 'test')
        .expect('Prefix', 'data/post3/path')
        .then((response) => {
          assert.deepStrictEqual(JSON.parse(response.headers['params']), { channel: 'test' });
          assert.deepStrictEqual(JSON.parse(response.text), { test: 'post3' });
        })
        .then(done, done)  
    })

    it('404 GET (x3) from testhost with no content', (done) => {
      agent
        .get('/channel/test?key=1234&prefix=data/*')
        .expect(404, done)
    })

    it('200 POST (x4) to testhost', (done) => {
      agent
        .post('/channel/test/data/never/gets/read')
        .send({test: 'post3'})
        .expect(200, done)
    })

    it('200 remove private prefix', (done) => {
      agent
        .get('/remove/test/private?key=1234&prefix=data/*')
        .expect(200, done)
    })  

    it('404 GET (x3) from testhost with no content', (done) => {
      agent
        .get('/channel/test/data?key=1234')
        .expect(404, done)
    })
  })  

      
  ///////////////////////////////////////////////////////////////////////////////
  describe('list private prefix messages', () => {
    const agent = request.agent(allocServer())

    it('200 create channel', (done) => {
      agent
        .get('/create/test?key=1234')
        .expect(200, done)
    })

    it('200 create private prefix with data/* route', (done) => {
      agent
        .get('/create/test/private?key=1234&prefix=data/*')
        .expect(200, done)
    })
  
    it('200 POST (x1) to data/variable/path/1', (done) => {
      agent
        .post('/channel/test/data/variable/path/1')
        .send({test: 'post1'})
        .expect(200, done)
        .expect('Channel', 'test')
    })

    it('200 POST (x2) to data/path/for/post/2', (done) => {
      agent
        .post('/channel/test/data/path/for/post/2')
        .send({test: 'post2'})
        .expect(200, done)
    })

    it('200 POST (x3) to data/post3/path', (done) => {
      agent
        .post('/channel/test/data/post3/path')
        .send({test: 'post3'})
        .expect(200, done)
    })

    it('200 GET (x2) list private messages with key', (done) => {
      agent
        .get('/list/test/private?key=1234')
        .expect(200)
        .then((response) => assert.deepStrictEqual(
          JSON.parse(response.text), 
          {"data/*":[
            {"path":"data/variable/path/1","contentType":"application/json","body":{"test":"post1"},"requestIp":"127.0.0.1"},
            {"path":"data/path/for/post/2","contentType":"application/json","body":{"test":"post2"},"requestIp":"127.0.0.1"},
            {"path":"data/post3/path","contentType":"application/json","body":{"test":"post3"},"requestIp":"127.0.0.1"}
          ]}))
        .then(done, done)  
    })
  })    
})