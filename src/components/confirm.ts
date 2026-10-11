import { Alert, Platform } from 'react-native';

export interface ConfirmDestructiveOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
}

/**
 * Destructive confirmation that resolves true only when the user explicitly
 * confirms. Android uses the native alert dialog; web (where react-native-web
 * has no Alert implementation) uses the browser's blocking confirm().
 */
export function confirmDestructive({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
}: ConfirmDestructiveOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
