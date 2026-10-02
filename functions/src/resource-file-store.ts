import { getStorage } from "firebase-admin/storage";
import "./firebase.js";

export const attachmentBucketName = () => process.env.RESOURCE_ATTACHMENTS_BUCKET || `${process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT}-resource-attachments`;
export const resourceFilePath = (postId: string, fileId: string) => `resource-attachments/${postId}/${fileId}`;
export const attachmentBucket = () => getStorage().bucket(attachmentBucketName());
export async function putResourceFile(postId: string, fileId: string, bytes: Buffer) {
  await attachmentBucket().file(resourceFilePath(postId, fileId)).save(bytes, {
    resumable: false, validation: "crc32c", preconditionOpts: { ifGenerationMatch: 0 },
    metadata: { contentType: "application/octet-stream", cacheControl: "private, no-store", contentDisposition: "attachment" },
  });
}
export async function readResourceFile(postId: string, fileId: string) {
  const [bytes] = await attachmentBucket().file(resourceFilePath(postId, fileId)).download();
  return bytes;
}
export async function removeResourceFile(postId: string, fileId: string) {
  await attachmentBucket().file(resourceFilePath(postId, fileId)).delete({ ignoreNotFound: true });
}
