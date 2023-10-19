
const AWS = require('aws-sdk');
require('dotenv').config()



AWS.config.update({
    AWS_PUBLIC_KEY: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    AWS_BUCKET_NAME:process.env.AWS_BUCKET_NAME
});


const s3 = new AWS.S3();

