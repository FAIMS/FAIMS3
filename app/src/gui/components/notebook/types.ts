import {
  type CompiledNotebookUiSpec,
  type MinimalRecordMetadata,
  type RecordStatusReport,
  type RegisteredPlan,
} from '@faims3/data-model';
import {Project} from '../../../context/slices/projectSlice';
import {RecordStatus} from '../../../utils/recordAudit';

/**
 * The explicit prop contract for a notebook view.  Includes the
 * project and various artefacts and function references
 * that a view component may need to render the notebook
 *
 * This interfaces is abstracted a little from the internal app
 * apis so that it can be a more abstract API for view components
 * to use, not so closely tied to the app state/architecture.
 */

interface RecordListProps {
  // The records the plan on screen claims, scoped before they reach a view, so
  // a view and the components it is handed answer alike. The whole notebook
  // when no plan is on screen.
  allRecords: MinimalRecordMetadata[];
  // The current sync status of the records in the notebook
  syncStatus: RecordStatus;
  // Recursive completion report per record claiming a plan reference
  // (recordId -> report); entries appear as each record's report computes
  planRecordStatusReports: ReadonlyMap<string, RecordStatusReport>;
}

interface StatusProps {
  // Is the record list still unloaded (loading, or errored and retrying):
  // while true, the record lists' contents are meaningless
  isLoading: boolean;
  // Is the user allowed to add records to the notebook
  isAllowedToAddRecords: boolean;
  // Can the user read every record in the notebook. When false, the record
  // lists hold only the records the user may see (their own), so a view must
  // not present a record's absence as proof that none exists.
  canReadAllRecords: boolean;
  // Is a record download (the initial pull after activation, or a catch-up
  // pull) underway. While true, records that exist on the server may be
  // missing from the local lists, so a view must not present a record's
  // absence as proof that none exists. Always false when the notebook never
  // pulls (sync off, or push-only).
  isDownloadingRecords: boolean;
}

interface ActionProps {
  // Refresh the record list from the local database
  refreshRecordList: () => void;
  // Set the query for the record list
  setQuery: (query: string) => void;
  // Create a new record of the given viewset type. Resolves when the create
  // has settled (navigated away on success, or surfaced its own error), so a
  // caller can await it to re-enable UI it disabled for the duration.
  createRecord: (
    viewsetName: string,
    data: Record<string, any>,
    planReference?: string
  ) => Promise<void>;
  // Navigate to the view page for the given record
  navigateToRecord: (record: MinimalRecordMetadata) => void;
  // Show the given tab, putting its slug in the URL
  setTab: (tab: string) => void;
}

// Components that might be used in the notebook display
interface ComponentProps {
  NotebookSettings: React.ComponentType<{}>;
  MetadataDisplayComponent: React.ComponentType<{}>;
  OverviewMap: React.ComponentType<{}>;
}

export interface NotebookViewComponentProps {
  project: Project;
  // The tab slug from the URL, which a view resolves with `useResolveTab`.
  // Scoped to this view's plan: the plan has a route segment of its own, so
  // this is only ever the view's own slug.
  tab?: string;
  // The plan instance this view is rendering. A notebook may carry several, so
  // a view must read this rather than reaching into the project for `plan`.
  plan?: RegisteredPlan;
  uiSpecification: CompiledNotebookUiSpec;
  records: RecordListProps;
  actions: ActionProps;
  status: StatusProps;
  components: ComponentProps;
}
