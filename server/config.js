'use strict';

const nconf = module.exports = require('nconf');
const path = require('path');

nconf
  .argv()
  .env([
    'GCLOUD_PROJECT',
    'GCLOUD_MAIN_BUCKET',
    'GCLOUD_SECOND_BUCKET',
    'NODE_ENV',
    'PORT'
  ])
  .file({ file: path.join(__dirname, 'config.json') })
  .defaults({
    GCLOUD_PROJECT: 'my-demo-project-267014',
    GCLOUD_MAIN_BUCKET: 'my-demo-project-267014-main-bucket',
    GCLOUD_SECOND_BUCKET: 'my-demo-project-267014-second-bucket',
    PORT: 8080
  });