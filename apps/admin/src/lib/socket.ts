import { io, Socket } from 'socket.io-client';
import { auth } from './firebase';

let socket: Socket | null = null;

/** One shared Socket.IO connection for the live order queue, authenticated with a fresh Firebase ID token. */
export async function getSocket(role: 'staff' | 'owner'): Promise<Socket> {
  if (socket?.connected) return socket;
  const token = await auth.currentUser?.getIdToken();
  socket = io(process.env.NEXT_PUBLIC_API_URL as string, {
    auth: { token, role },
  });
  return socket;
}
