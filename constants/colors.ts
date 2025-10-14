export const BRAND_COLORS = {
  dark: '#2D3748',
  green: '#4CAF50',
  greenDark: '#45a049',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
};

export default {
  light: {
    text: BRAND_COLORS.gray[900],
    background: BRAND_COLORS.gray[100],
    tint: BRAND_COLORS.green,
    primary: BRAND_COLORS.green,
    secondary: BRAND_COLORS.dark,
  },
};
