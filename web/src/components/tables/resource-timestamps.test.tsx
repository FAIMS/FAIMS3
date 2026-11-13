// SPDX-License-Identifier: Apache-2.0
import {
  ProjectStatus,
  type GetListTeamsResponse,
  type GetNotebookListResponse,
} from '@faims3/data-model';
import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {DataTable} from '@/components/data-table/data-table';
import {displayDateTime, displayIsoTimestamp} from '@/lib/time';
import {archivedProjectColumns} from './archived-projects';
import {archivedTeamColumns} from './archived-teams';
import {archivedTemplateColumns} from './archived-templates';
import {getMapLayerTableColumns} from './map-layers';
import {columns as projectColumns} from './projects';
import {columns as teamColumns} from './teams';
import {getTemplatesTableColumns} from './templates';

afterEach(cleanup);

function headerTitles() {
  return screen.getAllByRole('columnheader').map(header => header.textContent);
}

describe('resource list timestamp columns', () => {
  it('shows Created and Updated at for notebooks', () => {
    const createdAt = '2025-04-02T05:30:00.000Z';
    const updatedAt = '2026-01-15T14:45:00.000Z';
    const row = {
      _id: 'nb-1',
      name: 'Survey One',
      description: 'Field notes',
      createdBy: 'admin',
      createdAt,
      updatedAt,
      status: ProjectStatus.OPEN,
    } as GetNotebookListResponse['notebooks'][number];

    render(<DataTable columns={projectColumns} data={[row]} />);

    expect(headerTitles()).toEqual(
      expect.arrayContaining(['Created', 'Updated at'])
    );
    expect(screen.getByText(displayIsoTimestamp(createdAt))).toBeDefined();
    expect(screen.getByText(displayIsoTimestamp(updatedAt))).toBeDefined();
  });

  it('shows Created At and Updated At for teams', () => {
    const createdAt = Date.parse('2025-04-02T05:30:00.000Z');
    const updatedAt = Date.parse('2026-01-15T14:45:00.000Z');
    const row = {
      _id: 'team-1',
      name: 'Blue Team',
      description: 'A team',
      createdBy: 'admin',
      createdAt,
      updatedAt,
    } as GetListTeamsResponse['teams'][number];

    render(<DataTable columns={teamColumns} data={[row]} />);

    expect(headerTitles()).toEqual(
      expect.arrayContaining(['Created At', 'Updated At'])
    );
    expect(
      screen.getByText(displayDateTime({timestamp: createdAt}))
    ).toBeDefined();
    expect(
      screen.getByText(displayDateTime({timestamp: updatedAt}))
    ).toBeDefined();
  });

  it('keeps Updated at on templates, map layers, and archived resource lists', () => {
    const templateAccessors = getTemplatesTableColumns({
      includeVisibility: false,
    }).map(column =>
      'accessorKey' in column ? column.accessorKey : column.id
    );
    const mapLayerAccessors = getMapLayerTableColumns().map(column =>
      'accessorKey' in column ? column.accessorKey : column.id
    );
    const archivedProjectAccessors = archivedProjectColumns.map(column =>
      'accessorKey' in column ? column.accessorKey : column.id
    );
    const archivedTemplateAccessors = archivedTemplateColumns.map(column =>
      'accessorKey' in column ? column.accessorKey : column.id
    );
    const archivedTeamAccessors = archivedTeamColumns.map(column =>
      'accessorKey' in column ? column.accessorKey : column.id
    );

    expect(templateAccessors).toContain('updatedAt');
    expect(mapLayerAccessors).toContain('updatedAt');
    expect(archivedProjectAccessors).toEqual(
      expect.arrayContaining(['createdAt', 'updatedAt'])
    );
    expect(archivedTemplateAccessors).toEqual(
      expect.arrayContaining(['createdAt', 'updatedAt'])
    );
    expect(archivedTeamAccessors).toEqual(
      expect.arrayContaining(['createdAt', 'updatedAt'])
    );
  });
});
