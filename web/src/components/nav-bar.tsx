import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import {Link} from '@tanstack/react-router';
import {ModeToggle} from './mode-toggle';
import {ProfileButton} from './profile-button';

const navItems = [
  {name: 'Home', href: '/'},
  {name: 'About', href: '/about'},
];

export default function NavBar() {
  return (
    <div className="flex border-b p-2 justify-between w-full">
      <NavigationMenu>
        <NavigationMenuList>
          {navItems.map(({name, href}) => (
            <NavigationMenuItem>
              <Link href={href}>
                <NavigationMenuLink
                  key={name}
                  className={navigationMenuTriggerStyle()}
                >
                  {name}
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <ModeToggle />
          </NavigationMenuItem>
          <NavigationMenuItem>
            <ProfileButton />
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}
