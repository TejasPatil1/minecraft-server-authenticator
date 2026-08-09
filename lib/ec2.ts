import {
  EC2Client,
  StartInstancesCommand,
  StopInstancesCommand,
  DescribeInstancesCommand,
} from "@aws-sdk/client-ec2";

const REGION = process.env.AWS_REGION || "ap-south-1";
const INSTANCE_ID = process.env.EC2_INSTANCE_ID as string;

let client: EC2Client | null = null;
function getClient() {
  if (!client) client = new EC2Client({ region: REGION });
  return client;
}

export type InstanceInfo = {
  state: string;
  publicIp: string | null;
};

export async function getInstanceInfo(): Promise<InstanceInfo> {
  const res = await getClient().send(
    new DescribeInstancesCommand({ InstanceIds: [INSTANCE_ID] })
  );
  const instance = res.Reservations?.[0]?.Instances?.[0];
  return {
    state: instance?.State?.Name ?? "unknown",
    publicIp: instance?.PublicIpAddress ?? null,
  };
}

export async function startInstance(): Promise<void> {
  await getClient().send(new StartInstancesCommand({ InstanceIds: [INSTANCE_ID] }));
}

// Only ever stops the instance. Never terminates it.
export async function stopInstance(): Promise<void> {
  await getClient().send(new StopInstancesCommand({ InstanceIds: [INSTANCE_ID] }));
}
