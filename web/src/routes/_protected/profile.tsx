import { useAuth } from '@/context/auth-provider'
import { Card } from '@/components/ui/card'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_protected/profile')({
  component: RouteComponent,
})

/**
 * RouteComponent component renders the profile page.
 * It displays a card with the user's profile information.
 *
 * @returns {JSX.Element} The rendered RouteComponent component.
 */
function RouteComponent() {
  const auth = useAuth()

  return (
    <Card>
      <pre className="text-xs text-wrap break-words">
        {JSON.stringify(auth.user, null, 2)}
      </pre>
    </Card>
  )
}
