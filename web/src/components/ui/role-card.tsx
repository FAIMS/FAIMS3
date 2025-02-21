/**
 * Role component renders a role in a table cell.
 *
 * @param {string} role - The role to render.
 * @returns {JSX.Element} The rendered Role component.
 */
export default function RoleCard({children}: {children: React.ReactNode}) {
  return (
    <div className="bg-muted text-muted-foreground px-2 py-1 rounded-md w-fit">
      {children}
    </div>
  );
}
