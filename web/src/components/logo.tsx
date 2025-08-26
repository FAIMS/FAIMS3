import {APP_NAME, WEBSITE_TITLE} from '@/constants';

/**
 * Logo component renders a logo with the BSS name and version.
 */
export default function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div>
        <LogoIcon size={48} />
      </div>
      <div className="flex flex-col text-left text-sm leading-none">
        <span className="truncate font-semibold">{APP_NAME}</span>
        <span className="truncate text-xs">{WEBSITE_TITLE}</span>
      </div>
    </div>
  );
}

export function LogoIcon({size = 24}: {size?: number}) {
  return (
    <img
      className="inline-block"
      src="/assets/icons/icon-48.webp"
      width={size}
    />
  );
}
