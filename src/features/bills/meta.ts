import type { Ionicons } from '@expo/vector-icons';

import type { BillCategory } from '@/types/bill';

/** Icon per bill category (labels come from `bills.categories.*`). */
export const BILL_CATEGORY_ICONS: Record<BillCategory, keyof typeof Ionicons.glyphMap> = {
  electricity: 'flash-outline',
  internet: 'wifi-outline',
  water: 'water-outline',
  gas: 'flame-outline',
  rent: 'home-outline',
  phone: 'call-outline',
  credit_card: 'card-outline',
  subscription: 'repeat-outline',
  education: 'school-outline',
  other: 'receipt-outline',
};
