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
  viewsets: {Site: {label: 'Site'}, Feature: {label: 'Feature'}},
  visible_types: ['Site', 'Feature'],
  settings: {showQrCodeButton: false},
};

vi.mock('../../../context/slices/helpers/compiledSpecService', () => ({
  compiledSpecService: {getSpec: () => uiSpecification},
}));

const renderButtons = (planClaim?: {planReference: string; formType: string}) =>
  render(
    <ThemeProvider theme={theme}>
      <AddRecordButtons
        project={
          {projectId: 'p', serverId: 's', uiSpecificationId: 'u'} as Project
        }
        recordLabel="Record"
        refreshList={vi.fn()}
        planClaim={planClaim}
      />
    </ThemeProvider>
  );

afterEach(cleanup);

describe('AddRecordButtons on a plan that shares its notebook', () => {
  it('offers every visible form where no plan claims the records', () => {
    renderButtons();
    expect(
      screen.getByTestId('Site-app-record-add-button')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('Feature-app-record-add-button')
    ).toBeInTheDocument();
  });

  it("offers the plan's own form alone", () => {
    renderButtons({planReference: 'field', formType: 'Site'});
    expect(
      screen.getByTestId('Site-app-record-add-button')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('Feature-app-record-add-button')).toBeNull();
  });

  it('claims the record it creates for the plan', async () => {
    renderButtons({planReference: 'field', formType: 'Site'});
    await userEvent.click(screen.getByTestId('Site-app-record-add-button'));
    expect(createRecord).toHaveBeenCalledWith(
      expect.objectContaining({formId: 'Site', planReference: 'field'})
    );
  });
});
