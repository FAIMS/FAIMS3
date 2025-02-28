import {ProjectInformation} from '@faims3/data-model';
import tick from '../../../tick.svg';
import cross from '../../../cross.svg';
import {useAppDispatch, useAppSelector} from '../../../context/store';
import {activateProject} from '../../../context/slices/projectSlice';
import {selectActiveUser} from '../../../context/slices/authSlice';

/**
 * ProjectCard component that displays information about a single project.
 *
 * @param {ProjectCardProps} props - The properties for the ProjectCard component.
 * @param {ProjectInformation} props.project - The project object containing details to be displayed in the card.
 * @param {(project_id: string, activated: boolean) => void} props.onClick - Function to handle click events on the project card.
 * @returns {JSX.Element} - The rendered ProjectCard component.
 */
export default function ProjectCard({
  project,
  onClick,
}: {
  project: ProjectInformation;
  onClick: (project: ProjectInformation, activated: boolean) => void;
}): JSX.Element {
  const dispatch = useAppDispatch();
  const activeUser = useAppSelector(selectActiveUser);

  if (!activeUser) {
    // You shouldn't be here!
    return <></>;
  }

  return (
    <div
      style={{
        border: '1px solid #BBBBBB',
        boxShadow: '0 5px 5px -2px rgb(0 0 0 / 0.3)',
        backgroundColor: '#F9F9F9',
        borderRadius: '20px',
        paddingTop: '20px 16px',
        paddingLeft: '16px',
      }}
      onClick={() => onClick(project, project.is_activated)}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingRight: 16,
          }}
        >
          <div
            style={{
              fontWeight: 'bold',
              fontSize: 22,
            }}
          >
            {project.name}
          </div>
          {!project.is_activated && (
            <button
              style={{
                cursor: 'pointer',
                padding: '6px 10px',
                fontSize: 16,
                borderRadius: 10,
              }}
              onClick={() => {
                dispatch(
                  activateProject({
                    projectId: project.project_id,
                    serverId: activeUser.serverId,
                    jwtToken: activeUser.token,
                  })
                );
              }}
            >
              Activate
            </button>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 18,
              paddingBottom: 16,
            }}
          >
            {project.is_activated ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexDirection: 'row',
                  gap: 4,
                }}
              >
                <img
                  src={tick}
                  style={{
                    width: 32,
                    height: 32,
                  }}
                />
                <div>Activated</div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexDirection: 'row',
                  gap: 4,
                }}
              >
                <img
                  src={cross}
                  style={{
                    width: 20,
                    height: 20,
                  }}
                />
                <div
                  style={{
                    paddingLeft: 4,
                  }}
                >
                  Not active
                </div>
              </div>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'end',
            }}
          >
            <div
              style={{
                color: 'white',
                padding: '6px 10px',
                fontWeight: '550',
                borderRadius: 20,
                backgroundColor:
                  project.status === 'published' ? '#007435' : '#F44336',
              }}
            >
              {project.status &&
                project.status[0].toUpperCase() + project.status.slice(1)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
