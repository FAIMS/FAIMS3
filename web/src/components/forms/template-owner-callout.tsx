export function TemplateOwnerCallout({teamName}: {teamName: string}) {
  return (
    <div className="rounded-md border border-border bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">Template will be owned by</p>
      <p className="text-sm font-medium">{teamName}</p>
    </div>
  );
}
