import type {ProjectIdentity} from '../context/slices/projectSlice';

const STORAGE_PREFIX = 'faims.pushOnlyBannerDismissed';

function storageKey({serverId, projectId}: ProjectIdentity): string {
  return `${STORAGE_PREFIX}:${serverId}:${projectId}`;
}

export function isPushOnlyBannerDismissed(id: ProjectIdentity): boolean {
  try {
    return localStorage.getItem(storageKey(id)) === '1';
  } catch {
    return false;
  }
}

export function dismissPushOnlyBanner(id: ProjectIdentity): void {
  try {
    localStorage.setItem(storageKey(id), '1');
  } catch {
    // ignore quota / private mode
  }
}

export function clearPushOnlyBannerDismissal(id: ProjectIdentity): void {
  try {
    localStorage.removeItem(storageKey(id));
  } catch {
    // ignore quota / private mode
  }
}
