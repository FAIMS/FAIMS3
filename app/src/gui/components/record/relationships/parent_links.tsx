import React from 'react';
import {Alert, Box, Divider, Grid, Link, Typography} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import {NavLink} from 'react-router-dom';
import ArticleIcon from '@mui/icons-material/Article';
import {ParentLinkProps} from './types';
import {HashLink} from 'react-router-hash-link';
export default function ParentLinkComponent(props: {
  parent_links: Array<ParentLinkProps> | null;
}) {
  if (props.parent_links !== null) {
    return (
      <Box mb={2}>
        <Grid
          container
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={1}
        >
          <Grid item xs={'auto'}>
            <Grid
              container
              spacing={1}
              justifyContent={'center'}
              alignItems={'flex-start'}
            >
              <Grid item>
                <LinkIcon fontSize={'inherit'} />
              </Grid>
              <Grid item>
                <Typography variant={'h6'}>
                  Parent{props.parent_links.length > 1 ? '(s)' : ''}{' '}
                </Typography>
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs>
            <Divider />
          </Grid>
        </Grid>
        <Box m={1}>
          {props.parent_links.map(p => (
            <>
              <Link
                key={p.record_id}
                underline={'none'}
                to={p.route}
                component={NavLink}
              >
                <Grid container direction="row" alignItems="center">
                  <ArticleIcon fontSize={'inherit'} sx={{mr: '3px'}} />{' '}
                  <Typography variant={'body2'} fontWeight={'bold'}>
                    {p.type} {p.hrid}
                    {/* [field:
                  {p.field_label}] */}
                  </Typography>
                </Grid>
              </Link>
              <HashLink
                to={{
                  pathname: p.route + '#' + p.field_id, // update for get record_id persistence for the draft
                }}
              >
                {p.type} {p.hrid} {p.field_label}
              </HashLink>
            </>
          ))}
          <Alert severity={'info'} sx={{mt: 1}}>
            To change the parent of this record, go to the parent record itself
          </Alert>
        </Box>
      </Box>
    );
  } else {
    return <Box></Box>;
  }
}
