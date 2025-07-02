import { CompanyAsset } from '@shared/schema';

const CDN_BASE = process.env.PUBLIC_IMG_CDN || '';

export interface SerializedCompanyAsset extends Omit<CompanyAsset, 'photoUrl'> {
  photoUrl: string | null;
}

/**
 * Serializes a company asset, ensuring photoUrl uses CDN URL if configured
 */
export function serializeCompanyAsset(asset: CompanyAsset): SerializedCompanyAsset {
  let photoUrl = asset.photoUrl;
  
  // If photoUrl exists and doesn't start with http, prepend CDN base
  if (photoUrl && !photoUrl.startsWith('http')) {
    photoUrl = CDN_BASE ? `${CDN_BASE}/${photoUrl}` : photoUrl;
  }
  
  return {
    ...asset,
    photoUrl
  };
}

/**
 * Serializes an array of company assets
 */
export function serializeCompanyAssets(assets: CompanyAsset[]): SerializedCompanyAsset[] {
  return assets.map(serializeCompanyAsset);
} 