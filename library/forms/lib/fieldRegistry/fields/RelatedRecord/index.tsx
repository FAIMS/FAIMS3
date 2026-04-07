import {
  canDeleteProjectRecord,
  canEditProjectRecord,
  FormRelationship,
  FormRelationshipInstance,
  HydratedRecord,
} from '@faims3/data-model';
import AddIcon from '@mui/icons-material/Add';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LinkIcon from '@mui/icons-material/Link';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import {useMemo, useState} from 'react';
import {FullFormManagerConfig} from '../../../formModule/formManagers/types';
import {BaseFieldProps, FormFieldContextProps} from '../../../formModule/types';
import {RelatedRecordRenderer} from '../../../rendering/fields/view/specialised/RelatedRecord';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';
import {
  FieldValueEntry,
  FullRelatedRecordFieldProps,
  RelatedFieldValue,
  relatedFieldValueSchema,
  RelatedRecordFieldProps,
  relatedRecordPropsSchema,
} from './types';
import {relationTypeToPair} from './utils';

// ============================================================================
// UI Components
// ============================================================================

interface RelatedRecordListItemProps {
  link: FieldValueEntry;
  queryResult: UseQueryResult<HydratedRecord | undefined, Error>;
  onNavigate: (recordId: string) => void;
  onOpenActionsMenu?: (anchor: HTMLElement, link: FieldValueEntry) => void;
}

const RelatedRecordListItem = ({
  link,
  queryResult,
  onNavigate,
  onOpenActionsMenu,
}: RelatedRecordListItemProps) => {
  const {data, isLoading, isError, error} = queryResult;

  // 1. Loading State - skeletons
  if (isLoading) {
    return (
      <ListItem disablePadding divider>
        <ListItemButton disabled>
          <ListItemIcon sx={{minWidth: 40}}>
            <CircularProgress size={20} />
          </ListItemIcon>
          <ListItemText
            primary={<Skeleton animation="wave" height={20} width="60%" />}
            secondary={<Skeleton animation="wave" height={16} width="40%" />}
          />
        </ListItemButton>
      </ListItem>
    );
  }

  // 2. Error State: Show ID and Error Icon
  if (isError || !data) {
    const errorMessage = error instanceof Error ? error.message : 'Load failed';
    return (
      <ListItem disablePadding divider>
        <ListItemButton onClick={() => onNavigate(link.record_id)}>
          <ListItemIcon sx={{minWidth: 40}}>
            <Tooltip title={`Error: ${errorMessage}`}>
              <ErrorOutlineIcon color="error" fontSize="small" />
            </Tooltip>
          </ListItemIcon>
          <ListItemText
            primary={link.record_id}
            secondary={link.relation_type_vocabPair[0] + ' (Load Error)'}
            primaryTypographyProps={{
              variant: 'body2',
              fontFamily: 'monospace',
              color: 'error',
            }}
          />
        </ListItemButton>
      </ListItem>
    );
  }

  if (data.record.deleted || data.revision.deleted) {
    return null;
  }

  // 3. Success State: Hydrated Data
  return (
    <ListItem
      disablePadding
      divider
      secondaryAction={
        onOpenActionsMenu ? (
          <IconButton
            edge="end"
            aria-label="Related record actions"
            size="small"
            onClick={e => {
              e.stopPropagation();
              onOpenActionsMenu(e.currentTarget, link);
            }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        ) : undefined
      }
    >
      <ListItemButton
        onClick={() => onNavigate(link.record_id)}
        title="Click to view record"
      >
        <ListItemIcon sx={{minWidth: 40}}>
          <LinkIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={data.hrid}
          primaryTypographyProps={{
            variant: 'body2',
            fontFamily: 'monospace',
            fontWeight: data.hrid !== link.record_id ? 'bold' : 'normal',
          }}
        />
      </ListItemButton>
    </ListItem>
  );
};

// ============================================================================
// Link Existing Record Dialog
// ============================================================================

interface LinkExistingDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (record: HydratedRecord) => Promise<void>;
  config: FullFormManagerConfig;
  relatedType: string;
  relationType: string;
  currentRecordId: string;
  excludedRecordIds: string[];
}

const LinkExistingDialog = ({
  open,
  onClose,
  onSelect,
  config,
  relatedType,
  relationType,
  excludedRecordIds,
  currentRecordId,
}: LinkExistingDialogProps) => {
  const [searchFilter, setSearchFilter] = useState('');

  // Query for available records with infinite scroll pagination
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['linkable-records', relatedType],
    queryFn: async ({pageParam}) => {
      return config.dataEngine().form.getHydratedRecords({
        formId: relatedType,
        limit: 25,
        startKey: pageParam,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage =>
      lastPage.hasMore ? lastPage.nextStartKey : undefined,
    enabled: open,
    staleTime: 0,
    refetchOnMount: 'always',
    networkMode: 'always',
  });

  // Flatten pages and filter out already-linked records + apply search
  const filteredRecords = useMemo(() => {
    if (!data?.pages) return [];

    // Set of record IDs we've already linked to from this field
    const excludedSet = new Set(excludedRecordIds);
    const allRecords = data.pages.flatMap(page => page.records);

    // Determine which relationship array to check based on relation type
    // If we're creating a Child relationship, the target record will have us as a "parent"
    // If we're creating a Linked relationship, the target record will have us as "linked"
    const relationshipKey: 'parent' | 'linked' =
      relationType === 'faims-core::Child' ? 'parent' : 'linked';

    return allRecords.filter(recordHydrationResult => {
      // Successful records only
      if (!recordHydrationResult.success) return false;

      if (recordHydrationResult.record.revision.deleted) return false;

      // Exclude records we've already linked to from this field
      if (excludedSet.has(recordHydrationResult.record.record._id))
        return false;

      // Check if this record already has a relationship of the relevant type
      // pointing back to the current record
      const existingRelationships =
        recordHydrationResult.record.revision.relationship?.[relationshipKey];

      if (existingRelationships && existingRelationships.length > 0) {
        // Filter out if any existing relationship points to the current record
        const alreadyLinkedToCurrentRecord = existingRelationships.some(
          rel => rel.recordId === currentRecordId
        );
        if (alreadyLinkedToCurrentRecord) {
          return false;
        }
      }

      // Apply search filter (case-insensitive match on hrid or recordId)
      if (searchFilter.trim()) {
        const lowerFilter = searchFilter.toLowerCase();
        return (
          recordHydrationResult.record.hrid
            .toLowerCase()
            .includes(lowerFilter) ||
          recordHydrationResult.record.record._id
            .toLowerCase()
            .includes(lowerFilter)
        );
      }

      return true;
    });
  }, [data, excludedRecordIds, searchFilter, relationType, currentRecordId]);

  const handleSelect = async (record: HydratedRecord) => {
    await onSelect(record);
    onClose();
    setSearchFilter('');
  };

  const handleClose = () => {
    onClose();
    setSearchFilter('');
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Link Existing Record</DialogTitle>
      <DialogContent>
        {/* Search/Filter Input */}
        <TextField
          fullWidth
          size="small"
          placeholder="Filter by ID..."
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          sx={{mb: 2, mt: 1}}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />

        {/* Loading State */}
        {isLoading && (
          <List dense>
            {[1, 2, 3].map(i => (
              <ListItem key={i} disablePadding divider>
                <ListItemButton disabled>
                  <ListItemIcon sx={{minWidth: 40}}>
                    <CircularProgress size={20} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Skeleton animation="wave" height={20} width="60%" />
                    }
                    secondary={
                      <Skeleton animation="wave" height={16} width="40%" />
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}

        {/* Error State */}
        {isError && (
          <Alert severity="error" sx={{mb: 2}}>
            {error instanceof Error
              ? error.message
              : 'Failed to load available records'}
          </Alert>
        )}

        {/* Empty State */}
        {!isLoading && !isError && filteredRecords.length === 0 && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{py: 4, textAlign: 'center'}}
          >
            {searchFilter.trim()
              ? 'No matching records found.'
              : 'No available records to link.'}
          </Typography>
        )}

        {/* Records List */}
        {!isLoading && !isError && (
          <Paper variant="outlined">
            <List dense disablePadding sx={{maxHeight: 300, overflow: 'auto'}}>
              {filteredRecords
                .filter(r => r.success)
                .map(recordResult => (
                  <ListItem
                    key={recordResult.record.record._id}
                    disablePadding
                    divider
                  >
                    <ListItemButton
                      onClick={async () => {
                        await handleSelect(recordResult.record);
                      }}
                    >
                      <ListItemIcon sx={{minWidth: 40}}>
                        <LinkIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={recordResult.record.hrid}
                        secondary={recordResult.record.record._id}
                        primaryTypographyProps={{
                          variant: 'body2',
                          fontFamily: 'monospace',
                          fontWeight:
                            recordResult.record.hrid !==
                            recordResult.record.record._id
                              ? 'bold'
                              : 'normal',
                        }}
                        secondaryTypographyProps={{
                          variant: 'caption',
                          fontFamily: 'monospace',
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}

              {/* Load More Button */}
              {hasNextPage && (
                <ListItem disablePadding>
                  <Box sx={{width: '100%', p: 1, textAlign: 'center'}}>
                    <Button
                      size="small"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      startIcon={
                        isFetchingNextPage ? (
                          <CircularProgress size={16} />
                        ) : null
                      }
                    >
                      {isFetchingNextPage ? 'Loading...' : 'Load More'}
                    </Button>
                  </Box>
                </ListItem>
              )}
            </List>
          </Paper>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// Preview Component (for form designer)
// ============================================================================

const RelatedRecordFieldPreview = (
  props: BaseFieldProps & FormFieldContextProps
) => {
  const typedProps = props as FullRelatedRecordFieldProps;
  const relatedRecordTypeLabel = typedProps.related_type ?? 'Record';

  return (
    <FieldWrapper
      heading={props.label}
      required={props.required}
      subheading={props.helperText}
      advancedHelperText={props.advancedHelperText}
      errors={[]}
    >
      <div style={{display: 'flex', gap: 8, marginBottom: 16}}>
        <Button
          variant="outlined"
          size="small"
          disabled
          startIcon={<AddIcon />}
        >
          Add new {relatedRecordTypeLabel}
        </Button>

        {typedProps.allowLinkToExisting && (
          <Button
            variant="outlined"
            size="small"
            disabled
            startIcon={<LinkIcon />}
          >
            Link Existing
          </Button>
        )}
      </div>

      <Typography variant="caption" display="block" color="text.secondary">
        No records linked.
      </Typography>
    </FieldWrapper>
  );
};

// ============================================================================
// Main Field Component
// ============================================================================

const FullRelatedRecordField = (props: FullRelatedRecordFieldProps) => {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [actionMenu, setActionMenu] = useState<{
    anchorEl: HTMLElement;
    link: FieldValueEntry;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FieldValueEntry | null>(
    null
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const rawValue = props.state.value?.data || undefined;

  const value = useMemo(
    () => relatedFieldValueSchema.safeParse(rawValue).data,
    [rawValue]
  );

  const normalizedLinks = useMemo(() => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  // Display label for record type
  const relatedRecordTypeLabel = useMemo(() => {
    return (
      props.config.dataEngine().uiSpec.viewsets[props.related_type]?.label ??
      props.related_type
    );
  }, [props.related_type]);

  // Mutation for creating a new related record
  const {
    mutate: createNewRecord,
    isPending: isCreating,
    isError: isCreateError,
    error: createError,
  } = useMutation({
    mutationFn: async () => {
      // Create the correct type of relationship
      let relationship: FormRelationship;
      const relation = {
        fieldId: props.fieldId,
        recordId: props.config.recordId,
        relationTypeVocabPair: relationTypeToPair(props.relation_type),
      };
      if (props.relation_type === 'faims-core::Child') {
        relationship = {
          parent: [relation],
        };
      } else {
        relationship = {
          linked: [relation],
        };
      }

      const res = await props.config.dataEngine().form.createRecord({
        createdBy: props.config.user,
        formId: props.related_type,
        relationship,
      });

      props.setFieldData([
        ...normalizedLinks,
        {
          record_id: res.record._id,
          relation_type_vocabPair: relationTypeToPair(props.relation_type),
        },
      ] satisfies RelatedFieldValue);

      await props.config.trigger.commit();
      return res;
    },
    mutationKey: [
      'create-related-record',
      props.fieldId,
      props.config.recordId,
    ],
    onSuccess: res => {
      props.config.navigation.toRecord({
        recordId: res.record._id,
        mode: 'new',
        addNavigationEntry: {
          fieldId: props.fieldId,
          // persist the current record mode
          parentMode: props.config.recordMode,
          recordId: props.config.recordId,
          relationType:
            props.relation_type === 'faims-core::Child' ? 'parent' : 'linked',
          explorationType: 'created-new-child',
        },
      });
    },
    networkMode: 'always',
    gcTime: 0,
  });

  const handleLinkExisting = async (record: HydratedRecord) => {
    // Update our field to include the new link
    props.setFieldData([
      ...normalizedLinks,
      {
        record_id: record.record._id,
        relation_type_vocabPair: relationTypeToPair(props.relation_type),
      },
    ] satisfies RelatedFieldValue);

    // Build the reciprocal relationship entry for the target record
    const relation: FormRelationshipInstance = {
      fieldId: props.fieldId,
      recordId: props.config.recordId,
      relationTypeVocabPair: relationTypeToPair(props.relation_type),
    };

    // Merge with existing relationships on the target record
    // Child relations go in 'parent' (the child points to its parent)
    // Other relations go in 'linked'
    const existing = record.revision.relationship;
    const relationship: FormRelationship =
      props.relation_type === 'faims-core::Child'
        ? {...existing, parent: [...(existing?.parent ?? []), relation]}
        : {...existing, linked: [...(existing?.linked ?? []), relation]};

    // Persist the updated relationship on the target record's revision
    await props.config.dataEngine().hydrated.updateRevision({
      ...record.revision,
      relationship,
    });
  };

  // Fetch and hydrate all related records
  const relatedRecordQueries = useQueries({
    queries: normalizedLinks.map(({record_id}) => ({
      queryKey: ['related-hydration', record_id],
      queryFn: async () => {
        const record = await props.config
          .dataEngine()
          .hydrated.getHydratedRecord({
            recordId: record_id,
            config: {conflictBehaviour: 'pickLast'},
          });

        return record ?? undefined;
      },
      networkMode: 'always',
      staleTime: 0,
      refetchOnMount: true,
    })),
  });

  // Navigates to an existing link
  const handleLinkClick = (recordId: string) => {
    props.config.navigation.toRecord({
      recordId: recordId,
      mode: props.config.recordMode,
      addNavigationEntry: {
        fieldId: props.fieldId,
        parentMode: props.config.recordMode,
        recordId: props.config.recordId,
        relationType:
          props.relation_type === 'faims-core::Child' ? 'parent' : 'linked',
        explorationType: 'visited',
      },
    });
  };

  const handleDetachLink = async (link: FieldValueEntry) => {
    const engine = props.config.dataEngine();
    const peer = await engine.hydrated.getHydratedRecord({
      recordId: link.record_id,
      config: {conflictBehaviour: 'pickLast'},
    });
    if (
      !canEditProjectRecord({
        decodedToken: props.config.decodedToken,
        projectId: props.config.projectId,
        recordCreatedBy: peer.record.createdBy,
        actingUserId: props.config.user,
      })
    ) {
      return;
    }
    const rel = peer.revision.relationship;
    const linked = rel?.linked ?? [];
    const newLinked = linked.filter(
      inst =>
        !(
          inst.recordId === props.config.recordId &&
          inst.fieldId === props.fieldId
        )
    );
    await engine.hydrated.updateRevision({
      ...peer.revision,
      relationship: {
        ...(rel ?? {}),
        linked: newLinked,
      },
    });
    const remaining = normalizedLinks.filter(
      l => l.record_id !== link.record_id
    );
    const next: RelatedFieldValue | undefined =
      remaining.length === 0
        ? undefined
        : props.multiple
          ? remaining
          : remaining[0];
    props.setFieldData(next as RelatedFieldValue);
    await props.config.trigger.commit();
    await queryClient.invalidateQueries({queryKey: ['related-hydration']});
  };

  const handleConfirmDeleteRelated = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      const engine = props.config.dataEngine();
      const peer = await engine.hydrated.getHydratedRecord({
        recordId: deleteTarget.record_id,
        config: {conflictBehaviour: 'pickLast'},
      });
      if (
        !canDeleteProjectRecord({
          decodedToken: props.config.decodedToken,
          projectId: props.config.projectId,
          recordCreatedBy: peer.record.createdBy,
          actingUserId: props.config.user,
        })
      ) {
        setDeleteError('You do not have permission to delete this record.');
        return;
      }
      await engine.deleteRecord({
        recordId: deleteTarget.record_id,
        baseRevisionId: peer.revision._id,
        userId: props.config.user,
      });
      await queryClient.invalidateQueries({queryKey: ['related-hydration']});
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : 'Could not delete this record.'
      );
    }
  };

  // Extract already-linked record IDs for filtering
  const linkedRecordIds = useMemo(
    () => normalizedLinks.map(link => link.record_id),
    [normalizedLinks]
  );

  const allRelatedHydrationDone = relatedRecordQueries.every(q => !q.isPending);
  const allRelatedHydrationSucceeded = relatedRecordQueries.every(q => q.isSuccess);
  const visibleRelatedLinkCount = relatedRecordQueries.reduce((n, q) => {
    const d = q.data;
    if (!d || d.record.deleted || d.revision.deleted) {
      return n;
    }
    return n + 1;
  }, 0);
  const showOnlyDeletedLinksHint =
    normalizedLinks.length > 0 &&
    allRelatedHydrationDone &&
    allRelatedHydrationSucceeded &&
    visibleRelatedLinkCount === 0;

  const linkHasDestructiveActions = (index: number): boolean => {
    const d = relatedRecordQueries[index]?.data;
    if (!d || d.record.deleted || d.revision.deleted) {
      return false;
    }
    const {decodedToken, projectId, user} = props.config;
    const createdBy = d.record.createdBy;
    const canDel = canDeleteProjectRecord({
      decodedToken,
      projectId,
      recordCreatedBy: createdBy,
      actingUserId: user,
    });
    const canEditPeer = canEditProjectRecord({
      decodedToken,
      projectId,
      recordCreatedBy: createdBy,
      actingUserId: user,
    });
    const canDetach =
      props.relation_type === 'faims-core::Linked' && canEditPeer;
    return canDel || canDetach;
  };

  const menuPeerIndex =
    actionMenu === null
      ? -1
      : normalizedLinks.findIndex(l => l.record_id === actionMenu.link.record_id);
  const menuPeerRecord =
    menuPeerIndex >= 0 ? relatedRecordQueries[menuPeerIndex]?.data : undefined;

  return (
    <>
      {/* Error Alert for Creation */}
      {isCreateError && (
        <Alert severity="error" sx={{mb: 2}}>
          {createError instanceof Error
            ? createError.message
            : 'An error occurred creating the record'}
        </Alert>
      )}

      {/* Action Buttons */}
      <div style={{display: 'flex', gap: 8, marginBottom: 16}}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => createNewRecord()}
          disabled={isCreating}
          startIcon={
            isCreating ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <AddIcon />
            )
          }
        >
          {isCreating ? 'Creating...' : 'Add new ' + relatedRecordTypeLabel}
        </Button>

        {props.allowLinkToExisting && (
          <Button
            variant="outlined"
            size="small"
            onClick={() => setLinkDialogOpen(true)}
            startIcon={<LinkIcon />}
          >
            Link Existing
          </Button>
        )}
      </div>

      {/* Link Existing Dialog */}
      {props.allowLinkToExisting && (
        <LinkExistingDialog
          open={linkDialogOpen}
          currentRecordId={props.config.recordId}
          onClose={() => setLinkDialogOpen(false)}
          onSelect={handleLinkExisting}
          config={props.config}
          relatedType={props.related_type}
          relationType={props.relation_type}
          excludedRecordIds={linkedRecordIds}
        />
      )}

      {/* Linked Records List */}
      {normalizedLinks.length > 0 ? (
        <>
          <Paper variant="outlined">
            <List dense disablePadding>
              {normalizedLinks.map((link, index) => (
                <RelatedRecordListItem
                  key={link.record_id}
                  link={link}
                  queryResult={relatedRecordQueries[index]}
                  onNavigate={handleLinkClick}
                  onOpenActionsMenu={
                    linkHasDestructiveActions(index)
                      ? (anchorEl, l) =>
                          setActionMenu({anchorEl, link: l})
                      : undefined
                  }
                />
              ))}
            </List>
          </Paper>
          {showOnlyDeletedLinksHint && (
            <Typography
              variant="caption"
              display="block"
              color="text.secondary"
              sx={{mt: 1}}
            >
              Linked records are not shown because they have been deleted. Links
              are kept if a record is restored.
            </Typography>
          )}
        </>
      ) : (
        <Typography variant="caption" display="block" color="text.secondary">
          No records linked.
        </Typography>
      )}

      <Menu
        anchorEl={actionMenu?.anchorEl ?? null}
        open={Boolean(actionMenu)}
        onClose={() => setActionMenu(null)}
      >
        {props.relation_type === 'faims-core::Linked' &&
          menuPeerRecord &&
          canEditProjectRecord({
            decodedToken: props.config.decodedToken,
            projectId: props.config.projectId,
            recordCreatedBy: menuPeerRecord.record.createdBy,
            actingUserId: props.config.user,
          }) && (
            <MenuItem
              onClick={() => {
                const target = actionMenu?.link;
                setActionMenu(null);
                if (target) void handleDetachLink(target);
              }}
            >
              Detach link
            </MenuItem>
          )}
        {menuPeerRecord &&
          canDeleteProjectRecord({
            decodedToken: props.config.decodedToken,
            projectId: props.config.projectId,
            recordCreatedBy: menuPeerRecord.record.createdBy,
            actingUserId: props.config.user,
          }) && (
            <MenuItem
              onClick={() => {
                if (actionMenu) {
                  setDeleteTarget(actionMenu.link);
                }
                setActionMenu(null);
              }}
            >
              Delete record…
            </MenuItem>
          )}
      </Menu>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      >
        <DialogTitle>Delete related record?</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{mb: 1}}>
              {deleteError}
            </Alert>
          )}
          <Typography variant="body2">
            This deletes the linked record (soft delete), the same as deleting it
            from its own record page. Links from this record are kept so the
            record can be restored if needed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteTarget(null);
              setDeleteError(null);
            }}
          >
            Cancel
          </Button>
          <Button
            color="error"
            onClick={() => void handleConfirmDeleteRelated()}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const RelatedRecordField = (props: BaseFieldProps & FormFieldContextProps) => {
  if (props.config.mode === 'preview') {
    return <RelatedRecordFieldPreview {...props} />;
  } else {
    return (
      <FieldWrapper
        heading={props.label}
        required={props.required}
        subheading={props.helperText}
        advancedHelperText={props.advancedHelperText}
        errors={props.state.meta.errors as unknown as string[]}
      >
        <FullRelatedRecordField {...(props as FullRelatedRecordFieldProps)} />
      </FieldWrapper>
    );
  }
};

// generate a zod schema for the value.
const valueSchemaFunction = (props: RelatedRecordFieldProps) => {
  // 1. If required is true
  if (props.required) {
    return relatedFieldValueSchema.refine(
      val => {
        // If it is an array, ensure it has at least one item
        if (Array.isArray(val)) {
          return val.length > 0;
        }
        // If it is a single object (and matches the schema), it is valid
        return !!val;
      },
      {message: 'At least one related record is required.'}
    );
  }

  // 2. If required is false
  // Allow null, undefined, or valid schema (including empty array)
  return relatedFieldValueSchema.optional().nullable();
};

export const relatedRecordFieldSpec: FieldInfo = {
  namespace: 'faims-custom',
  name: 'RelatedRecordSelector',
  returns: 'faims-core::Relationship',
  component: RelatedRecordField,
  fieldPropsSchema: relatedRecordPropsSchema,
  fieldDataSchemaFunction: valueSchemaFunction,
  view: {
    component: RelatedRecordRenderer,
    config: {},
    attributes: {singleColumn: true},
  },
};
