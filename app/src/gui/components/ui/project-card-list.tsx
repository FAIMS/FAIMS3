import {ProjectInformation} from '@faims3/data-model';
import ProjectCard from './project-card';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';

/**
 * ProjectCardList component that displays a list of ProjectCard components.
 *
 * @param {ProjectCardListProps} props - The properties for the ProjectCardList component.
 * @param {ProjectInformation[]} props.projects - An array of project objects containing details to be displayed in the list.
 * @returns {JSX.Element} - The rendered ProjectCardList component.
 */
export default function ProjectCardList({
  projects,
}: {
  projects: ProjectInformation[];
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
      {projects.map(project => (
        <ProjectCard
          key={project.project_id}
          project={project}
          onClick={onClick}
        />
      ))}
    </div>
  );
}
