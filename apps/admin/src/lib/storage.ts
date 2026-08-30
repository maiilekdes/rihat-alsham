import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from './firebase';

const storage = getStorage(firebaseApp);

/** Uploads a staff-side reply photo straight to Firebase Storage and returns its download URL. */
export async function uploadChatMedia(orderId: string, file: File): Promise<string> {
  const path = `order-chat/${orderId}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}
