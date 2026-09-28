// SPDX-License-Identifier: Apache-2.0
import {createFileRoute, redirect} from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/')({
  beforeLoad: () => {
    throw redirect({
      to: '/teams',
    });
  },
});
