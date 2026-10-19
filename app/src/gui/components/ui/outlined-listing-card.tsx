// SPDX-License-Identifier: Apache-2.0
import {Card, CardActionArea, CardContent, Stack} from '@mui/material';
import type {ReactNode} from 'react';

/**
 * Outlined listing row: content on the left, trailing control on the right.
 * Wraps on narrow screens so titles and actions stay reachable.
 */
export function OutlinedListingCard({
  onClick,
  trailing,
  footer,
  children,
}: {
  onClick?: () => void;
  trailing?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const body = (
    <CardContent sx={{py: 1.5, minWidth: 0}}>
      <Stack
        direction="row"
        spacing={1.5}
        useFlexGap
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          minWidth: 0,
          rowGap: 1,
        }}
      >
        <Stack spacing={0.5} sx={{flex: '1 1 12rem', minWidth: 0}}>
          {children}
        </Stack>
        {trailing ? <Stack sx={{flexShrink: 0}}>{trailing}</Stack> : null}
      </Stack>
    </CardContent>
  );

  return (
    <Card variant="outlined" sx={{minWidth: 0}}>
      {onClick ? (
        <CardActionArea onClick={onClick} sx={{minWidth: 0}}>
          {body}
        </CardActionArea>
      ) : (
        body
      )}
      {footer ? (
        <CardContent sx={{pt: 0, pb: 1.5}}>{footer}</CardContent>
      ) : null}
    </Card>
  );
}
