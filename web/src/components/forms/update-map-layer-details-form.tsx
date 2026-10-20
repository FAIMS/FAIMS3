// SPDX-License-Identifier: Apache-2.0
import {Form} from '@/components/form';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {
  invalidateMapAssets,
  updateMapAssetDetails,
} from '@/hooks/map-asset-hooks';
import {resourceNameSchema} from '@/lib/input-limits';
import {optionalRootDescriptionField} from '@/lib/rootDescriptionField';
import {INPUT_LIMITS} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';

/** PATCH name and description for an existing layer. */
export function UpdateMapLayerDetailsForm({
  assetId,
  name,
  description,
  setDialogOpen,
}: {
  assetId: string;
  name: string;
  description: string;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const user = useRequiredUser();
  const queryClient = useQueryClient();

  const onSubmit = async ({
    name: nextName,
    description: nextDescription,
  }: {
    name: string;
    description?: string;
  }) => {
    try {
      await updateMapAssetDetails({
        user,
        assetId,
        name: nextName.trim(),
        description: nextDescription?.trim() ?? '',
      });
    } catch (error) {
      return {
        type: 'submit' as const,
        message:
          error instanceof Error ? error.message : 'Could not save details.',
      };
    }
    await invalidateMapAssets(queryClient, user, assetId);
    setDialogOpen(false);
  };

  return (
    <Form
      fields={[
        {
          name: 'name',
          label: 'Name',
          schema: resourceNameSchema(
            INPUT_LIMITS.RESOURCE_NAME_MIN_LENGTH,
            'Name'
          ),
          maxLength: INPUT_LIMITS.RESOURCE_NAME_MAX_LENGTH,
        },
        optionalRootDescriptionField(),
      ]}
      defaultValues={{name, description}}
      onSubmit={onSubmit}
      submitButtonText="Save details"
    />
  );
}
