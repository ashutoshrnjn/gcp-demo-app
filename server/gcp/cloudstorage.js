const fs = require('fs');
const {promisify} = require('util');
const path = require('path');
const config = require('../config');
const Storage = require('@google-cloud/storage');
const storage = Storage({
  projectId: config.get('GCLOUD_PROJECT')
});
const datastore = require('./datastore');
const mainBucket = config.get('GCLOUD_MAIN_BUCKET');
const gcSecondBucket = config.get('GCLOUD_SECOND_BUCKET');

//Uplaod in main bucket.
function uploadInMainBucket(req, res, next) {
  console.log('=====Inside uploadInMainBucket', req.file);
  if (!req.file) {
    return next();
  }
  const oname = Date.now() + req.file.originalname;
  const bucket = storage.bucket(mainBucket);
  const file = bucket.file(oname);
  const stream = file.createWriteStream({
    metadata: {
      contentType: req.file.mimetype
    }
  });

  stream.on('error', err => {
    next(err);
  });

  stream.on('finish', () => {
    file.makePublic().then(() => {
      req.file.cloudStoragePublicUrl = `https://storage.googleapis.com/${mainBucket}/${oname}`;
      next();
    });
  });
  stream.end(req.file.buffer);
}

//Check data store identify duplicates based in messageId
const checkDataStore = async (messageId, objectURL) => {
  //first check in dartastore with messageid, if exists then just ack 
  // otherwise store in second bucket
  // message id is always unique and assigned by the Topic/Publisher
  let result = await datastore.list(messageId);
  if(result.length >0) {
     return true;
  } else {
    const data = {
      messageId,
      imageUrl: objectURL
    }
    datastore.create(data);
    return false;
  }
}
const deleteFromSecondBucket = (objectExists, file) => {
  if(!objectExists) return 'No data found';
  const secondBucket = storage.bucket(gcSecondBucket);
  secondBucket.file(file.name).delete();
  return;
}

const uploadInSecondBucket = async (objectExists, file) => {
  console.log('Inside uploadInSecondBucket');
  if(objectExists) return 'Duplicate Event';
  const tempLocalPath = `/tmp/${path.parse(file.name).base}`;
  const secondBucket = storage.bucket(gcSecondBucket);
  try {
    // Download file from bucket.
    await file.download({destination: tempLocalPath});
    console.log(`Downloaded ${file.name} to ${tempLocalPath}.`);
  } catch (err) {
    throw new Error(`File download failed: ${err}`);
  }
  try {
      secondBucket.upload(tempLocalPath, {destination: file.name});
      const gcsPath = `gs://${gcSecondBucket}/${file.name}`;
      console.log(`Uploaded image to: ${gcsPath}`);
      return;
  } catch (err) {
    return err;
  }
  //Delete temp file from system
  const unlink = promisify(fs.unlink);
  return unlink(tempLocalPath);
}

// Handle Storage Events OBJECT_FINALIZE and OBJECT_DELETE
const handleStorageNotification = async (attributes, message, eventData) => {
  const file = storage.bucket(eventData.bucket).file(eventData.name);
  // check datastore for the duplicate 
  let objectExists = await checkDataStore(message.messageId, eventData.mediaLink);
  console.log('objectExists====', objectExists)
  switch(attributes.eventType) {
    case 'OBJECT_FINALIZE': await uploadInSecondBucket(objectExists, file);
      break;
    case 'OBJECT_DELETE': await deleteFromSecondBucket(objectExists, file);
      break;
    default:
      return;
  }
} 

const Multer = require('multer');
const multer = Multer({
  storage: Multer.MemoryStorage,
  limits: {
    fileSize: 40 * 1024 * 1024
  }
});

module.exports = {
  uploadInMainBucket,
  multer,
  handleStorageNotification,
};
