
'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./rain1155.cjs.production.min.js')
} else {
  module.exports = require('./rain1155.cjs.development.js')
}
