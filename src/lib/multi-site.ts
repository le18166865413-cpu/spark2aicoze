/**
 * Multi-site support utilities
 *
 * Usage:
 * - Set SITE_ID env var on each deployment to distinguish sites
 * - Set SITE_TYPE=main|sub to indicate main or sub site
 * - Set MAIN_SITE_URL on sub sites to know where to pull updates from
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';

export const SITE_ID = process.env.SITE_ID || 'main';
export const SITE_TYPE = (process.env.SITE_TYPE || 'main') as 'main' | 'sub';
export const MAIN_SITE_URL = process.env.MAIN_SITE_URL || '';
export const SYNC_TOKEN = process.env.SYNC_TOKEN || '';

/** Whether current site is the main site */
export function isMainSite(): boolean {
  return SITE_TYPE === 'main' || SITE_ID === 'main';
}

/** Whether current site is a sub site */
export function isSubSite(): boolean {
  return !isMainSite();
}

/** Get display name for current site */
export function getSiteDisplayName(): string {
  if (isMainSite()) return '主站';
  return `子站 (${SITE_ID})`;
}

/** Get current site info for frontend */
export function getCurrentSite(): {
  siteId: string;
  isSubSite: boolean;
  siteLabel: string;
} {
  return {
    siteId: SITE_ID,
    isSubSite: isSubSite(),
    siteLabel: isMainSite() ? '' : `子站 ${SITE_ID}`,
  };
}

// Cache whether site_id column exists in gallery_images
let _siteIdColumnChecked = false;
let _siteIdColumnExists = false;

async function checkSiteIdColumn(): Promise<boolean> {
  if (_siteIdColumnChecked) return _siteIdColumnExists;

  try {
    const supabase = getSupabaseClient();
    // Try to select site_id with limit 0 to check column existence
    const { error } = await supabase
      .from('gallery_images')
      .select('site_id')
      .limit(0);

    _siteIdColumnExists = !error || !error.message?.includes('site_id');
  } catch {
    _siteIdColumnExists = false;
  }

  _siteIdColumnChecked = true;
  return _siteIdColumnExists;
}

/** Get site filter object for Supabase queries */
export async function getSiteFilter(): Promise<
  { column: string; value: string } | undefined
> {
  if (isMainSite()) return undefined;
  const exists = await checkSiteIdColumn();
  if (!exists) return undefined;
  return { column: 'site_id', value: SITE_ID };
}

/** Build insert data with optional site_id */
export async function buildSiteInsertData(
  baseData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const exists = await checkSiteIdColumn();
  if (exists) {
    return { ...baseData, site_id: SITE_ID };
  }
  return baseData;
}
