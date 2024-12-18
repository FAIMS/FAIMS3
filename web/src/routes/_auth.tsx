import {Outlet, createFileRoute, redirect} from '@tanstack/react-router';
import NavBar from '@/components/nav-bar';

export const Route = createFileRoute('/_auth')({
  beforeLoad: ({context, location}) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div>
      <NavBar />
      <div className="p-6">
        <Outlet />
      </div>
    </div>
  );
}
