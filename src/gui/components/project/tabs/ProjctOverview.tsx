/*
 * Copyright 2021 Macquarie University
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
 * Description:This is the file about Notebook Behavoiur
 *   TODO:
 */
import React from 'react';
import {useState, useEffect} from 'react';

import {Grid} from '@material-ui/core';
import {Graphviz} from 'graphviz-react';
import {getconnections} from '../data/ComponentSetting';
import Alert from '@material-ui/lab/Alert';


type ProjectOverviewProps = any;


export default function ProjectOverviewTab(props: ProjectOverviewProps) {
  const {
    formuiSpec,
    ...others
  } = props;
  const [graphs, setGraph] = useState<string>('');

  useEffect(() => {
    setinit();
  }, []);


  const setinit = () => {
    const newconnections: any = [];

    const tabs = formuiSpec['visible_types'].map(
      (tab: string) => (tab = formuiSpec['viewsets'][tab]['label'] ?? tab)
    );

    let graph = 'digraph {';
    tabs.map((tabs: string) => (graph = graph + tabs + ';'));

    formuiSpec['visible_types'].map((tab: string) =>
      newconnections.push(...getconnections(tab, formuiSpec, tabs))
    );

    newconnections.map((connection: any) =>
      connection.link === 'Linked'
        ? (graph =
            graph +
            connection.otab +
            '->' +
            connection.tab +
            '[arrowhead = "forward"];')
        : (graph = graph + connection.otab + '->' + connection.tab + ';')
    );

    graph = graph + '}';
    setGraph(graph);
  };

  return (
    <Grid container>
      <Grid item sm={6} xs={11}>
        {graphs !== '' && <Graphviz dot={graphs} />}
      </Grid>
      <Grid item sm={6} xs={1}>
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
        </Alert>
      </Grid>
    </Grid>
  );
}
