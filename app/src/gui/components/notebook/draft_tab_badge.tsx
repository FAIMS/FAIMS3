import {Badge, CircularProgress} from '@mui/material';

export default function DraftTabBadge({
  count,
  loading,
}: {
  count: number;
  loading: boolean;
}) {
  return (
    <Badge
      badgeContent={
        loading ? (
          <CircularProgress size={10} sx={{color: 'white'}} thickness={6} />
        ) : (
          count
        )
      }
      color="primary"
    >
      <span style={{paddingRight: '10px'}}>Drafts{'  '}</span>
    </Badge>
  );
}
