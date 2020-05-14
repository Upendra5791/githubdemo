const express = require('express'),
app = express()

app.use(express.json())
app.use(express.urlencoded())
app.use(express.static('static'))
app.set('view engine', 'ejs')
app.set('views','static/views')
  
var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0'

/* Twitter Client Code STARTS */

const Twitter = require('twitter-lite')
const user = new Twitter({
    consumer_key: "QOJAa3oEXmbx4xaPxtbegFRME",
    consumer_secret: "g4cMg5JcU5bTh9WAzZCRlcVfHhZUc7BBqVGFvNmuph0J4ih62M",
});

let client;
(async () => {
    try {
        const response = await user.getBearerToken()
        console.log(`Got the following Bearer token from Twitter: ${response.access_token}`);
        client = new Twitter({
            bearer_token: response.access_token,
        });
    }catch(e) {
        console.log('Error loading bearer token from Twitter')
        console.log(e)
    }
})()

/* Twitter Client Code END */


/* Mongo DB Code STARTS */
var mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";

if (mongoURL == null) {
  var mongoHost, mongoPort, mongoDatabase, mongoPassword, mongoUser;
  // If using plane old env vars via service discovery
  if (process.env.DATABASE_SERVICE_NAME) {
    var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase();
    mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'];
    mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'];
    mongoDatabase = process.env[mongoServiceName + '_DATABASE'];
    mongoPassword = process.env[mongoServiceName + '_PASSWORD'];
    mongoUser = process.env[mongoServiceName + '_USER'];

  // If using env vars from secret from service binding  
  } else if (process.env.database_name) {
    mongoDatabase = process.env.database_name;
    mongoPassword = process.env.password;
    mongoUser = process.env.username;
    var mongoUriParts = process.env.uri && process.env.uri.split("//");
    if (mongoUriParts.length == 2) {
      mongoUriParts = mongoUriParts[1].split(":");
      if (mongoUriParts && mongoUriParts.length == 2) {
        mongoHost = mongoUriParts[0];
        mongoPort = mongoUriParts[1];
      }
    }
  }

  if (mongoHost && mongoPort && mongoDatabase) {
    mongoURLLabel = mongoURL = 'mongodb://';
    if (mongoUser && mongoPassword) {
      mongoURL += mongoUser + ':' + mongoPassword + '@';
    }
    // Provide UI label that excludes user id and pw
    mongoURLLabel += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
    mongoURL += mongoHost + ':' +  mongoPort + '/' + mongoDatabase;
  }
}
var db = null,
    dbDetails = new Object();

var initDb = function(callback) {
  if (mongoURL == null) return;

  var mongodb = require('mongodb');
  if (mongodb == null) return;

  mongodb.connect(mongoURL, function(err, conn) {
    if (err) {
      callback(err);
      return;
    }

    db = conn;
    dbDetails.databaseName = db.databaseName;
    dbDetails.url = mongoURLLabel;
    dbDetails.type = 'MongoDB';

    console.log('Connected to MongoDB at: %s', mongoURL);
  });
};

/* Mongo DB Code END */

app.get('/', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    var col = db.collection('counts');
    // Create a document with request IP and current time of request
    col.insert({ip: req.ip, date: Date.now()});
    col.count(function(err, count){
      if (err) {
        console.log('Error running count. Message:\n'+err);
      }
      res.render('index', { pageCountMessage : count, dbInfo: dbDetails });
    });
  } else {
    res.render('index', { pageCountMessage : null});
  }
});

app.get('/pagecount', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    db.collection('counts').count(function(err, count ){
      res.send('{ pageCount: ' + count + '}');
    });
  } else {
    res.send('{ pageCount: -1 }');
  }
});


app.get('/tweet-list', (req, res, next) => {
  console.log(req.query)
  if (req.query.term === '') {
      res.status(500).render('tweet-list', {
          error: true,
          msg: 'Enter a valid search term'
      })
  } else {
      try {
          client.get(`/search/tweets`, {
              q: req.query.term, 
              lang: "en",
              count: 20,
          })
          .then(resp => {
              res.render('tweet-list', {
                  error: false,
                  tweets: resp.statuses
              })
          })
          .catch(e => {
              res.status(500).render('tweet-list', {
                  'msg': 'Oops! Something went wrong. Try after sometime ;) ',
                  'error': true,
                  'tweets': null
              })
          })
      } catch(e) {
          res.status(500).render('tweet-list', {
              'msg': 'Oops! Something went wrong. Try after sometime ;)',
              'error': true,
              'tweets': null
          })
      }

  }
})

/* API section STARTS */
app.get('/api/getTweets', (req, res, next) => {
  if (!req.query.term) {
      res.status(404).json({
          msg: `'term' parameter missing! Provide a valid search term.`
      })
  } else {
      client.get(`/search/tweets`, {
          q: req.query.term,
          lang: "en",
          count: 10,
      })
      .then(resp => {
          res.json({
              'message': 'Tweets fetched successfully',
              'tweets': resp,
          })
      })
      .catch(e => {
          res.status(500).json({
              'message': 'Failed fetching tweets',
              'error': e
          })
      })
  }
})

/* API section END */


// error handling
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500).send('Something bad happened!');
});

initDb(function(err){
  console.log('Error connecting to Mongo. Message:\n'+err);
});

app.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);

module.exports = app ;
