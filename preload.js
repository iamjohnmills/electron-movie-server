

window.addEventListener('DOMContentLoaded',function(){
  const replaceText = function(selector, text){
    const element = document.getElementById(selector);
    if(element){
      element.innerText = text;
    }
  }
  for(const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }

  const elementExists = function(selector){
    const element = document.getElementById(selector);
    if(element){
      return true;
    } else {
      return false;
    }
  }

  const ipc = require('electron').ipcRenderer;


  if( elementExists('container-index') ){

    var moment = require('moment'); // require
    var loading = false;

    document.getElementById('reload-media-directory-files').addEventListener('click',function(e){
      e.preventDefault();
      if(loading) return;
      loading = true;
      document.getElementById('movies').innerHTML = 'Loading...';
      ipc.send('reloadMediaDirectoryFiles');
    });

    document.getElementById('refresh-media-directory-files').addEventListener('click',function(e){
      e.preventDefault();
      if(loading) return;
      loading = true;
      document.getElementById('movies').innerHTML = 'Loading...';
      ipc.send('refreshMediaDirectoryFiles');
    });

    ipc.send('getMedia');

    ipc.on('loadingFile', function(event,messages){
      document.getElementById('movies').innerHTML = 'Loading ' + messages.file_name + '...';
    });

    ipc.on('cleaningFiles', function(event){
      document.getElementById('movies').innerHTML = 'Cleaning storage files...';
    });

    ipc.on('reloadedMediaDirectoryFileData', function(event){
      ipc.send('getMedia');
    })

    ipc.on('noFiles', function(event){
      document.getElementById('movies').innerHTML = 'No movies';
    })

    ipc.on('loadMedia', function(event, messages){
      let movies = '';
      for(var i in messages.movies){

        movies += `<div class="movie mb-10" data-movie="` + messages.movies[i].file.slug + `">` +
        `<div class="movie-img">` +
        `<img class="movie-img-bg" src="` + messages.movies[i].file.meta.tags.Thumbnailurl + `" />` +
        `<img class="movie-img-thumb" src="` + messages.movies[i].file.meta.tags.Thumbnailurl + `" />` +
        `</div>` +
        `<div class="movie-info">` +
        `<div class="movie-title" title="`+messages.movies[i].file.meta.tags.title+`">` + messages.movies[i].file.meta.tags.title + `</div>` +
        `<div class="movie-date">` + moment(messages.movies[i].file.meta.tags.Date).format('YYYY') + `</div>` +
        `</div>` +
        `</div>`;
      }
      document.getElementById('movies').innerHTML = movies;
      loading = false;

    });

    ipc.on('loadMediaDirectoryFileData', function(event, messages){
      console.log(messages);
    });


  }

  if( elementExists('container-settings') ){


    let settings_data = {
      port: '8081',
      media_directories: [],
    }

    ipc.send('getSettings');

    ipc.on('removedMediaDirectory', function(event, messages){
      settings_data = messages;
      ipc.send('saveSettings',settings_data);
    });

    ipc.on('loadSettingsData', function(event, messages){
      //console.log('Loaded settings data');
      settings_data = messages;
      document.getElementById('ip-address').innerHTML = messages.ip_address;
      document.getElementById('input-port').value = messages.port;
      let dirs = '';
      for(var i in messages.media_directories){
        dirs += `<div class="media-directory" data-media-directory="` + messages.media_directories[i] + `">` + messages.media_directories[i] + `</div>`;
      }
      document.getElementById('media_directories').innerHTML = dirs;
    });

    ipc.on('mediaDirectorySelected', function(event, media_directory){
      if(settings_data.media_directories.indexOf(media_directory) == -1){
        settings_data.media_directories.push(media_directory);
        ipc.send('saveSettings',settings_data);
      }
    });

    document.addEventListener('click',function(e){
      if(e.target && e.target.className == 'media-directory'){
        ipc.send('removeMediaDirectory',e.target.dataset.mediaDirectory);
      }
    });

    document.getElementById('choose-media-directory').addEventListener('click',function(e){
      ipc.send('chooseMediaDirectory');
    });

    document.getElementById('submit-form').addEventListener('click',function(e){
      settings_data.port = document.getElementById('input-port').value;
      ipc.send('saveSettings',settings_data);
    });

    document.getElementById('choose-media-directory').addEventListener('click',function(e){
      ipc.send('chooseMediaDirectory');
    });


  }

});
