import { successResponse, runWarm } from './utils';
import { Response } from './utils/lambda-response';

import mongoose from 'mongoose';
const Promise = require('bluebird');
import AWS from 'aws-sdk';
import TrackingModel from './model/Tracking.js';

AWS.config.update({ region: 'ap-southeast-1' });
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

mongoose.Promise = Promise;

const queueUrl: string = process.env.QUEUE_URL || '';
const mongoString: string = process.env.MONGODB_URL || ''

console.log(process.env)
const dbExecute = (db: any, fn: object) => db().then(fn).finally(() => db.close());

const dbConnectAndExecute = (dbUrl: string, fn: object) => {
  return dbExecute(mongoose.connect(
    dbUrl ), fn);
}

interface paramsQueueObj {
    QueueUrl: string | undefined;
    MaxNumberOfMessages: number;
    VisibilityTimeout: number;
    WaitTimeSeconds: number;
}

const params: paramsQueueObj = {
  QueueUrl: queueUrl,
  MaxNumberOfMessages: 1,
  VisibilityTimeout: 0,
  WaitTimeSeconds: 0
};

// @ts-ignore
const tracking = async (event: AWSLambda.APIGatewayEvent): Promise<Response> => {
  // @ts-ignore
  sqs.receiveMessage(params, (err, data): void => {
    console.log('data', data);
    if (err) {
      console.log(err, err.stack);
    } else {
      if (!data.Messages) {
        console.log('==> Nothing to process');
        return;
      }

      const trackingData = JSON.parse(data.Messages[0].Body!.toString());
      console.log('Received', trackingData);

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
            console.log('Tracked')
          })
          .catch(err => console.log('Error: ', err.statusCode, err.message))
      ));
      const deleteParams = {
        QueueUrl: queueUrl,
        ReceiptHandle: data.Messages[0].ReceiptHandle
      };
      // @ts-ignore
      sqs.deleteMessage(deleteParams, (err) => {
        if (err) {
          console.log(err, err.stack);
        } else {
          console.log('Successfully deleted message from queue');
        }
      });
    }
    // successResponse handles wrapping the response in an API Gateway friendly
    // format (see other responses, including CORS, in `./utils/lambda-response.ts)
    const response = successResponse({
      message: 'Tracked!',
      input: event,
    });
    // @ts-ignore
    return response;
  });
};

// runWarm function handles pings from the scheduler so you don't
// have to put that boilerplate in your function.
export default runWarm(tracking);
