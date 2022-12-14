# ScienceIO NodeJS SDK

To use, import the ScienceIO class and initialize with your `api-key-id` and `api-key-secret`. Then, call the annotate method.

The package supports TypeScript out of the box, and you can import the `ScienceIOResponse` interface if you would like.

Edge cases have not been tested and will be smoothed out tonight or tomorrow.

### Basic Usage Example

```node
import { ScienceIO, ScienceIOResponse } from "scienceio"

async function main() {
    const scio = new ScienceIO("api-key-id" "api-key-secret")
    const response: ScienceIOResponse = await scio.annotate("ALS is often called Lou Gehrigs disease, after the baseball player who was diagnosed with it. Doctors usually do not know why ALS occurs.")

    console.log(response)
}

main()

```

### How to run this

To get started, clone this folder. Then, create a `.env` file (you can use the `.env.example` file as a template). Because this hasn't yet been published to the npm registry, check out `src/example.ts` to see how you can get started right away. The package is really small, you could also simply paste in the `/src/index.ts` or `/lib/index.js` file straight away.