// SDK 54 moved uploadAsync to the legacy entry point; the new API has no
// streaming upload equivalent yet.
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { auth } from './firebase';

/**
 * Uploads a delivery-chat photo or video to our own API.
 *
 * This used to go straight to Firebase Storage. Two reasons it no longer does:
 * Google now requires a billing account for Storage, and Storage rules can't
 * read our database — they could only check that *someone* was signed in, not
 * that this customer owns the order being uploaded to. The API can check that,
 * and does, before writing anything.
 *
 * Uses FileSystem.uploadAsync rather than fetch+Blob: React Native's Blob is a
 * thin handle around a native file, and pushing it through fetch loads the whole
 * video into JS memory before sending, which is how large uploads crash on
 * older phones. uploadAsync streams it natively instead.
 */
export async function uploadChatMedia(
  orderId: string,
  localUri: string,
  kind: 'image' | 'video'
): Promise<string> {
  const apiUrl = Constants.expoConfig?.extra?.apiUrl as string;
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not signed in');

  const contentType = kind === 'image' ? 'image/jpeg' : 'video/mp4';

  const result = await FileSystem.uploadAsync(`${apiUrl}/api/orders/${orderId}/media`, localUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
    },
  });

  if (result.status !== 201) {
    throw new Error(`Upload failed (${result.status})`);
  }

  const { mediaUrl } = JSON.parse(result.body) as { mediaUrl: string };
  // The API returns a path; callers render it directly, so make it absolute.
  return `${apiUrl}${mediaUrl}`;
}
