/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: ProjectBehaviour.tsx
 * Description:This is the file about Notebook behaviour
 *   TODO:
 */
import React from 'react';
import {useState, useEffect} from 'react';

import {Grid} from '@mui/material';
import {Graphviz} from 'graphviz-react';
import {getconnections} from '../data/ComponentSetting';
import Alert from '@mui/material/Alert';

type ProjectOverviewProps = any;

export default function ProjectOverviewTab(props: ProjectOverviewProps) {
  const formuiSpec = props.formuiSpec;
  const [graphs, setGraph] = useState<string>('');

  useEffect(() => {
    let isactive = true;
    if (isactive) {
      setinit();
    }
    return () => {
      isactive = false;
    };
  }, []);

  const setinit = () => {
    const newconnections: any = [];

    const tabs = formuiSpec['visible_types'].map(
      (tab: string) => (tab = formuiSpec['viewsets'][tab]['label'] ?? tab)
    );

    let graph = 'digraph {';
    tabs.map((tabs: string) => (graph = graph + '"' + tabs + '"' + ';'));

    formuiSpec['visible_types'].map((tab: string) =>
      newconnections.push(...getconnections(tab, formuiSpec, tabs))
    );

    newconnections.map((connection: any) =>
      connection.link === 'Linked' && connection.multiple === true
        ? (graph =
            graph +
            '"' +
            connection.otab +
            '"' +
            '->' +
            '"' +
            connection.tab +
            '"' +
            '[arrowhead = "forward" label="multiple"];')
        : connection.link === 'Linked' && connection.multiple === false
        ? (graph =
            graph +
            '"' +
            connection.otab +
            '"' +
            '->' +
            '"' +
            connection.tab +
            '"' +
            '[arrowhead = "forward"];')
        : connection.link !== 'Linked' && connection.multiple === true
        ? (graph =
            graph +
            '"' +
            connection.otab +
            '"' +
            '->' +
            '"' +
            connection.tab +
            '"' +
            '[label = "multiple"];')
        : (graph =
            graph +
            '"' +
            connection.otab +
            '"' +
            '->' +
            '"' +
            connection.tab +
            '"' +
            ';')
    );

    graph = graph + '}';
    console.log(graph);
    setGraph(graph);
  };

  return (
    <Grid container>
      <Grid item sm={8} xs={11}>
        {graphs !== '' && (
          <Graphviz options={{zoom: true, width: '100%'}} dot={graphs} />
        )}
      </Grid>
      <Grid item sm={4} xs={1}>
        <br />
        <br />
        <br />
        <br />
        <Alert severity="info">
          Relation Type:
          <br />
          {' -----> Contained'}
          <br />
          ------ Linked
          <br />
          Graph can be zoomed in and out
        </Alert>
      </Grid>
    </Grid>
  );
}
