import {createFileRoute} from '@tanstack/react-router';
import {ProjectsRouteComponent} from './projects';

export const Route = createFileRoute('/_protected/')({
  component: ProjectsRouteComponent,
});
