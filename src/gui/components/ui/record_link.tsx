import React from 'react';
import ArticleIcon from '@mui/icons-material/Article';
import {Typography, Link} from '@mui/material';
import {NavLink} from 'react-router-dom';
import Chip from '@mui/material/Chip';
interface RecordLinkProps {
  link?: any;
  children: React.ReactNode;
  deleted?: boolean;
}
export default function RecordRouteDisplay(props: RecordLinkProps) {
  const inner = (
    <span
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        flexWrap: 'nowrap',
      }}
    >
      {props.deleted ? (
        <Chip label="Deleted" color="error" variant="outlined" size="small" />
      ) : props.link === '' ? (
        <Chip label="Deleted" color="error" variant="outlined" size="small" />
      ) : (
        <ArticleIcon fontSize={'inherit'} sx={{mt: '3px', mr: '3px'}} />
      )}
      <Typography component={'span'} variant={'body2'} fontWeight={'bold'}>
        {props.children}
      </Typography>
    </span>
  );

  return props.link ? (
    <Link component={NavLink} to={props.link} underline={'none'}>
      {inner}
    </Link>
  ) : (
    inner
  );
}
