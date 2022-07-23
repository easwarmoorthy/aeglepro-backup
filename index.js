const { v4 } = require('uuid');
const cron = require('node-cron');
const { execute } = require('@getvim/execute');
const dotenv = require('dotenv');
dotenv.config();
const compress = require('gzipme');
const fs = require('fs');
const firebase = require('./firebase/index')



const bucket = firebase.storage().bucket();
const username = process.env.PGUSER;
const database = process.env.PGDATABASE;
const dbHost = process.env.PGHOST;
const dbPort = process.env.PGPORT;

async function uploadFile(backupFile) {
  try {
    const metadata = {
      metadata: {
        firebaseStorageDownloadTokens: v4()
      },
      contentType: 'application/gz',
      cacheControl: 'public, max-age=31536000',
    };

    await bucket.upload(backupFile, {
      gzip: true,
      metadata: metadata,
    });

    console.info(`File uploaded`);
    fs.unlinkSync(backupFile);
    console.info(`Local file deleted`);

    const date = new Date()
    date.setDate(date.getDate() - 40)
    let oldFile = date.toISOString().substring(0, 10) + '.gz'

    const response = await firebase.storage().bucket().file(oldFile).delete();
    console.info(`Past month backup file deleted`);
  } catch (error) {
    console.error(error.message)
  }
}

const takePGBackup = () => {
  const date = new Date()
  date.setDate(date.getDate())
  let backupFile = date.toISOString().substring(0, 10)
  console.log(backupFile)
  execute(`export PGPASSWORD=${process.env.PGPASS}; pg_dump -U ${username} -h ${dbHost} -p ${dbPort} -f ${backupFile} -F t -d ${database}`)
    .then(async () => {
      console.info(`Backup created successfully`);
      await compress(backupFile);
      console.info("Zipped backup created");
      console.info('Deleted unzipped dump')
      fs.unlinkSync(backupFile);
      backupFile += '.gz'
      uploadFile(backupFile).catch(console.error);
    })
    .catch((err) => {
      console.error(err);
    });
}


cron.schedule('0 0 * * *', function () {
  console.info('\n\nCron Job ---', (new Date()).toISOString())
  takePGBackup()
});