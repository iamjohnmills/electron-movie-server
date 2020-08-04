# Electron Movie Server API
A simple electron app that lets you pick a directory of mp4 files and serves them via an API.

Built with Electron, Node, Express, and FFMPEG

![Movie Server Screenshot](https://raw.githubusercontent.com/iamjohnmills/electron-movie-server/master/screenshot.png)

My inspiration is PLEX, which, although great (and I still use it), appeals to a wider range of users and has many features that I don't use. My intention is to make a lightweight, fast, and simple media server, with only the features I use most.

## Installation
Copy the repository locally and run npm install in the directory.

## Basic Usage
From settings, specify a port, and media directories (click on a set directory to remove it).

Get a list of all movies
http://{ipaddress or localhost}:{port}/movies

Get a movie by id
http://{ipaddress or localhost}:{port}/movies/{id}

Stream a movie by id
http://{ipaddress or localhost}:{port}/movies/{id}/stream

Get settings
http://{ipaddress or localhost}:{port}/settings

## How it works
JSON files are used for settings and storage of each mp4 file. The app only works with mp4 files, and I don't feel the need to transcode other video types in the modern landscape. There is an option to refresh new videos, or rebuild the entire storage.

FFMPEG binaries are included to probe files for metadata. I personally use PlayOn to record movies, which provides specific metadata that is used to display the poster, title, and release data. Without this specific metadata, it won't display correctly.

The metadata it looks for:

tags.Thumbnailurl

tags.title

tags.Date

I use express to host a companion server for the API with the routes noted below. From the settings page, you can view the current IP address easily to access it on another machine.

## Roadmap
The app currently has limited functionality. I would like to:

Build the app to run on MacOS and Windows

Create a companion web app, firestick app, or roku app that consumes the REST API and streams movies.

Add ability to save playback timemarks for resuming video if paused.

Add metadata from TMDB

Allow customizing the metadata, and the poster for each video file

Add fallback logic if no metadata
