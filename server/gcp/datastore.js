'use strict';

const Datastore = require('@google-cloud/datastore');
const config = require('../config');

const ds = Datastore({
  projectId: config.get('GCLOUD_PROJECT')
});
const kind = 'BucketDataStore';

function list(messageId) {
  const q = ds.createQuery([kind]).filter('messageId', '=', messageId);
  const p = ds.runQuery(q);
  console.log('Inside list datastore');
  return p.then(([results, { moreResults, endCursor }]) => {
    const images = results.map(item => {
      item.id = item[Datastore.KEY].id;
      return item;
    });
    console.log('----Images', images);
    return {
      images,
      nextPageToken: moreResults != 'NO_MORE_RESULTS' ? endCursor : false
    };
  });
}

function create({ messageId,imageUrl }) {

  const key = ds.key(kind);

  const entity = {
    key,
    messageId,
    data: [
      { name: 'imageUrl', value: imageUrl },
    ]
  };
  return ds.save(entity);
}

module.exports = {
  create,
  list
};

