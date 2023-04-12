const firebase = require('firebase-admin')
const credentials = require('./credentials.json')

firebase.initializeApp({
  credential: firebase.credential.cert(credentials),
  storageBucket: process.env.FB_STORAGE
})

module.exports = firebase
