import {useRequiredUser} from '@/hooks/auth-hooks';
import {Form} from '@/components/form';
import {readFileAsText} from '@/lib/utils';
import {designFileSchema} from '@/lib/input-limits';
import {config} from '@/constants';
import {Route} from '@/routes/_protected/projects/$projectId';
import {
  errorMessageFromNotebookJsonBody,
  updateNotebookUiSpecificationRequest,
} from '@/hooks/project-hooks';
import {convertXlsformToUiSpecification} from '@/hooks/xlsform-hooks';
import {prepareNotebookUiSpecificationInputForApi} from '@faims3/data-model';
import {toast} from 'sonner';

const fields = [
  {
    name: 'file',
    type: 'file',
    schema: designFileSchema(),
  },
];

/**
 * UpdateProjectForm replaces the project notebook design via PUT
 * /api/notebooks/:projectId/uiSpecification. Accepts legacy or current
 * notebook JSON, or an XLSForm (.xlsx) file, which is converted via
 * POST /api/convert-xlsform before being sent through the same update call.
 */
export function UpdateProjectForm({
  setDialogOpen,
  onSuccess,
}: {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onSuccess: () => void;
}) {
  const user = useRequiredUser();
  const {projectId} = Route.useParams();

  const onSubmit = async ({file}: {file: File}) => {
    const isXlsform = file.name.toLowerCase().endsWith('.xlsx');
    let uiSpecification: unknown;
    let skippedFromConversion: {name: string; type: string}[] = [];

    if (isXlsform) {
      const converted = await convertXlsformToUiSpecification({user, file});
      if (!converted.ok) {
        return {type: 'submit', message: converted.message};
      }
      uiSpecification = converted.uiSpecification;
      skippedFromConversion = converted.skipped;
    } else {
      const jsonString = await readFileAsText(file);
      if (!jsonString) return {type: 'submit', message: 'Error reading file'};
      let payload: unknown;
      try {
        payload = JSON.parse(jsonString);
      } catch {
        return {type: 'submit', message: 'Invalid JSON file'};
      }
      const prepared = prepareNotebookUiSpecificationInputForApi(payload);
      if (!prepared.ok) {
        return {type: 'submit', message: prepared.message};
      }
      uiSpecification = prepared.uiSpecification;
    }

    const uiResponse = await updateNotebookUiSpecificationRequest({
      user,
      projectId,
      uiSpecification,
    });
    if (!uiResponse.ok) {
      const json: unknown = await uiResponse.json().catch(() => undefined);
      return {
        type: 'submit',
        message:
          'Error updating project design: ' +
          errorMessageFromNotebookJsonBody(json, uiResponse.statusText),
      };
    }

    onSuccess();
    setDialogOpen(false);

    if (skippedFromConversion.length > 0) {
      const summary = skippedFromConversion
        .map(s => `${s.name} (${s.type})`)
        .join(', ');
      toast.warning(
        `${config.notebookNameCapitalized} design updated, but ${skippedFromConversion.length} question${skippedFromConversion.length === 1 ? '' : 's'} could not be converted: ${summary}`,
        {duration: 15000}
      );
    } else if (isXlsform) {
      toast.success(
        `${config.notebookNameCapitalized} design updated successfully`
      );
    }
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText={`Replace ${config.notebookNameCapitalized} JSON`}
      submitButtonVariant="destructive"
      warningMessage={
        "If the project's response format has changed, there will be inconsistences in responses."
      }
    />
  );
}
