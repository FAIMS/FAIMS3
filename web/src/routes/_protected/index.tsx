import {createFileRoute, redirect} from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/')({
  beforeLoad: () => {
    throw redirect({
      to: '/teams',
    });
  },
});
