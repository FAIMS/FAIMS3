import {AutoScaling, ServiceDiscovery} from 'aws-sdk';
import {EventBridgeEvent, Context} from 'aws-lambda';

const servicediscovery = new ServiceDiscovery();
const autoscaling = new AutoScaling();

interface ASGLifecycleEvent {
  LifecycleHookName: string;
  AutoScalingGroupName: string;
  EC2InstanceId: string;
  LifecycleTransition: string;
}

export const handler = async (
  event: EventBridgeEvent<
    'EC2 Instance-terminate Lifecycle Action',
    ASGLifecycleEvent
  >,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  context: Context
): Promise<{statusCode: number; body: string}> => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const instanceId = event.detail.EC2InstanceId;
  const lifecycleHookName = event.detail.LifecycleHookName;
  const autoScalingGroupName = event.detail.AutoScalingGroupName;

  const serviceId = process.env.SERVICE_ID;

  if (!serviceId) {
    throw new Error('SERVICE_ID environment variable is not set');
  }

  try {
    // Deregister the instance from CloudMap
    await servicediscovery
      .deregisterInstance({
        ServiceId: serviceId,
        InstanceId: instanceId,
      })
      .promise();

    console.log(
      `Successfully deregistered instance ${instanceId} from CloudMap`
    );

    // Complete the lifecycle action
    await autoscaling
      .completeLifecycleAction({
        LifecycleHookName: lifecycleHookName,
        AutoScalingGroupName: autoScalingGroupName,
        InstanceId: instanceId,
        LifecycleActionResult: 'CONTINUE',
      })
      .promise();

    console.log(`Completed lifecycle action for instance ${instanceId}`);

    return {statusCode: 200, body: 'Deregistration successful'};
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
