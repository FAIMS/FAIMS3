// SPDX-License-Identifier: Apache-2.0
import {Field, Form} from '@/components/form';
import {TemplateOwnerCallout} from '@/components/forms/template-owner-callout';
import {
  buildTeamField,
  getPossibleTeamsForAction,
  getTeamFieldState,
  resolveTeamId,
} from '@/components/forms/template-team-field';
import {useRequiredUser, useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {uploadMapAsset} from '@/hooks/map-asset-hooks';
import {useGetTeams} from '@/hooks/queries';
import {
  MAP_LAYER_FILE_ACCEPT,
  mapLayerFilesSchema,
} from '@/lib/map-layer-files';
import {resourceNameSchema} from '@/lib/input-limits';
import {optionalRootDescriptionField} from '@/lib/rootDescriptionField';
import {Action, INPUT_LIMITS} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';

export function CreateMapLayerForm({
  setDialogOpen,
}: {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const user = useRequiredUser();
  const queryClient = useQueryClient();
  const {data: teams} = useGetTeams({user});
  const canCreateGlobally = useIsAuthorisedTo({action: Action.CREATE_PROJECT});
  const possibleTeams = getPossibleTeamsForAction({
    teams: teams?.teams,
    canCreateGlobally,
    createInTeamAction: Action.CREATE_PROJECT_IN_TEAM,
    decodedToken: user.decodedToken,
  });
  const {showTeamCallout, showTeamDropdown} = getTeamFieldState({
    canCreateGlobally,
    possibleTeams,
  });

  const fields: Field[] = [
    {
      name: 'name',
      label: 'Name',
      description: 'A short display name for the layer',
      schema: resourceNameSchema(INPUT_LIMITS.RESOURCE_NAME_MIN_LENGTH, 'Name'),
      maxLength: INPUT_LIMITS.RESOURCE_NAME_MAX_LENGTH,
      testId: 'web-map-layers-create-name',
    },
    optionalRootDescriptionField(),
    {
      name: 'files',
      label: 'Files',
      description:
        'GeoJSON, GeoPackage, zipped shapefile, KML, GeoTIFF, georeferenced PDF, or a PNG/JPEG with a world file and a .prj. The file must have a coordinate reference system.',
      type: 'file',
      multiple: true,
      accept: MAP_LAYER_FILE_ACCEPT,
      schema: mapLayerFilesSchema(),
      testId: 'web-map-layers-create-files',
    },
  ];

  if (showTeamDropdown) {
    fields.push(
      buildTeamField({
        canCreateGlobally,
        possibleTeams,
        label: `Team${canCreateGlobally ? ' (optional)' : ''}`,
        description: canCreateGlobally
          ? 'Choose a team to own this layer, or leave blank to keep it as your own.'
          : 'The team that will own this layer.',
      })
    );
  }

  const onSubmit = async (values: {
    name: string;
    description?: string;
    files: File[];
    team?: string;
  }) => {
    const teamId = resolveTeamId({
      canCreateGlobally,
      possibleTeams,
      team: values.team,
    });
    try {
      await uploadMapAsset({
        user,
        name: values.name.trim(),
        description: values.description?.trim() ?? '',
        teamId,
        files: values.files,
      });
    } catch (error) {
      return {
        type: 'submit' as const,
        message: error instanceof Error ? error.message : 'Upload failed.',
      };
    }
    await queryClient.invalidateQueries({queryKey: ['map-assets', user.token]});
    setDialogOpen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {showTeamCallout ? (
        <TemplateOwnerCallout
          heading="Map layer will be owned by"
          teamName={possibleTeams[0].name}
        />
      ) : null}
      <Form
        fields={fields}
        onSubmit={onSubmit}
        submitButtonText="Add map layer"
        submitButtonTestId="web-map-layers-create-submit"
        defaultValues={{name: '', description: '', files: []}}
      />
    </div>
  );
}
