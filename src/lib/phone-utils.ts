// 手机号格式统一工具
// 存储时去掉 +86/86 前缀，保留 11 位数字（如 18166865413）

export function normalizePhoneForStorage(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  // 去掉开头的 86 国家码
  if (digits.startsWith('86') && digits.length > 11) {
    return digits.slice(2);
  }
  return digits || null;
}

export function normalizePhoneForDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  return normalizePhoneForStorage(phone) || '';
}
