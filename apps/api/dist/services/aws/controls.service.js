import { EC2Client, StopInstancesCommand, StartInstancesCommand, TerminateInstancesCommand, RebootInstancesCommand } from '@aws-sdk/client-ec2';
import { RDSClient, StopDBInstanceCommand, StartDBInstanceCommand, RebootDBInstanceCommand } from '@aws-sdk/client-rds';
import { ECSClient, UpdateServiceCommand } from '@aws-sdk/client-ecs';
import { LambdaClient } from '@aws-sdk/client-lambda';
function buildEC2Client(creds, region) {
    return new EC2Client({ region, credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey, sessionToken: creds.sessionToken } });
}
function buildRDSClient(creds, region) {
    return new RDSClient({ region, credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey, sessionToken: creds.sessionToken } });
}
function buildECSClient(creds, region) {
    return new ECSClient({ region, credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey, sessionToken: creds.sessionToken } });
}
function buildLambdaClient(creds, region) {
    return new LambdaClient({ region, credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey, sessionToken: creds.sessionToken } });
}
function isMock(creds) {
    return creds.accessKeyId.startsWith('mock_') || creds.secretAccessKey.startsWith('mock_');
}
export async function executeAction(creds, resourceType, resourceId, action, region) {
    if (isMock(creds)) {
        await new Promise((r) => setTimeout(r, 500));
        return {
            success: true,
            message: `Mock: ${action} on ${resourceType} ${resourceId} in ${region} succeeded`,
            action,
            resourceType,
            resourceId,
            region,
        };
    }
    try {
        switch (resourceType) {
            case 'EC2':
                return await executeEC2Action(creds, resourceId, action, region);
            case 'RDS':
                return await executeRDSAction(creds, resourceId, action, region);
            case 'ECS':
                return await executeECSAction(creds, resourceId, action, region);
            case 'Lambda':
                return await executeLambdaAction(creds, resourceId, action, region);
            default:
                throw new Error(`Unsupported resource type: ${resourceType}`);
        }
    }
    catch (err) {
        return {
            success: false,
            message: err.message || 'Action failed',
            action,
            resourceType,
            resourceId,
            region,
        };
    }
}
async function executeEC2Action(creds, instanceId, action, region) {
    const client = buildEC2Client(creds, region);
    switch (action) {
        case 'STOP':
            await client.send(new StopInstancesCommand({ InstanceIds: [instanceId] }));
            return { success: true, message: `EC2 instance ${instanceId} stopping`, action, resourceType: 'EC2', resourceId: instanceId, region };
        case 'START':
            await client.send(new StartInstancesCommand({ InstanceIds: [instanceId] }));
            return { success: true, message: `EC2 instance ${instanceId} starting`, action, resourceType: 'EC2', resourceId: instanceId, region };
        case 'TERMINATE':
            await client.send(new TerminateInstancesCommand({ InstanceIds: [instanceId] }));
            return { success: true, message: `EC2 instance ${instanceId} terminating`, action, resourceType: 'EC2', resourceId: instanceId, region };
        case 'REBOOT':
            await client.send(new RebootInstancesCommand({ InstanceIds: [instanceId] }));
            return { success: true, message: `EC2 instance ${instanceId} rebooting`, action, resourceType: 'EC2', resourceId: instanceId, region };
    }
}
async function executeRDSAction(creds, dbId, action, region) {
    const client = buildRDSClient(creds, region);
    switch (action) {
        case 'STOP':
            await client.send(new StopDBInstanceCommand({ DBInstanceIdentifier: dbId }));
            return { success: true, message: `RDS ${dbId} stopping`, action, resourceType: 'RDS', resourceId: dbId, region };
        case 'START':
            await client.send(new StartDBInstanceCommand({ DBInstanceIdentifier: dbId }));
            return { success: true, message: `RDS ${dbId} starting`, action, resourceType: 'RDS', resourceId: dbId, region };
        case 'TERMINATE': {
            const { DeleteDBInstanceCommand } = await import('@aws-sdk/client-rds');
            await client.send(new DeleteDBInstanceCommand({ DBInstanceIdentifier: dbId, SkipFinalSnapshot: false, FinalDBSnapshotIdentifier: `${dbId}-final-${Date.now()}` }));
            return { success: true, message: `RDS ${dbId} deleting (final snapshot created)`, action, resourceType: 'RDS', resourceId: dbId, region };
        }
        case 'REBOOT':
            await client.send(new RebootDBInstanceCommand({ DBInstanceIdentifier: dbId }));
            return { success: true, message: `RDS ${dbId} rebooting`, action, resourceType: 'RDS', resourceId: dbId, region };
    }
}
async function executeECSAction(creds, serviceId, action, region) {
    const client = buildECSClient(creds, region);
    const [cluster, service] = serviceId.includes('/') ? serviceId.split('/') : ['default', serviceId];
    switch (action) {
        case 'STOP':
            await client.send(new UpdateServiceCommand({ cluster, service, desiredCount: 0 }));
            return { success: true, message: `ECS service ${service} scaled to 0`, action, resourceType: 'ECS', resourceId: serviceId, region };
        case 'START':
            await client.send(new UpdateServiceCommand({ cluster, service, desiredCount: 1 }));
            return { success: true, message: `ECS service ${service} scaled to 1`, action, resourceType: 'ECS', resourceId: serviceId, region };
        case 'TERMINATE':
            const { DeleteServiceCommand } = await import('@aws-sdk/client-ecs');
            await client.send(new DeleteServiceCommand({ cluster, service }));
            return { success: true, message: `ECS service ${service} deleted`, action, resourceType: 'ECS', resourceId: serviceId, region };
        default:
            throw new Error(`Action ${action} not supported for ECS`);
    }
}
async function executeLambdaAction(creds, functionName, action, region) {
    const client = buildLambdaClient(creds, region);
    switch (action) {
        case 'STOP': {
            const { PutFunctionConcurrencyCommand } = await import('@aws-sdk/client-lambda');
            await client.send(new PutFunctionConcurrencyCommand({ FunctionName: functionName, ReservedConcurrentExecutions: 0 }));
            return { success: true, message: `Lambda ${functionName} concurrency set to 0`, action, resourceType: 'Lambda', resourceId: functionName, region };
        }
        case 'START': {
            const { PutFunctionConcurrencyCommand } = await import('@aws-sdk/client-lambda');
            await client.send(new PutFunctionConcurrencyCommand({ FunctionName: functionName, ReservedConcurrentExecutions: undefined }));
            return { success: true, message: `Lambda ${functionName} concurrency restored`, action, resourceType: 'Lambda', resourceId: functionName, region };
        }
        default:
            throw new Error(`Action ${action} not supported for Lambda`);
    }
}
