const {Writable, PassThrough, Transform} = require('stream');


describe("streaming pipeline =>", () => {

    let source;
    let pipeline;
    let destination;

    beforeEach(() => {
        const options = {objectMode: true};
        source = new PassThrough(options);
        destination = new PassThrough(options);
        pipeline = new Pipeline(options, destination);
    });

    afterEach(() => {
        source.destroy();
        pipeline.destroy();
        destination.destroy();
    });

    it("should end if one of the input streams errors =>", (done) => {
        let errored = false;
        pipeline.on("error", (err) => {
            expect(err.type).toEqual('invalid.payload');
            expect(err.cause).toEqual('cannot handle: nope');
            errored = true;
        });

        pipeline.on("finish", () => {
            expect(errored).toBeTruthy();
            done();
        });
        source.pipe(pipeline);
        source.write({"index": 1, "data": "nope"});
    })
});


class Pipeline extends Writable {
    constructor(options, destinationStream) {
        super(options);
        this.destinationStream = destinationStream;
        this.inputStreams = [
            new InputTransform(options),
            new InputTransform(options),
            new InputTransform(options)
        ];
        this.inputStreams.forEach((it) => {
            it.on('error', (err) => {
                this.emit('error', err);
            });
            it.pipe(this.destinationStream);
        });
        this.on('finish', () => {
            this.inputStreams.forEach((it) => it.emit('end'));
        });
        this.on('error', () => {
            this.end();
        })
    }

    _write(chunk, _, callback) {
        this.inputStreams[chunk['index']].write(chunk['data']);
        callback(null);
    }
}

class InputTransform extends Transform {
    constructor(options) {
        super(options);
    }

    _transform(chunk, _, callback) {
        if (chunk === "nope") {
            callback(new MyCustomError('invalid.payload', `cannot handle: ${chunk}`))
        } else {
            callback(null, chunk);
        }
    }
}

class MyCustomError extends Error {
    constructor(type, cause) {
        super();

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, MyCustomError);
        }

        this.type = type;
        this.cause = cause;
    }
}