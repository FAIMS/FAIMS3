import React from 'react';
import ArticleIcon from '@mui/icons-material/Article';
import {Typography, Link} from '@mui/material';
import {NavLink} from 'react-router-dom';
interface RecordLinkProps {
  link?: any;
  children: React.ReactNode;
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
      <ArticleIcon fontSize={'inherit'} sx={{mt: '3px', mr: '3px'}} />
      <Typography variant={'body2'} fontWeight={'bold'} component={'span'}>
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
