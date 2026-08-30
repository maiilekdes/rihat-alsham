import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from './firebase';

const storage = getStorage(firebaseApp);

/**
 * Uploads a photo/video straight to Firebase Storage from the device and
 * returns its public download URL — the API never sees the raw file, only
 * the resulting URL it's asked to attach to a chat message.
 */
export async function uploadChatMedia(orderId: string, localUri: string, kind: 'image' | 'video'): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const ext = kind === 'image' ? 'jpg' : 'mp4';
  const path = `order-chat/${orderId}/${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: kind === 'image' ? 'image/jpeg' : 'video/mp4' });
  return getDownloadURL(storageRef);
}
