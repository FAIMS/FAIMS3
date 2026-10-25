// SPDX-License-Identifier: Apache-2.0
import {MapLayerPreviewTabProgress} from '@/components/maps/MapLayerPreviewProgress';
import {MapLayerActions} from '@/components/tabs/map-layers/actions';
import {MapLayerDetails} from '@/components/tabs/map-layers/details';
import {MapLayerLinkedSurveys} from '@/components/tabs/map-layers/linked-surveys';
import {MapLayerPreviewTab} from '@/components/tabs/map-layers/preview';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {config} from '@/constants';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {useMapAsset} from '@/hooks/map-asset-hooks';
import {useMapAssetPreviewDownload} from '@/hooks/map-asset-preview-hooks';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {canMutateMapAsset} from '@/lib/map-layer-permissions';
import {parseMapLayerTab, type MapLayerTab} from '@/lib/map-layer-tabs';
import {createFileRoute, useNavigate, useRouter} from '@tanstack/react-router';
import {useMemo, type ComponentType} from 'react';

const tabs: {
  id: MapLayerTab;
  name: string;
  Component: ComponentType<{assetId: string}>;
}[] = [
  {id: 'details', name: 'Details', Component: MapLayerDetails},
  {id: 'preview', name: 'Preview', Component: MapLayerPreviewTab},
  {
    id: 'links',
    name: `Linked ${config.notebookNamePluralCapitalized}`,
    Component: MapLayerLinkedSurveys,
  },
  {id: 'actions', name: 'Actions', Component: MapLayerActions},
];

export const Route = createFileRoute('/_protected/map-layers/$assetId')({
  validateSearch: (search: Record<string, unknown>): {tab?: MapLayerTab} => {
    const tab = search.tab;
    return tab === undefined ? {} : {tab: parseMapLayerTab(tab)};
  },
  component: MapLayerPage,
});

/** Control Centre page for one map layer (details, preview, links, actions). */
function MapLayerPage() {
  const {assetId} = Route.useParams();
  const {tab: tabSearch} = Route.useSearch();
  const navigate = useNavigate();
  const user = useRequiredUser();
  const {data, isLoading} = useMapAsset({user, assetId});
  const previewDownload = useMapAssetPreviewDownload({
    asset: data,
    token: user.token,
    start: false,
  });
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
        : tabs.filter(tab => tab.id !== 'actions'),
    [data, user]
  );
  const tab = visibleTabs.some(item => item.id === tabSearch)
    ? (tabSearch as MapLayerTab)
    : visibleTabs[0].id;

  useBreadcrumbUpdate({isLoading, paths});

  return (
    <Tabs
      value={tab}
      onValueChange={value => {
        void navigate({
          to: '/map-layers/$assetId',
          params: {assetId},
          search: {tab: parseMapLayerTab(value)},
          replace: true,
        });
      }}
    >
      <TabsList>
        {visibleTabs.map(({id, name}) => (
          <TabsTrigger
            key={id}
            value={id}
            className="gap-1.5"
            aria-busy={
              id === 'preview' && previewDownload.status === 'downloading'
            }
          >
            {name}
            {id === 'preview' ? (
              <MapLayerPreviewTabProgress download={previewDownload} />
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {visibleTabs.map(({id, Component}) => (
        <TabsContent key={id} value={id}>
          <Component assetId={assetId} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
