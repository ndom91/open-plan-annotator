export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

export declare const REPO: string;
export declare const PLATFORM_ASSET_BASENAME_MAP: Record<string, string>;

export declare function getPlatformKey(platform?: string, arch?: string): string;
export declare function getPlatformAssetArchiveName(platformKey?: string): string | null;
export declare function parseChecksumManifest(manifestText: string): Map<string, string>;
export declare function selectChecksumAsset(assets: ReleaseAsset[]): ReleaseAsset | null;
