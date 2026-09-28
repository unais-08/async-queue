export const sleep = (ms: number) =>
    new Promise(resolve => setTimeout(resolve, ms));


export function trackJob(
    activeJobs: Set<Promise<void>>,
    jobPromise: Promise<boolean>
) {
    const tracked = jobPromise.then(
        () => undefined,
        () => undefined
    );

    activeJobs.add(tracked);

    tracked.then(() => {
        activeJobs.delete(tracked);
    });

    return jobPromise;
}