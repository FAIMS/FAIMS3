import {AvpUpdateMode} from '@faims3/data-model';
import {
  Box,
  CircularProgress,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {FormNavigationContext, FullFormConfig, RedirectInfo} from '../types';

export interface BreadcrumbItem {
  label: string; // HRID
  formLabel?: string; // Form/viewset label
  recordId: string;
  mode: AvpUpdateMode;
  fieldId?: string; // For scroll target when navigating back
  lineageIndex: number; // Position in lineage array
}

export interface FormBreadcrumbsProps {
  /** Current record's form ID */
  currentFormId: string;
  /** Navigation context containing lineage */
  navigationContext: FormNavigationContext;
  /** Config for data engine and navigation */
  config: FullFormConfig;
  /** Navigate to record list */
  navigateToRecordList: {
    label: string;
    navigate: () => void;
  };
}

/**
 * Breadcrumb navigation component for form hierarchy.
 * Shows the full navigation path from record list through parent records
 * to the current record being edited.
 *
 * On mobile screens, displays a compact view with only form labels.
 * On desktop, shows full HRIDs with form labels.
 */
export const FormBreadcrumbs = ({
  currentFormId,
  navigationContext,
  config,
  navigateToRecordList,
}: FormBreadcrumbsProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Get the current form label from uiSpec
  const currentFormLabel =
    config.dataEngine().uiSpec.viewsets[currentFormId]?.label ?? currentFormId;

  // Fetch hydrated records for all lineage entries to get HRIDs
  const lineageQuery = useQuery({
    queryKey: [
      'breadcrumb-lineage',
      navigationContext.mode === 'child' ? navigationContext.lineage : [],
    ],
    queryFn: async (): Promise<BreadcrumbItem[]> => {
      if (navigationContext.mode !== 'child') {
        return [];
      }

      const engine = config.dataEngine();
      const items: BreadcrumbItem[] = [];

      for (let i = 0; i < navigationContext.lineage.length; i++) {
        const entry = navigationContext.lineage[i];
        if (!entry) continue;

        try {
          const hydrated = await engine.hydrated.getHydratedRecord({
            recordId: entry.recordId,
            revisionId: entry.revisionId,
          });

          // Get form label from uiSpec if available
          const formLabel =
            engine.uiSpec.viewsets[hydrated.record.formId]?.label;

          items.push({
            label: hydrated.hrid,
            formLabel,
            recordId: entry.recordId,
            mode: entry.parentMode,
            fieldId: entry.fieldId,
            lineageIndex: i,
          });
        } catch (error) {
          console.error(
            `Failed to hydrate record ${entry.recordId} for breadcrumb:`,
            error
          );
          // Still add entry with fallback label
          items.push({
            label: entry.recordId.slice(0, 8) + '...',
            recordId: entry.recordId,
            mode: entry.parentMode,
            fieldId: entry.fieldId,
            lineageIndex: i,
          });
        }
      }

      return items;
    },
    networkMode: 'always',
    gcTime: 0,
    staleTime: 0,
  });

  const handleBreadcrumbClick = (item: BreadcrumbItem) => {
    // Calculate how many entries to strip from the end
    const lineageLength =
      navigationContext.mode === 'child' ? navigationContext.lineage.length : 0;
    const stripCount = lineageLength - item.lineageIndex;

    const scrollTarget: RedirectInfo | undefined = item.fieldId
      ? {fieldId: item.fieldId}
      : undefined;

    config.navigation.toRecord({
      recordId: item.recordId,
      mode: item.mode,
      stripNavigationEntry: stripCount,
      scrollTarget,
    });
  };

  const breadcrumbItems = lineageQuery.data ?? [];
  const isLoading = lineageQuery.isLoading;

  // Mobile compact layout - shows only form labels
  if (isMobile) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 0.25,
          mb: 1.5,
          py: 0.5,
          px: 0.5,
          fontSize: '0.8rem',
        }}
      >
        {/* Root: Record List (shortened for mobile) */}
        <Box
          component="span"
          onClick={navigateToRecordList.navigate}
          sx={{
            color: 'primary.main',
            cursor: 'pointer',
            '&:hover': {
              textDecoration: 'underline',
            },
          }}
        >
          Records
        </Box>

        {/* Loading indicator for lineage */}
        {isLoading && (
          <>
            <Typography
              component="span"
              sx={{color: 'text.secondary', mx: 0.25}}
            >
              /
            </Typography>
            <CircularProgress size={12} />
          </>
        )}

        {/* Parent records - show only form labels on mobile */}
        {breadcrumbItems.map(item => (
          <Box key={item.recordId} sx={{display: 'flex', alignItems: 'center'}}>
            <Typography
              component="span"
              sx={{color: 'text.secondary', mx: 0.25}}
            >
              /
            </Typography>
            <Box
              component="span"
              onClick={() => handleBreadcrumbClick(item)}
              sx={{
                color: 'primary.main',
                cursor: 'pointer',
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
              title={item.label} // Show HRID on hover
            >
              {item.formLabel || item.label}
            </Box>
          </Box>
        ))}

        {/* Current record - show form label only */}
        <Box sx={{display: 'flex', alignItems: 'center'}}>
          <Typography component="span" sx={{color: 'text.secondary', mx: 0.25}}>
            /
          </Typography>
          <Typography
            component="span"
            sx={{
              color: 'text.primary',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            {currentFormLabel}
          </Typography>
        </Box>
      </Box>
    );
  }

  // Desktop full layout
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 0.5,
        mb: 2,
        py: 1,
        px: 0.5,
        fontSize: '0.875rem',
      }}
    >
      {/* Root: Record List */}
      <Box
        component="span"
        onClick={navigateToRecordList.navigate}
        sx={{
          color: 'primary.main',
          cursor: 'pointer',
          '&:hover': {
            textDecoration: 'underline',
          },
        }}
      >
        {navigateToRecordList.label}
      </Box>

      {/* Loading indicator for lineage */}
      {isLoading && (
        <>
          <Typography component="span" sx={{color: 'text.secondary', mx: 0.5}}>
            /
          </Typography>
          <CircularProgress size={14} />
        </>
      )}

      {/* Parent records from lineage */}
      {breadcrumbItems.map(item => (
        <Box key={item.recordId} sx={{display: 'flex', alignItems: 'center'}}>
          <Typography component="span" sx={{color: 'text.secondary', mx: 0.5}}>
            /
          </Typography>
          <Box
            component="span"
            onClick={() => handleBreadcrumbClick(item)}
            sx={{
              color: 'primary.main',
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            {item.formLabel && (
              <Typography
                component="span"
                sx={{color: 'text.secondary', mr: 0.5, fontSize: '0.85rem'}}
              >
                ({item.formLabel})
              </Typography>
            )}
            {item.label}
          </Box>
        </Box>
      ))}

      {/* Current record - show form label only (non-clickable) */}
      <Box sx={{display: 'flex', alignItems: 'center'}}>
        <Typography component="span" sx={{color: 'text.secondary', mx: 0.5}}>
          /
        </Typography>
        <Typography
          component="span"
          sx={{
            color: 'text.primary',
            fontWeight: 600,
            fontSize: '0.875rem',
          }}
        >
          {currentFormLabel}
        </Typography>
      </Box>
    </Box>
  );
};
