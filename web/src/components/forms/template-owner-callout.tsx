/**
 * Read-only team hint shown when the user has no team choice (must create in
 * the sole team they can access). For optional team selection use the dropdown
 * from {@link buildTeamField} instead.
 */
export function TemplateOwnerCallout({
  teamName,
  heading = 'Template will be owned by',
}: {
  teamName: string;
  /** Short label above the team name; defaults to template ownership copy. */
  heading?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{heading}</p>
      <p className="text-sm font-medium">{teamName}</p>
    </div>
  );
}
