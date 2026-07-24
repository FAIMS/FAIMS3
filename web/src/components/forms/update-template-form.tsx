import {useRequiredUser} from '@/hooks/auth-hooks';
import {Form} from '@/components/form';
import {readFileAsText} from '@/lib/utils';
import {designFileSchema} from '@/lib/input-limits';
import {config} from '@/constants';
import {Route} from '@/routes/_protected/templates/$templateId';
import {
  errorMessageFromTemplateJsonBody,
  updateTemplateUiSpecificationRequest,
} from '@/hooks/template-hooks';
import {prepareNotebookUiSpecificationInputForApi} from '@faims3/data-model';

export const fields = [
  {
    name: 'file',
    type: 'file',
    schema: designFileSchema(),
  },
];

interface UpdateTemplateFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onSuccess: () => void;
}

/**
 * UpdateTemplateForm replaces the template design via PUT
 * /api/templates/:templateId/uiSpecification. Accepts legacy or current
 * notebook JSON (same loose validation as create-from-file).
 */
export function UpdateTemplateForm({
  setDialogOpen,
  onSuccess,
}: UpdateTemplateFormProps) {
  const user = useRequiredUser();
  const {templateId} = Route.useParams();

  const onSubmit = async ({file}: {file: File}) => {
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

    const uiResponse = await updateTemplateUiSpecificationRequest({
      user,
      templateId,
      uiSpecification: prepared.uiSpecification,
    });
    if (!uiResponse.ok) {
      const json: unknown = await uiResponse.json().catch(() => undefined);
      return {
        type: 'submit',
        message:
          'Error updating template design: ' +
          errorMessageFromTemplateJsonBody(json, uiResponse.statusText),
      };
    }

    onSuccess();
    setDialogOpen(false);
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText="Replace Template JSON"
      submitButtonVariant="destructive"
      warningMessage={`Editing the template does not change any of the ${config.notebookName}s created from it.  This may create inconsistencies in your data.`}
    />
  );
}
