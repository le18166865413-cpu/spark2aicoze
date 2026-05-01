import { S3Storage } from "coze-coding-dev-sdk";

export const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});
