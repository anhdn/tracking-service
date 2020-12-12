require('dotenv').config()
const mongoose = require('mongoose');
const Promise = require('bluebird');
const TrackingModel = require('./model/Tracking.js');
const { isJson } = require('validator');
const AWS = require('aws-sdk');

AWS.config.update({ region: 'ap-southeast-1' });
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});

mongoose.Promise = Promise;

const queueUrl = process.env.QUEUE_URL;
const mongoString = process.env.MONGODB_URL

const dbExecute = (db, fn) => db.then(fn).finally(() => db.close());

const dbConnectAndExecute = (dbUrl, fn) => {
  return dbExecute(mongoose.connect(dbUrl, { useMongoClient: true }), fn);
}
const params = {
  QueueUrl: queueUrl,
  MaxNumberOfMessages: 1,
  VisibilityTimeout: 0,
  WaitTimeSeconds: 0
};
module.exports.createUser.trackingConsume = () => {
  sqs.receiveMessage(params, (err, data) => {
    console.log('data', data)
    if (err) {
      console.log(err, err.stack);
    } else {
      if (!data.Messages) {
        console.log('Nothing to process');
        return;
      }
      const trackingData = JSON.parse(data.Messages[0].Body);
      console.log('Order received', trackingData);

      const tracking = new TrackingModel(
        {
          ...trackingData,
          createdAt: new Date()
        }
      );

      const validator = tracking.validateSync()
      if (validator) {
        console.log('Incorrect tracking data: ', validator);
        return;
      }

      dbConnectAndExecute(mongoString, () => (
        tracking
          .save()
          .then(() => {
            console.log('Tracking saved!')
          })
          .catch(err => console.log('Error: ', err.statusCode, err.message))
      ));
      const deleteParams = {
        QueueUrl: queueUrl,
        ReceiptHandle: data.Messages[0].ReceiptHandle
      };
      sqs.deleteMessage(deleteParams, (err, data) => {
        if (err) {
          console.log(err, err.stack);
        } else {
          console.log('Successfully deleted message from queue');
        }
      });
    }
  });
}
