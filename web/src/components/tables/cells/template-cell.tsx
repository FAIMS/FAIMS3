import {Skeleton} from '@/components/ui/skeleton';
import {useAuth} from '@/context/auth-provider';
import {useGetTemplate} from '@/hooks/queries';
import {Link} from '@tanstack/react-router';

interface TemplateCellComponentProps {
  templateId: string;
}

/**
 * Component: TemplateCellComponent
 * Renders a team name as a clickable link in a table cell
 */
export const TemplateCellComponent = ({
  templateId,
}: TemplateCellComponentProps) => {
  const {user} = useAuth();

  if (!user) {
    return <p>Unauthenticated</p>;
  }

  const {data: template, isLoading, isError} = useGetTemplate(user, templateId);

  return isLoading ? (
    <Skeleton className="h-5 w-24" />
  ) : (
    <div
      className="w-full h-full"
      onClick={e => {
        // Prevent event propagation to avoid conflicts with table row click handlers
        e.stopPropagation();
      }}
    >
      <Link
        to="/templates/$templateId"
        disabled={!template}
        params={{templateId}}
        className={
          'text-gray-700' + template
            ? ' hover:text-gray-900 cursor-pointer transition-colors'
            : ''
        }
      >
        {isError
          ? templateId
          : isLoading
            ? 'Loading...'
            : (template?.name ?? templateId)}
      </Link>
    </div>
  );
};
