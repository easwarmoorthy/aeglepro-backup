const { Pool } = require('pg')



console.log('pool created')
const _databaseInstance = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
  idleTimeoutMillis: 15000,
  max: 20
})

async function getInstance () {
  const dbInstance = await _databaseInstance.connect()
  return dbInstance
}

module.exports = {
  getInstance
}
