// SPDX-License-Identifier: Apache-2.0
import {Form} from '@/components/form';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {
  invalidateMapAssets,
  replaceMapAssetFiles,
} from '@/hooks/map-asset-hooks';
import {
  MAP_LAYER_FILE_ACCEPT,
  mapLayerFilesSchema,
} from '@/lib/map-layer-files';
import {useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';

/** Re-upload files for an existing layer and restart processing. */
export function ReplaceMapLayerForm({
  assetId,
  setDialogOpen,
}: {
  assetId: string;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const user = useRequiredUser();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  /** Replace the layer files and leave details (name, links) unchanged. */
  const onSubmit = async ({files}: {files: File[]}) => {
    setUploadProgress(0);
    try {
      await replaceMapAssetFiles({
        user,
        assetId,
        files,
        onProgress: setUploadProgress,
      });
    } catch (error) {
      return {
        type: 'submit' as const,
        message: error instanceof Error ? error.message : 'Replacement failed.',
      };
    } finally {
      setUploadProgress(null);
    }
    await invalidateMapAssets(queryClient, user, assetId);
    setDialogOpen(false);
  };

  return (
    <Form
      fields={[
        {
          name: 'files',
          type: 'file',
          multiple: true,
          accept: MAP_LAYER_FILE_ACCEPT,
          schema: mapLayerFilesSchema(),
        },
      ]}
      defaultValues={{files: []}}
      onSubmit={onSubmit}
      submitButtonText="Upload replacement"
      submitProgress={uploadProgress}
      warningMessage="Users with this map layer action will lose access to the old layer while the replacement is being processed."
    />
  );
}
