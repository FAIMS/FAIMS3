import {getVisibleTypes} from '@faims3/data-model';
import {useMemo} from 'react';
import {ListOfFormsView} from './ListOfFormsView';
import {NotebookViewComponentProps} from './types';

/**
 * DefaultNotebookView is the default notebook view, used when a notebook has
 * no plan or no view is registered for its plan type. It is the list of forms
 * view configured from the notebook's visible forms, and conforms to
 * NotebookViewComponentProps like any registered plan view.
 *
 * @param props - The notebook view props assembled by NotebookView.
 * @returns The JSX element for the DefaultNotebookView.
 */
export default function DefaultNotebookView(props: NotebookViewComponentProps) {
  const {uiSpecification} = props;
  const formTypes = useMemo(
    () => getVisibleTypes(uiSpecification),
    [uiSpecification]
  );
  return <ListOfFormsView {...props} formTypes={formTypes} />;
}
