const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();

const imageUpload = require('../gcp/cloudstorage');

router.use(bodyParser.json());

router.get('/', function (req, res) {
  res.send('Hello World');
})
/**
 * POST / 
 * This is a push subscription sent from cloud run. 
 */
router.post('/', (req, res, next) => {
  console.log('Push Subscription: Event by cloud run');
  if (!req.body) {
    const msg = 'no Pub/Sub message received';
    console.error(`error: ${msg}`);
    res.status(400).send(`Bad Request: ${msg}`);
    return;
  }
  if (!req.body.message || !req.body.message.data) {
    const msg = 'invalid Pub/Sub message format';
    console.error(`error: ${msg}`);
    res.status(400).send(`Bad Request: ${msg}`);
    return;
  }

  // Decode the Pub/Sub message.
  const pubSubMessage = req.body.message;
  let eventData;
  try {
    eventData = Buffer.from(pubSubMessage.data, 'base64').toString();
    eventData = JSON.parse(eventData);
  } catch (err) {
    return err;
  }
  try {
    //logic to handle the seond-bucket
    const attributes = req.body.message.attributes;
    const message = req.body.message;
    console.log('Event type: ', attributes.eventType)
    //Handle Storage Notification events
    imageUpload.handleStorageNotification(attributes, message, eventData);
    //acknowledge the message
    res.status(204).send();
  } catch (err) {
    console.error(`Error: Storing meessage to second-bucket: ${err}`);
    res.status(500).send();
  }
})

// Add Image to Main Bucket
router.post('/storage/add',
  imageUpload.multer.single('image'),
  imageUpload.uploadInMainBucket,
  (req, res, next) => {
    let data = req.body;

    if (req.file && req.file.cloudStoragePublicUrl) {
      data.imageUrl = req.file.cloudStoragePublicUrl;
    }
    // Send public url back to client. //depends on use case
    res.send(data);
  });

module.exports = router;
