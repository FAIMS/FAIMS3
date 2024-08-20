import {ProjectInformation} from '@faims3/data-model';
import SurveyCard from './survey-card';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';

/**
 * SurveyCardList component that displays a list of SurveyCard components.
 *
 * @param {SurveyCardListProps} props - The properties for the SurveyCardList component.
 * @param {ProjectInformation[]} props.surveys - An array of survey objects containing details to be displayed in the list.
 * @returns {JSX.Element} - The rendered SurveyCardList component.
 */
export default function SurveyCardList({
  surveys,
}: {
  surveys: ProjectInformation[];
}) {
  const navigate = useNavigate();

  const onClick = (project_id: string, activated: boolean) =>
    activated && navigate(ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE + project_id);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {surveys.map(survey => (
        <SurveyCard key={survey.project_id} survey={survey} onClick={onClick} />
      ))}
    </div>
  );
}
