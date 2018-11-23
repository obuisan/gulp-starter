# gulp-starter

[Gulp](http://gulpjs.com) workflow starter with support for sass, babel, browser-sync, ftp, etc.

## Installation

Install the dependencies

```sh
npm install
```

### Optional

Copy the ```.env.example``` file to a local ```.env``` and ensure all the settings are correct for your local environment.

## Usage

```sh
gulp build
```

This will watch your files and copy/compile/etc them when detect changes.

```sh
gulp watch
```

Start a local server (or remote via proxy) with [browser-sync](https://www.browsersync.io/)

```sh
gulp serve
```

## Configuration

Edit the ```config.json``` file.

Available options and their default values:

```json
{
  "src": "./dev",
  "dest": "./dist",
  "environment": {
    "development": {
      "archive": false,
      "ftpDeploy": false,
      "clean": true,
      "proxy": false
    },
    "production": {
      "archive": true,
      "ftpDeploy": true,
      "clean": false,
      "proxy": true
    }
  },
  "clean": [
    "./*"
  ],
  "copy": [
    {
      "name": "html",
      "src": [
        "*.html"
      ],
      "dest": "./"
    }
  ],
  "css": [
    {
      "name": "style",
      "base": "./",
      "src": [
        "./sass/**/*.scss"
      ],
      "dest": "./css",
      "sourcemaps": true,
      "concat": true,
      "order": [],
      "minify": true,
      "rename": true,
      "lint": true,
      "sass": false
    }
  ],
  "js": [
    {
      "name": "main",
      "base": "./",
      "src": [
        "./js/**/*.js"
      ],
      "dest": "./js",
      "sourcemaps": true,
      "concat": true,
      "order": [],
      "minify": true,
      "rename": true,
      "babel": false,
      "lint": true
    }
  ]
}
```
