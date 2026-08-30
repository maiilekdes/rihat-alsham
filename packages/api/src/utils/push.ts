import { firebaseMessaging } from './firebase';
import { pool } from '../db/pool';
import { OrderStatus } from '@rihasham/shared';

const TITLES: Record<OrderStatus, { ar: string; en: string }> = {
  pending_payment: { ar: '', en: '' },
  received: { ar: 'تم استلام طلبك', en: 'Order received' },
  preparing: { ar: 'جاري تحضير طلبك', en: 'Preparing your order' },
  out_for_delivery: { ar: 'طلبك في الطريق', en: 'Order out for delivery' },
  ready_for_pickup: { ar: 'طلبك جاهز للاستلام', en: 'Order ready for pickup' },
  completed: { ar: 'تم تسليم طلبك، بالهناء والشفاء', en: 'Order completed — enjoy!' },
  cancelled: { ar: 'تم إلغاء طلبك', en: 'Order cancelled' },
};

/** Sends an FCM push to the customer in their preferred language when their order status changes. */
export async function notifyOrderStatus(userId: string, orderNumber: number, status: OrderStatus) {
  const { rows } = await pool.query(`SELECT push_token, preferred_lang FROM users WHERE id = $1`, [userId]);
  const user = rows[0];
  if (!user?.push_token) return;

  const copy = TITLES[status][user.preferred_lang as 'ar' | 'en'] ?? TITLES[status].en;
  if (!copy) return;

  try {
    await firebaseMessaging.send({
      token: user.push_token,
      notification: { title: 'Rihat Alsham | ريحة الشام', body: `#${orderNumber} — ${copy}` },
      data: { orderNumber: String(orderNumber), status },
    });
  } catch (err) {
    console.error('Push notification failed', err);
  }
}

const MESSAGE_PREVIEW = { ar: { image: 'صورة جديدة', video: 'مقطع فيديو جديد' }, en: { image: 'New photo', video: 'New video' } };

/** Sends an FCM push when the restaurant replies in an order's delivery chat. */
export async function notifyNewMessage(userId: string, type: 'text' | 'image' | 'video', body?: string) {
  const { rows } = await pool.query(`SELECT push_token, preferred_lang FROM users WHERE id = $1`, [userId]);
  const user = rows[0];
  if (!user?.push_token) return;

  const lang = (user.preferred_lang as 'ar' | 'en') ?? 'en';
  const preview = type === 'text' ? body ?? '' : MESSAGE_PREVIEW[lang][type];
  const title = lang === 'ar' ? 'رسالة جديدة من المطعم' : 'New message from the restaurant';

  try {
    await firebaseMessaging.send({
      token: user.push_token,
      notification: { title, body: preview },
      data: { kind: 'order_message' },
    });
  } catch (err) {
    console.error('Push notification failed', err);
  }
}
