# canvas

Recreation of reddit's [r/place](https://www.reddit.com/r/place/)

![](https://yeleha.co/3rfXby9)


## Deployment 
_Please note that this app is tailored toward the current deployment on https://arr.place, so you'll need to make some modifications to fit your own environment, especially regarding CORS and captcha_

* Clone this repo
* Run `npm install && npm run build` in the client and server directories
* The `client/dist` directory is the root of the client web app
* Run `node server.js` in the `server/dist` directory to start the server
