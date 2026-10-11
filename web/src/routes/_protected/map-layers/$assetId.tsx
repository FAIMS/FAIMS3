// SPDX-License-Identifier: Apache-2.0
import {MapLayerActions} from '@/components/tabs/map-layers/actions';
import {MapLayerDetails} from '@/components/tabs/map-layers/details';
import {MapLayerPreviewTab} from '@/components/tabs/map-layers/preview';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {useAuth} from '@/context/auth-provider';
import {useMapAsset} from '@/hooks/map-asset-hooks';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {createFileRoute, useRouter} from '@tanstack/react-router';
import {useMemo} from 'react';

const tabs = [
  {name: 'Details', Component: MapLayerDetails},
  {name: 'Preview', Component: MapLayerPreviewTab},
  {name: 'Actions', Component: MapLayerActions},
];

export const Route = createFileRoute('/_protected/map-layers/$assetId')({
  component: MapLayerPage,
});

function MapLayerPage() {
  const {assetId} = Route.useParams();
  const {user} = useAuth();
  const {data, isLoading} = useMapAsset({user, assetId});
  const pathname = useRouter().state.location.pathname;
  const paths = useMemo(
    () => [
      {path: '/map-layers', label: 'Map layers'},
      {path: pathname, label: data?.name ?? assetId},
    ],
    [pathname, data?.name, assetId]
  );

  useBreadcrumbUpdate({isLoading, paths});

  return (
    <Tabs defaultValue={tabs[0].name}>
      <TabsList>
        {tabs.map(({name}) => (
          <TabsTrigger key={name} value={name}>
            {name}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map(({name, Component}) => (
        <TabsContent key={name} value={name}>
          <Component assetId={assetId} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
