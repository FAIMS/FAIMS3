import {config} from '@/constants';

/**
 * Logo component renders a logo with the BSS name and version.
 */
export default function Logo() {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="shrink-0">
        <LogoIcon size={48} />
      </div>
      <div className="flex flex-col text-left text-sm leading-none min-w-0 flex-1">
        <span className="truncate font-semibold" title={config.appName}>
          {config.appName}
        </span>
        <span className="truncate text-xs" title={config.websiteTitle}>
          {config.websiteTitle}
        </span>
      </div>
    </div>
  );
}

export function LogoIcon({size = 24}: {size?: number}) {
  return (
    <img
      className="inline-block"
      src="/assets/icons/icon-192.png"
      width={size}
    />
  );
}
