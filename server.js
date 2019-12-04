const path = require('path');

var port = process.env.PORT || 8000;
var MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;
var url = "mongodb://localhost:27017/";

var waitingRequests = [];
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));

app.listen(port);

function respond(response, status, data, type) {
    response.writeHead(status, {
        "Content-Type": type || "text/plain"
    });
    response.end(data);
}

function respondJSON(response, status, data) {
    respond(response, status, JSON.stringify(data),
        "application/json");
}

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname + '/public/index.html'));
});

app.get('/admin', function (req, res) {
    res.sendFile(path.join(__dirname + '/public/admin.html'));
});

app.post('/post', function (req, res) {
    var post_title = req.body.post.title;
    var post_description = req.body.post.description;
    MongoClient.connect(url, function (err, db) {
        if (err) throw err;
        var dbo = db.db("mydb");
        var myobj = {title: post_title, description: post_description, likes: 0};
        dbo.collection("posts").insertOne(myobj, function (err, res) {
            if (err) throw err;
            console.log("1 document inserted");
            db.close();
            sendChanges();
        });
    });
    respondJSON(res, 200);
});

app.get('/post', function (req, res) {
    MongoClient.connect(url, function (err, db) {
        if (err) throw err;
        var dbo = db.db("mydb");
        dbo.collection("posts").find({}).toArray(function (err, result) {
            if (err) throw err;
            respondJSON(res, 200, result);
            db.close();
        });
    });
});

app.get('/post/:post_id', function (req, res) {
    MongoClient.connect(url, function (err, db) {
        var post_id = req.params.post_id;
        if (err) throw err;
        var dbo = db.db("mydb");
        dbo.collection("posts").findOne({_id: ObjectId(post_id)}, function (err, result) {
            if (err) throw err;
            respondJSON(res, 200, result);
            db.close();
        });
    });
});

app.get('/like/:post_id', function (req, res) {
    MongoClient.connect(url, function (err, db) {
        var post_id = req.params.post_id;
        if (err) throw err;
        var dbo = db.db("mydb");
        var myquery = {_id: ObjectId(post_id)};
        var newvalues = {$inc: {likes: 1}};
        dbo.collection("posts").updateOne(myquery, newvalues, function (err, result) {
            if (err) throw err;
            db.close();
            sendChanges();
        });
    });
    respondJSON(res, 200);
});

app.put('/post', function (req, res) {
    MongoClient.connect(url, function (err, db) {
        if (err) throw err;
        var dbo = db.db("mydb");
        var myquery = {_id: ObjectId(req.body.post.post_id)};
        var newvalues = {$set: {title: req.body.post.title, description: req.body.post.description}};
        console.log(newvalues);
        dbo.collection("posts").updateOne(myquery, newvalues, function (err, res) {
            if (err) throw err;
            console.log("1 document updated");
            db.close();
            sendChanges();
        });
        respondJSON(res, 200);
    });
});

app.get('/changes', function (req, res) {
    console.log("In Here!");
    return waitForChanges(res);
});

function waitForChanges(response) {
    var waiter = {response: response};
    waitingRequests.push(waiter);
    setTimeout(function () {
        var found = waitingRequests.indexOf(waiter);
        if (found > -1) {
            waitingRequests.splice(found, 1);
            var data = {};
            data.posts = [];
            respondJSON(response, 200, data);
        }
    }, 30 * 1000);
}

function sendChanges() {
    while (waitingRequests.length > 0) {
        let request = waitingRequests.shift();
        MongoClient.connect(url, function (err, db) {
            if (err) throw err;
            var dbo = db.db("mydb");
            dbo.collection("posts").find({}).toArray(function (err, result) {
                if (err) throw err;
                respondJSON(request.response, 200, result);
                db.close();
            });
        });

    }
}
