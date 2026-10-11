// SPDX-License-Identifier: Apache-2.0
import {Form} from '@/components/form';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {replaceMapAssetFiles} from '@/hooks/map-asset-hooks';
import {
  MAP_LAYER_FILE_ACCEPT,
  mapLayerFilesSchema,
} from '@/lib/map-layer-files';
import {useQueryClient} from '@tanstack/react-query';

export function ReplaceMapLayerForm({
  assetId,
  setDialogOpen,
}: {
  assetId: string;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const user = useRequiredUser();
  const queryClient = useQueryClient();

  const onSubmit = async ({files}: {files: File[]}) => {
    try {
      await replaceMapAssetFiles({user, assetId, files});
    } catch (error) {
      return {
        type: 'submit' as const,
        message: error instanceof Error ? error.message : 'Replacement failed.',
      };
    }
    await queryClient.invalidateQueries({queryKey: ['map-assets', user.token]});
    setDialogOpen(false);
  };

  return (
    <Form
      fields={[
        {
          name: 'files',
          label: 'Replacement files',
          description:
            'The same formats as a new layer. Surveys keep the link and pick up the new file once processing finishes.',
          type: 'file',
          multiple: true,
          accept: MAP_LAYER_FILE_ACCEPT,
          schema: mapLayerFilesSchema(),
        },
      ]}
      defaultValues={{files: []}}
      onSubmit={onSubmit}
      submitButtonText="Upload replacement"
    />
  );
}
