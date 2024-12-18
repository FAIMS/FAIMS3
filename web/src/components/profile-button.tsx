import {User} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {useRouter} from '@tanstack/react-router';
import {useAuth} from '@/auth';
import {sleep} from '@/utils';

export function ProfileButton() {
  const router = useRouter();
  const auth = useAuth();

  const handleLogout = async () => {
    await auth.logout();

    await sleep(1);

    await router.navigate({to: '/login'});
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <User className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Profile</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <button onClick={handleLogout} className="w-full text-left">
            Logout
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
