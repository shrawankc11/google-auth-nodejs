import http from 'http';
import keys from './cred.json';
import url from 'url';
import axios from 'axios';
import { config } from 'dotenv';
import { OAuth2Client, Credentials } from 'google-auth-library';

const pORT = process.env.PORT || 8080;
const rOOTURI = `http://localhost:${pORT}`;
config({ path: `${__dirname}/../.env` });

/**
 * store users to create login state
 * use db in production
 */
const clients = new Map<string, iUser>();

interface iUser {
    id: string;
    email: string;
}

async function getUserInfo(tokens: Credentials) {
    // get user profile and email from user scope
    return await axios
        .get(
            `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${tokens.access_token}`,
            {
                headers: {
                    Authorization: `Bearer ${tokens.id_token}`,
                },
            }
        )
        .then((res) => res.data)
        .catch(console.error);
}

async function main() {
    //create oauth server client
    const oauth2Client = new OAuth2Client(
        process.env.client_id,
        process.env.client_secret,
        keys.web.redirect_uris[1]
    );

    //generate auth Url
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
        ],
    });

    console.log(authUrl);
    //create server
    http.createServer(async (req, res) => {
        const { pathname } = new url.URL(`${rOOTURI}${req.url}`);
        if (pathname === '/') {
            //redirect user to google sign in page
            res.writeHead(301, { Location: authUrl });
        } else if (pathname === '/tokensignin') {
            //extract seach params from url
            const q = new url.URL(req.url || '', rOOTURI).searchParams;
            //get auth code from query string
            const code = q.get('code') || '';
            //generate tokens after getting auth code
            const r = await oauth2Client.getToken(code);

            //set credentials for this client => later used
            oauth2Client.setCredentials(r.tokens);

            //get token info for for validating id tokens if necessary
            const tokenInfo = await oauth2Client.getTokenInfo(
                oauth2Client.credentials.access_token as string
            );

            //use this tokeninfo to fetch user profile or email and authenticate user
            const user = await getUserInfo(oauth2Client.credentials);

            /**
             * authenticate user here
             * user a database in production run
             */
            const client = clients.get(user.id);
            if (client) {
                //create user sesssion if user already exists in db
                //issue session or jwt token here >>>
                res.write(
                    `<h1>logged in and session created with id ${client.id}!!</h1>`
                );
            } else {
                //save user info use db in prod >>>
                clients.set(user.id, { email: user.email, id: user.id });
                console.log('user added to db!');
                //redirect user to google login
                res.writeHead(301, { Location: authUrl });
            }
        } else {
            res.statusCode = 404;
        }
        res.end();
    }).listen(pORT, () => console.log(`serving on port ${pORT}`));
}

main().catch(console.error);
