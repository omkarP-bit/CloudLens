import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { RDSClient, DescribeDBInstancesCommand } from '@aws-sdk/client-rds';
import { ECSClient, ListClustersCommand, DescribeClustersCommand, ListServicesCommand, DescribeServicesCommand } from '@aws-sdk/client-ecs';
import { LambdaClient, ListFunctionsCommand } from '@aws-sdk/client-lambda';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import { ElastiCacheClient, DescribeCacheClustersCommand } from '@aws-sdk/client-elasticache';
const ALL_REGIONS = [
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
    'eu-north-1', 'eu-south-1', 'ap-southeast-1', 'ap-southeast-2',
    'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
    'ap-south-1', 'sa-east-1', 'ca-central-1',
];
function mockResources(accountId, filterRegion, filterType, filterState) {
    const regions = filterRegion ? [filterRegion] : ['us-east-1', 'us-west-2', 'eu-west-1'];
    const mockData = [];
    const now = new Date();
    for (const region of regions) {
        if (!filterType || filterType === 'EC2') {
            for (let i = 1; i <= 3; i++) {
                const d = new Date(now);
                d.setDate(d.getDate() - Math.floor(Math.random() * 60));
                mockData.push({
                    id: `i-0abc${i}${region.replace(/-/g, '')}`,
                    type: 'EC2',
                    name: `web-server-${region}-${i}`,
                    region,
                    state: 'running',
                    accountId,
                    metadata: { instanceType: ['t3.medium', 't3.large', 'm5.xlarge'][i - 1], vpcId: `vpc-${region}123` },
                    estimatedMonthlyCost: Math.round((Math.random() * 200 + 30) * 100) / 100,
                    tags: { Environment: 'production', Team: 'platform' },
                    launchTime: d.toISOString(),
                });
            }
        }
        if (!filterType || filterType === 'RDS') {
            for (let i = 1; i <= 2; i++) {
                mockData.push({
                    id: `db-${region}${i}`,
                    type: 'RDS',
                    name: `main-db-${region}-${i}`,
                    region,
                    state: 'available',
                    accountId,
                    metadata: { engine: 'postgres', instanceClass: 'db.r5.large', storage: 100 },
                    estimatedMonthlyCost: Math.round((Math.random() * 300 + 100) * 100) / 100,
                    tags: { Environment: 'production' },
                    launchTime: new Date(now.getTime() - Math.random() * 90 * 86400000).toISOString(),
                });
            }
        }
        if (!filterType || filterType === 'ECS') {
            mockData.push({
                id: `ecs-${region}-cluster-1`,
                type: 'ECS',
                name: `api-cluster-${region}`,
                region,
                state: 'ACTIVE',
                accountId,
                metadata: { runningTasksCount: 3, pendingTasksCount: 0, serviceName: `api-service-${region}` },
                estimatedMonthlyCost: Math.round((Math.random() * 150 + 50) * 100) / 100,
                tags: { Environment: 'staging' },
                launchTime: null,
            });
        }
        if (!filterType || filterType === 'Lambda') {
            for (let i = 1; i <= 3; i++) {
                mockData.push({
                    id: `lambda-${region}-func-${i}`,
                    type: 'Lambda',
                    name: [`process-orders-${region}`, `auth-handler-${region}`, `notifications-${region}`][i - 1],
                    region,
                    state: 'Active',
                    accountId,
                    metadata: { runtime: 'nodejs20.x', memory: 512, timeout: 30 },
                    estimatedMonthlyCost: Math.round((Math.random() * 10 + 0.5) * 100) / 100,
                    tags: {},
                    launchTime: new Date(now.getTime() - Math.random() * 120 * 86400000).toISOString(),
                });
            }
        }
        if (!filterType || filterType === 'S3') {
            mockData.push({
                id: `s3-bucket-${region}-data`,
                type: 'S3',
                name: `cloudlens-data-${region}-${accountId.slice(0, 4)}`,
                region,
                state: 'Active',
                accountId,
                metadata: { objectCount: Math.floor(Math.random() * 10000), storageGB: Math.round(Math.random() * 500 * 10) / 10 },
                estimatedMonthlyCost: Math.round((Math.random() * 50 + 5) * 100) / 100,
                tags: { DataClass: 'analytics' },
                launchTime: null,
            });
        }
        if (!filterType || filterType === 'ElastiCache') {
            mockData.push({
                id: `cache-${region}-1`,
                type: 'ElastiCache',
                name: `session-cache-${region}`,
                region,
                state: 'available',
                accountId,
                metadata: { engine: 'redis', nodeType: 'cache.r5.large', numNodes: 2 },
                estimatedMonthlyCost: Math.round((Math.random() * 100 + 40) * 100) / 100,
                tags: { Environment: 'production' },
                launchTime: new Date(now.getTime() - Math.random() * 60 * 86400000).toISOString(),
            });
        }
    }
    return mockData.filter((r) => {
        if (filterRegion && r.region !== filterRegion)
            return false;
        if (filterType && r.type !== filterType)
            return false;
        if (filterState && r.state !== filterState && r.state.toLowerCase() !== filterState.toLowerCase())
            return false;
        return true;
    });
}
function buildRegionalClient(creds, region, Client) {
    return new Client({
        region,
        credentials: {
            accessKeyId: creds.accessKeyId,
            secretAccessKey: creds.secretAccessKey,
            sessionToken: creds.sessionToken,
        },
    });
}
function isMock(creds) {
    return creds.accessKeyId.startsWith('mock_') || creds.secretAccessKey.startsWith('mock_');
}
export async function discoverResources(creds, accountId, options = {}) {
    if (isMock(creds)) {
        return mockResources(accountId, options.region, options.type, options.state);
    }
    const regionsToScan = options.region ? [options.region] : ALL_REGIONS;
    const results = [];
    for (const region of regionsToScan) {
        try {
            if (!options.type || options.type === 'EC2') {
                const ec2Resources = await discoverEC2(creds, accountId, region);
                results.push(...ec2Resources);
            }
            if (!options.type || options.type === 'RDS') {
                const rdsResources = await discoverRDS(creds, accountId, region);
                results.push(...rdsResources);
            }
            if (!options.type || options.type === 'ECS') {
                const ecsResources = await discoverECS(creds, accountId, region);
                results.push(...ecsResources);
            }
            if (!options.type || options.type === 'Lambda') {
                const lambdaResources = await discoverLambda(creds, accountId, region);
                results.push(...lambdaResources);
            }
            if (!options.type || options.type === 'ElastiCache') {
                const cacheResources = await discoverElastiCache(creds, accountId, region);
                results.push(...cacheResources);
            }
        }
        catch (err) {
            console.warn(`Discovery failed for ${region}:`, err.message);
        }
    }
    if (!options.type || options.type === 'S3') {
        try {
            const s3Resources = await discoverS3(creds, accountId);
            results.push(...s3Resources);
        }
        catch (err) {
            console.warn('S3 discovery failed:', err.message);
        }
    }
    return results.filter((r) => {
        if (options.state) {
            const matchState = options.state.toLowerCase();
            const rState = (r.state || '').toLowerCase();
            if (rState !== matchState)
                return false;
        }
        return true;
    });
}
async function discoverEC2(creds, accountId, region) {
    const client = buildRegionalClient(creds, region, EC2Client);
    const resources = [];
    let nextToken;
    do {
        const response = await client.send(new DescribeInstancesCommand({ NextToken: nextToken }));
        for (const reservation of response.Reservations || []) {
            for (const instance of reservation.Instances || []) {
                const tags = {};
                (instance.Tags || []).forEach((t) => { if (t.Key && t.Value)
                    tags[t.Key] = t.Value; });
                resources.push({
                    id: instance.InstanceId || `unknown-${region}`,
                    type: 'EC2',
                    name: tags.Name || instance.InstanceId || 'Unknown',
                    region,
                    state: instance.State?.Name || 'unknown',
                    accountId,
                    metadata: {
                        instanceType: instance.InstanceType,
                        vpcId: instance.VpcId,
                        subnetId: instance.SubnetId,
                        privateIp: instance.PrivateIpAddress,
                        publicIp: instance.PublicIpAddress,
                        securityGroups: (instance.SecurityGroups || []).map((sg) => sg.GroupId),
                    },
                    estimatedMonthlyCost: null,
                    tags,
                    launchTime: instance.LaunchTime?.toISOString() || null,
                });
            }
        }
        nextToken = response.NextToken;
    } while (nextToken);
    return resources;
}
async function discoverRDS(creds, accountId, region) {
    const client = buildRegionalClient(creds, region, RDSClient);
    const resources = [];
    let marker;
    do {
        const response = await client.send(new DescribeDBInstancesCommand({ Marker: marker }));
        for (const db of response.DBInstances || []) {
            const tags = {};
            (db.TagList || []).forEach((t) => { if (t.Key && t.Value)
                tags[t.Key] = t.Value; });
            resources.push({
                id: db.DBInstanceIdentifier || `db-${region}`,
                type: 'RDS',
                name: db.DBInstanceIdentifier || 'Unknown',
                region,
                state: db.DBInstanceStatus || 'unknown',
                accountId,
                metadata: {
                    engine: db.Engine,
                    engineVersion: db.EngineVersion,
                    instanceClass: db.DBInstanceClass,
                    storage: db.AllocatedStorage,
                    multiAz: db.MultiAZ,
                    endpoint: db.Endpoint?.Address,
                },
                estimatedMonthlyCost: null,
                tags,
                launchTime: db.InstanceCreateTime?.toISOString() || null,
            });
        }
        marker = response.Marker;
    } while (marker);
    return resources;
}
async function discoverECS(creds, accountId, region) {
    const client = buildRegionalClient(creds, region, ECSClient);
    const resources = [];
    const clusterArns = await client.send(new ListClustersCommand({}));
    if (!clusterArns.clusterArns?.length)
        return resources;
    const clusterNames = clusterArns.clusterArns.map((arn) => arn.split('/').pop() || '').filter(Boolean);
    const clusters = await client.send(new DescribeClustersCommand({ clusters: clusterNames }));
    for (const cluster of clusters.clusters || []) {
        const serviceArns = await client.send(new ListServicesCommand({ cluster: cluster.clusterName }));
        const serviceNames = (serviceArns.serviceArns || []).map((arn) => arn.split('/').pop() || '').filter(Boolean);
        if (serviceNames.length > 0) {
            const services = await client.send(new DescribeServicesCommand({
                cluster: cluster.clusterName,
                services: serviceNames.slice(0, 10),
            }));
            for (const svc of services.services || []) {
                const tags = {};
                (svc.tags || []).forEach((t) => { if (t.key && t.value)
                    tags[t.key] = t.value; });
                resources.push({
                    id: svc.serviceArn || svc.serviceName || `ecs-${region}`,
                    type: 'ECS',
                    name: svc.serviceName || cluster.clusterName || 'Unknown',
                    region,
                    state: svc.status || 'UNKNOWN',
                    accountId,
                    metadata: {
                        clusterName: cluster.clusterName,
                        runningTasksCount: svc.runningCount,
                        pendingTasksCount: svc.pendingCount,
                        desiredTasksCount: svc.desiredCount,
                        taskDefinition: svc.taskDefinition,
                        launchType: svc.launchType,
                    },
                    estimatedMonthlyCost: null,
                    tags,
                    launchTime: svc.createdAt?.toISOString() || null,
                });
            }
        }
    }
    return resources;
}
async function discoverLambda(creds, accountId, region) {
    const client = buildRegionalClient(creds, region, LambdaClient);
    const resources = [];
    let marker;
    do {
        const response = await client.send(new ListFunctionsCommand({ Marker: marker }));
        for (const fn of response.Functions || []) {
            const tags = {};
            resources.push({
                id: fn.FunctionArn || `lambda-${region}`,
                type: 'Lambda',
                name: fn.FunctionName || 'Unknown',
                region,
                state: fn.State || 'Active',
                accountId,
                metadata: {
                    runtime: fn.Runtime,
                    memory: fn.MemorySize,
                    timeout: fn.Timeout,
                    handler: fn.Handler,
                    codeSize: fn.CodeSize,
                    lastModified: fn.LastModified,
                },
                estimatedMonthlyCost: null,
                tags,
                launchTime: null,
            });
        }
        marker = response.NextMarker;
    } while (marker);
    return resources;
}
async function discoverS3(creds, accountId) {
    if (isMock(creds))
        return [];
    const client = new S3Client({
        region: 'us-east-1',
        credentials: {
            accessKeyId: creds.accessKeyId,
            secretAccessKey: creds.secretAccessKey,
            sessionToken: creds.sessionToken,
        },
    });
    const resources = [];
    const response = await client.send(new ListBucketsCommand({}));
    for (const bucket of response.Buckets || []) {
        resources.push({
            id: bucket.Name || `s3-${accountId}`,
            type: 'S3',
            name: bucket.Name || 'Unknown',
            region: 'us-east-1',
            state: 'Active',
            accountId,
            metadata: { creationDate: bucket.CreationDate?.toISOString() },
            estimatedMonthlyCost: null,
            tags: {},
            launchTime: bucket.CreationDate?.toISOString() || null,
        });
    }
    return resources;
}
async function discoverElastiCache(creds, accountId, region) {
    const client = buildRegionalClient(creds, region, ElastiCacheClient);
    const resources = [];
    let marker;
    do {
        const response = await client.send(new DescribeCacheClustersCommand({ Marker: marker }));
        for (const cluster of response.CacheClusters || []) {
            const tags = {};
            resources.push({
                id: cluster.CacheClusterId || `cache-${region}`,
                type: 'ElastiCache',
                name: cluster.CacheClusterId || 'Unknown',
                region,
                state: cluster.CacheClusterStatus || 'unknown',
                accountId,
                metadata: {
                    engine: cluster.Engine,
                    engineVersion: cluster.EngineVersion,
                    nodeType: cluster.CacheNodeType,
                    numNodes: cluster.NumCacheNodes,
                    multiAZ: cluster.MultiAZEnabled,
                },
                estimatedMonthlyCost: null,
                tags,
                launchTime: cluster.CacheClusterCreateTime?.toISOString() || null,
            });
        }
        marker = response.Marker;
    } while (marker);
    return resources;
}
