const electron = require('electron');
const {app, BrowserWindow} = require('electron');
const fs = require('fs');
const path = require('path');
const {fork} = require('child_process');
const server = fork(`${__dirname}/server.js`);
const ip = require('ip');
//const chokidar = require('chokidar'); // for watching files added or changed
const ipc = electron.ipcMain;
var _ = require('lodash');

const config = {
  paths: {
    data: path.join(__dirname,'data/'),
    settings: path.join(__dirname,'settings.json'),
  },
}

const initializeDataFiles = function(){
  // settings file
  if (!fs.existsSync(config.paths.settings)) {
    fs.writeFileSync(config.paths.settings, JSON.stringify({
      port: 8081,
      tmdb_key: '',
      media_directories: [],
    }));
  }
  // data directory
  fs.mkdir(config.paths.data, { recursive: true }, (err) => {
    if (err) throw err; // fix this
  });
}


let mainWindow;
function createWindow(){
  mainWindow = new BrowserWindow({
    width: 700,
    height: 500,
    backgroundColor: '#ffffff',
    fullscreenable:false,
    fullscreen: false,
    maximizable: false,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.setResizable(false);
  mainWindow.loadFile('index.html');
}

app.whenReady().then(async function(){
  await initializeDataFiles();
  await createWindow();
  app.on('activate',async function(){
    if (BrowserWindow.getAllWindows().length === 0){
      await createWindow();
    }
  });
});

app.on('window-all-closed',function(){
  if (process.platform !== 'darwin'){
    app.quit();
  }
});

ipc.on('chooseMediaDirectory', async function(event,args){
  const media_directory = await electron.dialog.showOpenDialog(mainWindow,{
    properties: ['openDirectory'],
  });
  if(!media_directory.filePaths.length) return;
  event.sender.send('mediaDirectorySelected', media_directory.filePaths[0]);

});



const getSettings = function(){
  let data = fs.readFileSync(config.paths.settings, 'utf8');
  if (!data) return {};
  var json = JSON.parse(data);
  json.ip_address = ip.address();
  return json;
}

function slugify(string) {
  const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
  const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
  const p = new RegExp(a.split('').join('|'), 'g')
  return string.toString().toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
    .replace(/&/g, '-and-') // Replace & with 'and'
    .replace(/[^\w\-]+/g, '-') // Remove all non-word characters
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, '') // Trim - from end of text
}

ipc.on('reloadMediaDirectoryFiles', async function(event){
  var files = await getMp4FilesFromSettings();
  if(typeof files == 'undefined'){
    event.sender.send('cleaningFiles');
    await cleanDataFiles();
    event.sender.send('noFiles');
    return;
  }
  for(var i = 0; i < files.length; i++){
    var file = files[i];
    event.sender.send('loadingFile',file);
    await setFileData(file);
    if (i === files.length - 1){
      event.sender.send('cleaningFiles');
      await cleanDataFiles();
      event.sender.send('reloadedMediaDirectoryFileData');
    }
  }
});

ipc.on('refreshMediaDirectoryFiles', async function(event){
  var files = await getMp4FilesFromSettings();
  if(typeof files == 'undefined'){
    event.sender.send('cleaningFiles');
    await cleanDataFiles();
    event.sender.send('noFiles');
    return;
  }
  for(var i = 0; i < files.length; i++){
    var file = files[i];
    if(!file.storage.is_stored){
      event.sender.send('loadingFile',file);
      await setFileData(file);
    }
    if (i === files.length - 1){
      event.sender.send('cleaningFiles');
      await cleanDataFiles();
      event.sender.send('reloadedMediaDirectoryFileData');
    }
  }
});

const getMp4FilesFromSettings = async function(){
  var data = [];
  var dirs = getSettings().media_directories;
  var x = 0;
  for(var i = 0; i < dirs.length; i++){
    var dir = dirs[i];
    var files = fs.readdirSync(dir);
    var mp4_files = filterMP4(files);
    for(var c = 0; c < mp4_files.length; c++){
      var slug = slugify(mp4_files[c]);
      var storage_file_path = path.join(config.paths.data, slug + '.json');
      data[x] = {
        folder: dirs[i],
        file_name: mp4_files[c],
        file_path: path.join(dirs[i],mp4_files[c]),
        storage: {
          slug: slug,
          name: slugify(mp4_files[c]) + '.json',
          path: storage_file_path,
          is_stored: fs.existsSync(storage_file_path),
        },
      }
      if (i === dirs.length - 1 && c === mp4_files.length - 1){
        return data;
      }
      x++;
    }
  }
}

const setFileData = function(options){
  return new Promise(function(resolve, reject) {
    var file_path = path.join(options.folder, options.file_name);
    var data = {
      activity: {
        date_added: null,
        date_last_viewed: null,
        seconds_paused_at: null,
        times_watched: 0,
      },
      file: {
        name: options.file_name,
        path: options.file_path,
        slug: options.storage.slug,
        stats: fs.statSync(options.file_path),
        meta: null,
      }
    }
    fs.writeFileSync(options.storage.path, JSON.stringify(data));
    setFFmpegData(options.storage.path).then(function(done){
      resolve(true);
    });
  });
}

const setFFmpegData = function(path){
  return new Promise(function(resolve, reject) {
    const file = fs.readFileSync(path,{encoding:'utf8', flag:'r'});
    var file_data = JSON.parse(file);
    //var ffmpeg_static = require('ffmpeg-static-electron');
    const ffprobe_static = require('ffprobe-static-electron');
    const ffmpeg = require('fluent-ffmpeg');
    //ffmpeg.setFfmpegPath(ffmpeg_static.path);
    ffmpeg.setFfprobePath(ffprobe_static.path);
    ffmpeg.ffprobe(file_data.file.path, function(err,metadata){
      file_data.file.meta = metadata.format;
      fs.writeFileSync(path, JSON.stringify(file_data));
      resolve(true);
    });
  });
}

const filterMP4 = function(files){
  return _.filter(files,function(file){
    if(!file.startsWith('.') && file.indexOf('.mp4') !== -1){
      return file;
    }
  });
}

async function cleanDataFiles(){
  var storage_files = fs.readdirSync(config.paths.data);
  var files_to_keep = await getMp4FilesFromSettings();
  var files_to_delete = _.filter(storage_files,function(storage_file){
    var found = _.find(files_to_keep,function(file_to_keep){
      if(file_to_keep.storage.name == storage_file){
        return true;
      }
    });
    if(!found){
      return true;
    }
  })
  await removeUnusedDataFiles(files_to_delete);
  return true;
}

const removeUnusedDataFiles = function(files){
  for(var i = 0; i < files.length; i++){
    var file = files[i];
    var to_delete = path.join(config.paths.data,file);
    if(to_delete != path.join(config.paths.data,'.gitkeep')){
      fs.unlinkSync(to_delete);
    }
    if (i === files.length - 1){
      return true;
    }
  }
}


ipc.on('getMedia',function(event,data){
  var files = fs.readdirSync(config.paths.data);
  var data = {
    movies: [],
  };
  files.forEach(function(file,i,files_array){
    if(file != '.gitkeep'){
      const file_data = fs.readFileSync(path.join(config.paths.data,file),{encoding:'utf8', flag:'r'});
      data.movies.push(JSON.parse(file_data));
      if(i == files_array.length - 1){
        event.sender.send('loadMedia', data);
        //res.end( JSON.stringify(data));
      }
    }
  })
});

ipc.on('toggleDevTools',function(event){
  mainWindow.webContents.openDevTools({mode:'undocked'});
});

ipc.on('serverListening',function(event){
  console.log('listening')
});

ipc.on('saveSettings',function(event,data){
  fs.writeFileSync(config.paths.settings, JSON.stringify(data));
  event.sender.send('loadSettingsData', data);
});

ipc.on('removeMediaDirectory',function(event,media_directory){
  let data = getSettings();
  var index = data.media_directories.indexOf(media_directory);
  data.media_directories.splice(index,1);
  event.sender.send('removedMediaDirectory', data);
})

ipc.on('getSettings',function(event){
  let data = getSettings();
  event.sender.send('loadSettingsData', data);
});
