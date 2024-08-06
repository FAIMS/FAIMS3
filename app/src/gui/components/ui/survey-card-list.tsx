import {ProjectInformation} from 'faims3-datamodel/build/src/types';
import SurveyCard from './survey-card';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';

interface SurveyCardListProps {
  surveys: ProjectInformation[];
}

export default function SurveyCardList({surveys}: SurveyCardListProps) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {surveys.map(survey => (
        <SurveyCard
          key={survey.project_id}
          survey={survey}
          onClick={(project_id: string, activated: boolean) =>
            activated && navigate(ROUTES.NOTEBOOK + project_id)
          }
        />
      ))}
    </div>
  );
}
