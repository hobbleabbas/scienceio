import { ScienceIO } from "./index"

require('dotenv').config()

async function main() {
    const api_key_id = process.env.SCIENCEIO_API_KEY_ID
    const api_key_secret = process.env.SCIENCEIO_API_KEY_SECRET
    
    if (!api_key_id || !api_key_secret) {
        console.log("Please set the environment variables SCIENCEIO_API_KEY_ID and SCIENCEIO_API_KEY_SECRET")
        return
    }

    const scio = new ScienceIO(api_key_id, api_key_secret)
    const response = await scio.annotate("ALS is often called Lou Gehrigs disease, after the baseball player who was diagnosed with it. Doctors usually do not know why ALS occurs.")
    
    console.log(response)
}

main()