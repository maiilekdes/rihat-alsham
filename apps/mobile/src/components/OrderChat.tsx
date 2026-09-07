import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, Image, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { OrderMessage } from '@rihasham/shared';
import { api } from '../lib/api';
import { auth } from '../lib/firebase';
import { uploadChatMedia } from '../lib/storage';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

interface Props {
  orderId: string;
}

/**
 * The delivery-notes chat attached to a single order — customer sends text
 * or a photo/video of the building/door, restaurant staff can reply. Lives
 * on the order tracking screen and closes naturally once the order completes.
 */
export default function OrderChat({ orderId }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    load();
    let socket: Socket;
    (async () => {
      const token = await auth.currentUser?.getIdToken();
      socket = io(Constants.expoConfig?.extra?.apiUrl as string, { auth: { token, role: 'customer' } });
      socket.on('order:message', (msg: OrderMessage & { orderId: string }) => {
        if (msg.orderId === orderId) setMessages((prev) => [...prev, msg]);
      });
    })();
    return () => {
      socket?.disconnect();
    };
  }, [orderId]);

  async function load() {
    const { data } = await api.get(`/api/orders/${orderId}/messages`);
    setMessages(data);
  }

  async function sendText() {
    if (!text.trim()) return;
    const body = text.trim();
    setText('');
    const { data } = await api.post(`/api/orders/${orderId}/messages`, { type: 'text', body });
    setMessages((prev) => [...prev, data]);
  }

  async function sendMedia(kind: 'image' | 'video') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      quality: 0.7,
      videoMaxDuration: 30,
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      const mediaUrl = await uploadChatMedia(orderId, result.assets[0].uri, kind);
      const { data } = await api.post(`/api/orders/${orderId}/messages`, { type: kind, mediaUrl });
      setMessages((prev) => [...prev, data]);
    } catch {
      Alert.alert('Error', 'Could not send that — please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => {
          const isMine = item.senderId === profile?.id;
          return (
            <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                {item.type === 'text' && (
                  <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.body}</Text>
                )}
                {item.type === 'image' && (
                  <Image
                    source={{ uri: item.mediaUrl }}
                    style={styles.media}
                    accessible
                    accessibilityRole="image"
                    accessibilityLabel={t('a11yChatPhoto')}
                  />
                )}
                {item.type === 'video' && (
                  <Video source={{ uri: item.mediaUrl! }} style={styles.media} useNativeControls resizeMode={ResizeMode.COVER} />
                )}
              </View>
            </View>
          );
        }}
      />

      <View style={styles.inputRow}>
        <TouchableOpacity
          style={styles.attachBtn}
          onPress={() => sendMedia('image')}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel={t('a11ySendPhoto')}
          accessibilityState={{ disabled: uploading }}
        >
          {/* The emoji is decorative: the button's own label carries the meaning,
              otherwise a screen reader announces "camera emoji" and nothing else. */}
          <Text style={styles.attachIcon} importantForAccessibility="no">📷</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.attachBtn}
          onPress={() => sendMedia('video')}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel={t('a11ySendVideo')}
          accessibilityState={{ disabled: uploading }}
        >
          <Text style={styles.attachIcon} importantForAccessibility="no">🎥</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.textInput}
          value={text}
          onChangeText={setText}
          placeholder="e.g. building photo, gate code…"
          multiline
        />
        {uploading ? (
          <ActivityIndicator color={colors.red} style={{ marginStart: 8 }} />
        ) : (
          <TouchableOpacity style={styles.sendBtn} onPress={sendText}>
            <Text style={styles.sendBtnText}>➤</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 320, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  bubbleRow: { marginBottom: 8, flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', borderRadius: 14, padding: 10 },
  bubbleMine: { backgroundColor: colors.red },
  bubbleTheirs: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  bubbleText: { color: colors.ink, fontSize: 14 },
  bubbleTextMine: { color: 'white' },
  media: { width: 180, height: 180, borderRadius: 10, backgroundColor: colors.border },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white },
  attachBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  attachIcon: { fontSize: 18 },
  textInput: { flex: 1, backgroundColor: colors.bg, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 80 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', marginStart: 8 },
  sendBtnText: { color: 'white', fontWeight: '700' },
});
