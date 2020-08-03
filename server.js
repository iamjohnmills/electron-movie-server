var express = require('express');
var cors = require('cors');
var fs = require('fs');
var ip = require('ip');
const path = require('path');
var app = express();

var http = require('http').Server(app);

const config = {
  paths: {
    data: path.join(__dirname,'data'),
    settings: path.join(__dirname,'settings.json'),
  },
}

const getSettings = function(){
  let data = fs.readFileSync(config.paths.settings, 'utf8');
  if (!data) return {};
  return JSON.parse(data);
}

let settings = getSettings();
//var port = settings.port;
//var ip_address = ip.address();

app.use(cors({
  origin: 'http://localhost/',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}));

app.get('/settings', function (req,res) {
  fs.readFile( config.paths.settings, 'utf8', function(err, data){
    res.end(data);
  });
})

app.get('/movies', function (req, res) {
   var files = fs.readdirSync(config.paths.data);
   var data = {
     movies: [],
   };
   files.forEach(function(file,i,files_array){
     const file_data = fs.readFileSync(path.join(config.paths.data,file),{encoding:'utf8', flag:'r'});
      data.movies.push(JSON.parse(file_data));
      if(i == files_array.length - 1){
        res.end( JSON.stringify(data));
      }
   })
})

app.get('/movies/:slug', function (req, res) {
  try {
    const file_data = fs.readFileSync(path.join(config.paths.data,req.params.slug + '.json'),{encoding:'utf8', flag:'r'});
    res.end(file_data);
  } catch (e) {
    var msg = {
      error: 'Error',
      message: e.message,
    }
    res.end(JSON.stringify(msg));
  }
})

app.get('/movies/:slug/stream', function(req, res) {
  try {
    const file_data = fs.readFileSync(path.join(config.paths.data,req.params.slug + '.json'),{encoding:'utf8', flag:'r'});
    const video_file = JSON.parse(file_data);
    const stat = fs.statSync(video_file.file.path)
    const fileSize = stat.size
    const range = req.headers.range
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-")
      const start = parseInt(parts[0], 10)
      const end = parts[1]
        ? parseInt(parts[1], 10)
        : fileSize-1
      const chunksize = (end-start)+1
      const file = fs.createReadStream(video_file.file.path, {start, end})
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      }
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      }
      res.writeHead(200, head)
      fs.createReadStream(video_file.file.path).pipe(res)
    }
  } catch (e) {
    var msg = {
      error: 'Error',
      message: e.message,
    }
    res.end(JSON.stringify(msg));
  }
});

var server = http.listen(settings.port, function(){
   var host = server.address().address
   var port = server.address().port
   console.log("Example app listening at http://%s:%s", host, port)
})
