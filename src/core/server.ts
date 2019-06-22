export async function askServer(args: any[]): Promise<object> {
    return mockAskServer(args);
}

async function mockAskServer(args: any[]): Promise<object> {
    return Promise.resolve({
        error: false,
        args: args,
        foobar: 5
    });
}

export namespace serverMethods {
    export async function refreshRequestSubmissionsWithForm() {
        return askServer(['refreshRequestSubmissionsWithForm']);
    }

    export async function debug() {
        return askServer(['debug']);
    }
}
