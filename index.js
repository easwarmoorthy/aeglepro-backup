const { v4 } = require('uuid')
const cron = require('node-cron')
require('dotenv').config({ override: true })
const compress = require('gzipme')
const fs = require('fs')
const { getInstance } = require('./db')
const { spawn } = require('child_process');
const username = process.env.PGUSER
const database = process.env.PGDATABASE
const dbHost = process.env.PGHOST
const dbPort = process.env.PGPORT

async function getSchema(){
  const dbInstance = await getInstance()
  try {
    let allSchema = await dbInstance.query(`
    SELECT org_schema FROM aeglepro.config`)
    allSchema = allSchema.rows
    
      schemas=allSchema.map((e)=>e.org_schema)
      return schemas

  } catch (error) {
    console.error(error)
    services.sendSupportEmail('DB Error', error)
  } finally {
    dbInstance.release()
  }
  
}
async function startfunction() {
  try {
    const schemas = await getSchema();
    console.log(schemas); 
    schemas.map((singleSchema)=>takePGBackup(singleSchema).catch(console.error))
  } catch (error) {
    console.error(error);
  }
}

async function takePGBackup(singleSchema) {
    const date = new Date();
    let backupFile = `${singleSchema}_${date.toISOString().substring(0, 10)}`;

    const pgDumpProcess = spawn('pg_dump', [
        '-U', username,
        '-h', dbHost,
        '-p', dbPort,
        '-f', backupFile,
        '-F', 't',
        '-d', database,
        '-n', singleSchema
    ]);

    pgDumpProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });

    pgDumpProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    pgDumpProcess.on('close', async(code) => {
        if (code === 0) {
            console.log('Backup created successfully');
                  await compress(backupFile)
                  console.info('Zipped backup created')
                  console.info('Deleted unzipped dump')
                  fs.unlinkSync(backupFile)
                  backupFile += '.gz'
                  uploadFile(backupFile).catch(console.error)
        } else {
            console.error(`Backup process exited with code ${code}`);
        }
    });
}



async function uploadFile (backupFile) {
  try {
    const metadata = {
      metadata: {
        firebaseStorageDownloadTokens: v4()
      },
      contentType: 'application/gz',
      cacheControl: 'public, max-age=31536000'
    }

    const firebase = require('./firebase/index')
    const bucket = firebase.storage().bucket()
    await bucket.upload(backupFile, {
      gzip: true,
      metadata
    }).catch(err=>console.log(err))

    console.info('File uploaded')
    fs.unlinkSync(backupFile)
    console.info('Local file deleted')

    const date = new Date()
    date.setDate(date.getDate() - 40)
    let newBackupFile=backupFile.split('_')
    const oldFile = `${newBackupFile[0]}_${date.toISOString().substring(0, 10)}.gz`
    
    await firebase.storage().bucket().file(oldFile).delete()
    console.info('Past month backup file deleted')
  } catch (error) {
    console.error(error.message)
  }
}

cron.schedule('0 0 * * *', function () {
  console.info('\n\nCron Job ---', (new Date()).toISOString())
  startfunction();
})
