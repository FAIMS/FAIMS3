import {useAuth, User} from '@/context/auth-provider';
import {Card} from '@/components/ui/card';
import {createFileRoute} from '@tanstack/react-router';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';

export const Route = createFileRoute('/_protected/profile')({
  component: RouteComponent,
});

const userFields: {field: keyof User['user']; label: string}[] = [
  {field: 'id', label: 'Email'},
  {field: 'name', label: 'Name'},
];

/**
 * RouteComponent component renders the user's profile page.
 * It displays a card with the user's profile information and a button to copy the bearer token.
 * The bearer token can be used to authenticate in scripts that use the API.
 * @returns {JSX.Element} The rendered RouteComponent component.
 */
function RouteComponent() {
  const {user} = useAuth();

  return (
    <div className="flex lg:flex-row flex-col gap-4">
      <Card className="flex-1">
        <List>
          {userFields.map(({field, label}) => (
            <ListItem key={field}>
              <ListLabel>{label}</ListLabel>
              <ListDescription>{user?.user[field]}</ListDescription>
            </ListItem>
          ))}
        </List>
      </Card>
      <Card className="flex-1">
        <ListItem className="flex flex-col gap-2">
          <ListLabel>Bearer Token</ListLabel>
          <ListDescription>
            Click below to copy the token that can be used to authenticate in
            scripts that use the API.
          </ListDescription>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(user?.token || '');
                toast('Bearer token copied to clipboard successfully! 🎉');
              } catch (error) {
                toast.error('Failed to copy bearer token to clipboard');
              }
            }}
          >
            Copy Bearer Token to Clipboard
          </Button>
        </ListItem>
      </Card>
    </div>
  );
}
