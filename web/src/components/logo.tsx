import {APP_NAME, WEBSITE_TITLE} from '@/constants';
import {cn} from '@/lib/utils';

/**
 * Logo component renders a logo with the BSS name and version.
 *
 * @param {string} className - The class name for the logo element.
 * @returns {JSX.Element} The rendered Logo component.
 */
export default function Logo({className}: {className?: string}) {
  return (
    <div className="flex gap-2">
      <div>
        <img src="/assets/icons/icon-48.webp" />
      </div>
      <div className="flex flex-col text-left text-sm leading-none">
        <span className="truncate font-semibold">{APP_NAME}</span>
        <span className="truncate text-xs">{WEBSITE_TITLE}</span>
      </div>
    </div>
  );
}
