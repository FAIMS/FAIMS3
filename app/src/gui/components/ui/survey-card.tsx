import {ProjectInformation} from '@faims3/data-model';
import tick from '../../../tick.svg';
import cross from '../../../cross.svg';
import {activate_project} from '../../../sync/process-initialization';

/**
 * Function to handle the click event on the activate button.
 *
 * @param {ProjectInformation} survey - The survey object containing details to be displayed in the card.
 * @returns {void}
 */
const onActivate = async ({
  listing_id,
  non_unique_project_id,
}: ProjectInformation) => {
  const projectID = await activate_project(listing_id, non_unique_project_id);

  console.log('DEBUG_projectID: ', projectID);

  if (projectID) window.location.reload();
};

/**
 * SurveyCard component that displays information about a single survey.
 *
 * @param {SurveyCardProps} props - The properties for the SurveyCard component.
 * @param {ProjectInformation} props.survey - The survey object containing details to be displayed in the card.
 * @param {(project_id: string, activated: boolean) => void} props.onClick - Function to handle click events on the survey card.
 * @returns {JSX.Element} - The rendered SurveyCard component.
 */
export default function SurveyCard({
  survey,
  onClick,
}: {
  survey: ProjectInformation;
  onClick: (project_id: string, activated: boolean) => void;
}): JSX.Element {
  return (
    <div
      style={{
        border: '1px solid #BBBBBB',
        boxShadow: '0 5px 5px -2px rgb(0 0 0 / 0.3)',
        backgroundColor: '#F9F9F9',
        borderRadius: 20,
        paddingTop: 16,
        paddingLeft: 16,
      }}
      onClick={() => onClick(survey.project_id, survey.is_activated)}
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
            {survey.name}
          </div>
          {!survey.is_activated && (
            <button
              style={{
                padding: '6px 10px',
                fontSize: 16,
                borderRadius: 10,
              }}
              onClick={() => onActivate(survey)}
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
            {survey.is_activated ? (
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
                  survey.status === 'published' ? '#007435' : '#F44336',
              }}
            >
              {survey.status &&
                survey.status[0].toUpperCase() + survey.status.slice(1)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
