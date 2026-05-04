/**
 * Check if an error is a storage quota exceeded error
 */
export function isStorageQuotaError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message?.toLowerCase() || '';
    const code = (error as NodeJS.ErrnoException).code?.toLowerCase() || '';
    return (
      msg.includes('quota') ||
      msg.includes('insufficient storage') ||
      msg.includes('storage full') ||
      msg.includes('space') ||
      msg.includes('limit exceeded') ||
      msg.includes('access denied') ||
      code === 'quotaexceeded' ||
      code === 'enospc'
    );
  }
  return false;
}

/**
 * Get user-friendly error message for storage errors
 */
export function getStorageErrorMessage(error: unknown): string {
  if (isStorageQuotaError(error)) {
    return '存储空间不足，请联系管理员清理存储或扩容';
  }
  if (error instanceof Error) {
    const msg = error.message?.toLowerCase() || '';
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('econnreset')) {
      return '网络连接失败，请稍后重试';
    }
    if (msg.includes('access') || msg.includes('permission') || msg.includes('forbidden')) {
      return '存储访问权限不足';
    }
  }
  return '文件存储失败，请稍后重试';
}
