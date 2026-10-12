// SPDX-License-Identifier: Apache-2.0
import {Form} from '@/components/form';
import {MapLayerQualitySlider} from '@/components/forms/map-layer-quality-slider';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {replaceMapAssetFiles} from '@/hooks/map-asset-hooks';
import {DEFAULT_MAP_ASSET_QUALITY} from '@faims3/data-model';
import {
  MAP_LAYER_FILE_ACCEPT,
  mapLayerFilesSchema,
} from '@/lib/map-layer-files';
import {useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';

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
  const [quality, setQuality] = useState(DEFAULT_MAP_ASSET_QUALITY);
  const [files, setFiles] = useState<File[]>([]);

  const onSubmit = async ({files}: {files: File[]}) => {
    setUploadProgress(0);
    try {
      await replaceMapAssetFiles({
        user,
        assetId,
        files,
        quality,
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
      submitProgress={uploadProgress}
      watch={{
        files: value => setFiles(Array.isArray(value) ? value : []),
      }}
      footer={
        <MapLayerQualitySlider
          quality={quality}
          onQualityChange={setQuality}
          files={files}
        />
      }
    />
  );
}
