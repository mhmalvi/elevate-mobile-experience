// Platform detection for payment routing

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform: () => boolean;
      getPlatform: () => 'ios' | 'android' | 'web';
    };
  }
}

export type Platform = 'ios' | 'android' | 'web';
export type PaymentProvider = 'stripe' | 'google_play' | 'apple_iap';

export function getPlatform(): Platform {
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()) {
    return window.Capacitor.getPlatform();
  }
  return 'web';
}

export function getPaymentProvider(platform: Platform): PaymentProvider {
  switch (platform) {
    case 'android':
      return 'google_play';
    case 'ios':
      return 'apple_iap';
    default:
      return 'stripe';
  }
}

export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform();
}
