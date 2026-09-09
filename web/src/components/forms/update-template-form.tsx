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
import {toast} from 'sonner';
import {convertXlsformToUiSpecification} from '@/hooks/xlsform-hooks';

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

    const uiResponse = await updateTemplateUiSpecificationRequest({
      user,
      templateId,
      uiSpecification,
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

    if (skippedFromConversion.length > 0) {
      const summary = skippedFromConversion
        .map(s => `${s.name} (${s.type})`)
        .join(', ');
      toast.warning(
        `Template design updated, but ${skippedFromConversion.length} question${skippedFromConversion.length === 1 ? '' : 's'} could not be converted: ${summary}`,
        {duration: 15000}
      );
    } else if (isXlsform) {
      toast.success('Template design updated successfully');
    }
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText="Replace Template"
      submitButtonVariant="destructive"
      warningMessage={`Editing the template does not change any of the ${config.notebookName}s created from it.  This may create inconsistencies in your data.`}
    />
  );
}
