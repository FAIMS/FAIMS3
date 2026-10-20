// SPDX-License-Identifier: Apache-2.0
import {MapLayerActions} from '@/components/tabs/map-layers/actions';
import {MapLayerDetails} from '@/components/tabs/map-layers/details';
import {MapLayerLinkedSurveys} from '@/components/tabs/map-layers/linked-surveys';
import {MapLayerPreviewTab} from '@/components/tabs/map-layers/preview';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {config} from '@/constants';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {useMapAsset} from '@/hooks/map-asset-hooks';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {canMutateMapAsset} from '@/lib/map-layer-permissions';
import {createFileRoute, useRouter} from '@tanstack/react-router';
import {useMemo} from 'react';

const tabs = [
  {name: 'Details', Component: MapLayerDetails},
  {name: 'Preview', Component: MapLayerPreviewTab},
  {
    name: `Linked ${config.notebookNamePluralCapitalized}`,
    Component: MapLayerLinkedSurveys,
  },
  {name: 'Actions', Component: MapLayerActions},
];

export const Route = createFileRoute('/_protected/map-layers/$assetId')({
  component: MapLayerPage,
});

/** Control Centre page for one map layer (details, preview, links, actions). */
function MapLayerPage() {
  const {assetId} = Route.useParams();
  const user = useRequiredUser();
  const {data, isLoading} = useMapAsset({user, assetId});
  const pathname = useRouter().state.location.pathname;
  const paths = useMemo(
    () => [
      {path: '/map-layers', label: 'Map layers'},
      {path: pathname, label: data?.name ?? assetId},
    ],
    [pathname, data?.name, assetId]
  );
  const visibleTabs = useMemo(
    () =>
      data && canMutateMapAsset(user, data)
        ? tabs
        : tabs.filter(tab => tab.name !== 'Actions'),
    [data, user]
  );

  useBreadcrumbUpdate({isLoading, paths});

  return (
    <Tabs defaultValue={visibleTabs[0].name}>
      <TabsList>
        {visibleTabs.map(({name}) => (
          <TabsTrigger key={name} value={name}>
            {name}
          </TabsTrigger>
        ))}
      </TabsList>
      {visibleTabs.map(({name, Component}) => (
        <TabsContent key={name} value={name}>
          <Component assetId={assetId} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
