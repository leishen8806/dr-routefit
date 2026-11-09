import { File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';

import { validateEvidencePhoto } from './delivery.mjs';

export interface DeliveryPhoto {
  uri: string;
  mimeType: 'image/jpeg';
  sizeBytes: number;
  sha256: string;
}

export async function captureDeliveryPhoto(): Promise<{ denied: boolean; photo: DeliveryPhoto | null }> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { denied: true, photo: null };
  const captured = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (captured.canceled) return { denied: false, photo: null };

  const compressed = await ImageManipulator.manipulateAsync(
    captured.assets[0].uri,
    [{ resize: { width: 1600 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  );
  const source = new File(compressed.uri);
  const stored = new File(Paths.cache, `routefit-delivery-${Crypto.randomUUID()}.jpg`);
  await source.copy(stored);
  const photo = {
    uri: stored.uri,
    mimeType: 'image/jpeg' as const,
    sizeBytes: stored.size,
    sha256: await stored.digest('SHA-256'),
  };
  validateEvidencePhoto(photo);
  return { denied: false, photo };
}

export function deliveryPhotoBlob(photo: DeliveryPhoto): Blob {
  return new File(photo.uri);
}

export function deleteDeliveryPhoto(photo: DeliveryPhoto | null): void {
  if (!photo) return;
  const file = new File(photo.uri);
  if (file.exists) file.delete();
}
