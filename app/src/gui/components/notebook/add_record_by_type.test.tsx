import '@testing-library/jest-dom';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup} from '@testing-library/react';
import {ThemeProvider} from '@mui/material/styles';
import {Project} from '../../../context/slices/projectSlice';
import {theme} from '../../themes';
import AddRecordButtons from './add_record_by_type';

const {createRecord} = vi.hoisted(() => ({
  createRecord: vi.fn(async () => ({record: {_id: 'new-record'}})),
}));

vi.mock('@faims3/data-model', async () => ({
  ...(await vi.importActual<object>('@faims3/data-model')),
  DataEngine: class {
    form = {createRecord};
  },
}));
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<object>('react-router-dom')),
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}));
vi.mock('../../../context/store', () => ({
  useAppSelector: () => ({username: 'testuser'}),
}));
vi.mock('../../../context/slices/authSlice', () => ({
  selectActiveUser: vi.fn(),
}));
vi.mock('../../../utils/database', () => ({localGetDataDb: () => ({})}));
vi.mock('@faims3/forms', () => ({QRCodeButton: () => null}));

const uiSpecification = {
  // A plan may name a form the notebook does not list among its visible ones
  viewsets: {
    Site: {label: 'Site'},
    Feature: {label: 'Feature'},
    Hidden: {label: 'Hidden'},
  },
  visible_types: ['Site', 'Feature'],
  settings: {showQrCodeButton: false},
};

vi.mock('../../../context/slices/helpers/compiledSpecService', () => ({
  compiledSpecService: {getSpec: () => uiSpecification},
}));

const renderButtons = ({
  formTypes,
  planReference,
}: {
  formTypes: string[];
  planReference?: string;
}) =>
  render(
    <ThemeProvider theme={theme}>
      <AddRecordButtons
        project={
          {projectId: 'p', serverId: 's', uiSpecificationId: 'u'} as Project
        }
        recordLabel="Record"
        refreshList={vi.fn()}
        formTypes={formTypes}
        planReference={planReference}
      />
    </ThemeProvider>
  );

afterEach(cleanup);

describe('AddRecordButtons on a plan that shares its notebook', () => {
  it('offers a button per form it is given', () => {
    renderButtons({formTypes: uiSpecification.visible_types});
    expect(
      screen.getByTestId('Site-app-record-add-button')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('Feature-app-record-add-button')
    ).toBeInTheDocument();
  });

  it('offers no form it was not given', () => {
    renderButtons({formTypes: ['Site'], planReference: 'field'});
    expect(
      screen.getByTestId('Site-app-record-add-button')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('Feature-app-record-add-button')).toBeNull();
  });

  it('offers every form of a plan collecting more than one', () => {
    renderButtons({formTypes: ['Site', 'Hidden'], planReference: 'field'});
    expect(
      screen.getByTestId('Site-app-record-add-button')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('Hidden-app-record-add-button')
    ).toBeInTheDocument();
  });

  it('offers a plan its form even where the notebook hides it', () => {
    renderButtons({formTypes: ['Hidden'], planReference: 'field'});
    expect(
      screen.getByTestId('Hidden-app-record-add-button')
    ).toBeInTheDocument();
  });

  it('claims the record it creates for the plan', async () => {
    renderButtons({formTypes: ['Site'], planReference: 'field'});
    await userEvent.click(screen.getByTestId('Site-app-record-add-button'));
    expect(createRecord).toHaveBeenCalledWith(
      expect.objectContaining({formId: 'Site', planReference: 'field'})
    );
  });

  it('claims nothing where no plan asked for the buttons', async () => {
    renderButtons({formTypes: ['Site']});
    await userEvent.click(screen.getByTestId('Site-app-record-add-button'));
    expect(createRecord).toHaveBeenCalledWith(
      expect.objectContaining({formId: 'Site', planReference: undefined})
    );
  });
});
