# Sieves Electron
## The desktop application for sievesApp

## Installation

Sieves Electron requires [Node.js](https://nodejs.org/) v10+ to run.

First of all clone this project to your local machine
Then go to project directory and Install the dependencies.

```sh
cd dillinger
npm i
```

Now in root folder create constant.js file and do this

```sh
const prod = {
    url: 'here put sieves prod url'}
const dev = {
    url: 'here put your local url of sieves'
};

const config = process.env.NODE_ENV?.trim() === 'development' ? dev : prod;
module.exports = config;
```
# Now you can run it locally by running this command
```sh
npm run start
```

## For more documentation look [Electron](https://electronjs.org) and for building and publishing [Electron-forge](https://www.electronforge.io/)