const axios = require('axios').default;
const tough = require('tough-cookie');
const cheerio = require('cheerio');
const io = require('socket.io-client');

const URL = 'http://localhost:420';
// const URL = 'http://172.16.3.130:420';
const classID = '93nt';
// const classID = 'p6kb'
const guestCount = 24
const userSessions = [];

process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

let nextGuestId = 1;
function makeDisplayName() {
    return `guest${nextGuestId++}`.padEnd(5, '_');
}

async function createFakeGuest(displayName) {
    const { wrapper } = await import('axios-cookiejar-support');
    const jar = new tough.CookieJar();
    const client = wrapper(axios.create({
        jar,
        withCredentials: true,
        timeout: 0, //! Maybe change this later
        validateStatus: (status) => status < 500
    }));

    try {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 0)); //! Maybe change this later
        const loginResponse = await client.post(
            `${URL}/login`,
            new URLSearchParams({ displayName, loginType: 'guest' }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        if (loginResponse.status !== 200) {
            console.log(`⚠ ${displayName} login returned status ${loginResponse.status}`);
            return null;
        }
        // console.log(`✓ ${displayName} logged in (status ${loginResponse.status})`);

        await new Promise(resolve => setTimeout(resolve, 0));
        const classResponse = await client.post(
            `${URL}/selectClass`,
            new URLSearchParams({ key: classID }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        if (classResponse.status !== 200) {
            console.log(`⚠ ${displayName} class join returned status ${classResponse.status}`);
            return null;
        }
        console.log(`  → ${displayName} joined class (status ${classResponse.status})`);

        const studentPage = await client.get(`${URL}/student`);
        if (studentPage.status !== 200) {
            console.log(`⚠ ${displayName} /student page returned status ${studentPage.status}`);
            return null;
        }
        if (!studentPage.data || (!studentPage.data.includes('Poll') && !studentPage.data.includes('poll'))) {
            console.log(`⚠ ${displayName} /student page does not look like a student dashboard`);
            return null;
        }

        const cookies = jar.getCookiesSync(URL);
        if (!cookies.some(c => c.key.startsWith('connect'))) {
            console.log(`⚠ ${displayName} missing session cookie after login/join`);
            return null;
        }

        const session = { name: displayName, client, jar };
        // Connect socket.io for this session
        session.socket = io(URL, {
            withCredentials: true,
            extraHeaders: {
                Cookie: jar.getCookieStringSync(URL)
            }
        });
        userSessions.push(session);
        return session;
    } catch (error) {
        console.log(`✗ Error for ${displayName}:`, error.response?.status || error.code || error.message);
        if (error.response?.data) {
            console.log(`  Error data:`, error.response.data.substring(0, 200));
        }
        return null;
    }
}

async function getPollOptions(session) {
    try {
        const response = await session.client.get(`${URL}/student`, {
            responseType: 'text'
        });
        const $ = cheerio.load(response.data);
        const options = [];
        // Try to select poll buttons more flexibly if the name attribute is not present
        $('button[name="poll"], button.poll, input[type="radio"][name="poll"]').each((_, el) => {
            options.push({
                id: $(el).attr('id') || $(el).val() || $(el).attr('value'),
                text: $(el).text().trim() || $(el).val() || $(el).attr('value')
            });
        });
        return options.length ? options : 'No poll options found';
    } catch (error) {
        console.error("Error fetching poll options:", error);
        return null;
    }
}

async function submitPollResponse(session, optionId) {
    try {
        // console.log(`  📊 ${session.name} attempting to vote for option ${optionId}`);
        if (!session.socket) {
            console.log(`  ✗ ${session.name} has no socket connection!`);
            return false;
        }
        // Emit pollResp via socket.io
        session.socket.emit('pollResp', optionId, "");
        // console.log(`  ✓ ${session.name} emitted pollResp for option ${optionId}`);
        return true;
    } catch (error) {
        console.log(`  ✗ ${session.name} failed to vote:`);
        console.log(`    Error type: ${error.constructor.name}`);
        console.log(`    Error code: ${error.code}`);
        console.log(`    Error message: ${error.message}`);
        return false;
    }
}

async function debugStudentPage(session) {
    try {
        const response = await session.client.get(`${URL}/student`);
        console.log(`\n=== DEBUG: Student page for ${session.name} ===`);
        console.log(`Status: ${response.status}`);
        console.log(`Headers:`, Object.keys(response.headers));
        console.log(`Content-Type:`, response.headers['content-type']);
        console.log(`Content length:`, response.data?.length || 'unknown');
        console.log(`Content preview:`, response.data.substring(0, 800));
        const cookies = session.jar.getCookiesSync(URL);
        console.log(`Session cookies: ${cookies.length} cookies`);
        cookies.forEach(cookie => {
            console.log(`  ${cookie.key}=${cookie.value.substring(0, 20)}${cookie.value.length > 20 ? '...' : ''}`);
        });
        console.log(`=== END DEBUG ===\n`);
    } catch (error) {
        console.log(`Debug failed for ${session.name}:`);
        console.log(`  Error type: ${error.constructor.name}`);
        console.log(`  Error code: ${error.code}`);
        console.log(`  Error message: ${error.message}`);
        if (error.response) {
            console.log(`  Response status: ${error.response.status}`);
            console.log(`  Response data preview:`, error.response.data?.substring(0, 200));
        }
    }
}

async function testConnectivity() {
    console.log('\n=== TESTING BASIC CONNECTIVITY ===');
    try {
        const response = await axios.get(URL, { timeout: 0 });
        console.log(`✓ Server is reachable. Status: ${response.status}`);
        console.log(`✓ Content-Type: ${response.headers['content-type']}`);
        const studentResponse = await axios.get(`${URL}/student`, { timeout: 0 });
        console.log(`✓ Student page accessible. Status: ${studentResponse.status}`);
        return true;
    } catch (error) {
        console.log(`✗ Server connectivity test failed:`);
        console.log(`  Error code: ${error.code}`);
        console.log(`  Error message: ${error.message}`);
        if (error.response) {
            console.log(`  Response status: ${error.response.status}`);
        }
        return false;
    }
}

function printCommands() {
    console.log('\nStarting poll interaction simulation...');
    console.log('Commands:');
    console.log('  options - Show current poll options');
    console.log('  vote <id> - All users vote for specific option (e.g., \"vote True\")');
    console.log('  random <id1,id2,...> - Users vote randomly from given options');
    console.log('  single <id> - Single user votes for testing');
    console.log('  debug - Show debug info for first user session');
    console.log('  test - Test basic server connectivity');
    console.log('  stop - Stop the simulation');
    console.log('  exit - Exit the program');
    console.log('  leave <count> - "count" users leave the active class')
    console.log('  more <count> - "count" users join the room');
    console.log('  break <count> - "count" users request a break');
    console.log('  help <count> - "count" users request help');
    console.log('  randAction - Users make random actions\n');
}

/*
::::::::::: ::::    ::: ::::::::::: :::::::::: :::::::::      :::      :::::::: :::::::::::
    :+:     :+:+:   :+:     :+:     :+:        :+:    :+:   :+: :+:   :+:    :+:    :+:
    +:+     :+:+:+  +:+     +:+     +:+        +:+    +:+  +:+   +:+  +:+           +:+
    +#+     +#+ +:+ +#+     +#+     +#++:++#   +#++:++#:  +#++:++#++: +#+           +#+
    +#+     +#+  +#+#+#     +#+     +#+        +#+    +#+ +#+     +#+ +#+           +#+
    #+#     #+#   #+#+#     #+#     #+#        #+#    #+# #+#     #+# #+#    #+#    #+#
########### ###    ####     ###     ########## ###    ### ###     ###  ########     ###
*/

async function simulatePollInteractions() {
    if (userSessions.length === 0) {
        console.log('No active user sessions available for poll interactions');
        return;
    }
    
    printCommands()

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (input) => {
        const command = input.trim();
        if (command === 'exit') {
            process.exit(0);

        } else if (command === 'stop') {
            console.log('Poll simulation stopped. Waiting for new commands...');

        } else if (command === 'test') {
            await testConnectivity();

        } else if (command === 'debug') {
            if (userSessions.length > 0) {
                await debugStudentPage(userSessions[0]);
            }

        } else if
            (command === 'options') {
            if (userSessions.length > 0) {
                console.log(await getPollOptions(userSessions[0]))
            }

        } else if (command.startsWith('single ')) {
            const option = command.substring(7).trim();
            if (userSessions.length > 0) {
                console.log(`Testing single vote with ${userSessions[0].name} for option: ${option}`);
                const result = submitPollResponse(userSessions[0], option);
                console.log(`Single vote test: ${result ? 'SUCCESS' : 'FAILED'}`);
            }

        } else if (command.startsWith('vote ')) {
            const option = command.substring(5).trim();
            console.log(`Making all users vote for option: ${option}`);
            // Vote in parallel
            const votePromises = userSessions.map(session => submitPollResponse(session, option));
            const results = await Promise.all(votePromises);
            const successful = results.filter(r => r).length;
            console.log(`Vote completed: ${successful}/${userSessions.length} users voted successfully`);

        } else if (command.startsWith('random ')) {
            const optionsStr = command.substring(7).trim();
            const options = optionsStr.split(',').map(opt => opt.trim());

            if (options.length === 0) {
                console.log('Please provide options separated by commas (e.g., "random True,False")');
                return;
            }

            console.log(`Making users vote randomly from options: ${options.join(', ')}`);
            // Vote in parallel
            const votePromises = userSessions.map(session => {
                const randomOption = options[Math.floor(Math.random() * options.length)];
                return submitPollResponse(session, randomOption);
            });

            const results = await Promise.all(votePromises);
            const successful = results.filter(r => r).length;
            console.log(`Random vote completed: ${successful}/${userSessions.length} users voted successfully`);

        } else if (command.startsWith('leave ')) {
            const count = Number(command.substring(6).trim());
            if (!count) {
                console.log('Please provide an amount of users.');
                return;
            }
            console.log(`Making ${count} users leave the room.`);
            let toRemove = Math.min(count, userSessions.length);
            while (toRemove-- > 0) {
                const session = userSessions[0];
                if (session && session.socket) {
                    session.socket.emit('leaveRoom');
                    console.log(`User ${session.name} left the room.`);
                }
                userSessions.shift();
            }
        } else if (command.startsWith('more ')) {
            const count = command.substring(5).trim();
            if (!count) {
                console.log('Please provide an amount of users.');
                return;
            }
            console.log(`Making ${count} users join the room.`);
            createGuests(count).catch(err => console.error('Fatal error:', err));

        } else if (command.startsWith('break ')) {
            const count = command.substring(6).trim();
            if (!count) {
                console.log('Please provide an amount of users.');
                return;
            }

            for (let i = 0; i < Math.min(Number(count), userSessions.length); i++) {
                const session = userSessions[i];
                if (session && session.socket) {
                    session.socket.emit('requestBreak', `${session.name} wants to take a break.`);
                }
            }

        } else if (command.startsWith('help ')) {
            const count = command.substring(5).trim();
            if (!count) {
                console.log('Please provide an amount of users.');
                return;
            }

            for (let i = 0; i < Math.min(Number(count), userSessions.length); i++) {
                const session = userSessions[i];
                if (session && session.socket) {
                    session.socket.emit('help', `${session.name} needs help.`);
                }
            }

        } else if (command == 'randAction') {
            for (let session of userSessions) {
                const action = Math.floor(Math.random() * 10) + 1;
                if (action == 9) {
                    session.socket.emit('requestBreak', `${session.name} wants to take a break.`)
                    console.log(`${session.name} wants to take a break.`)
                } else if (action == 10) {
                    session.socket.emit('help', `${session.name} needs help.`)
                    console.log(`${session.name} needs help.`);
                }
            }
        } else if (command.trim() !== '') {
            console.log('Invalid command. Here are the available commands:') 
            printCommands()
        }
    });
}
/*
 ::::::::  :::::::::  ::::::::::     ::: ::::::::::: ::::::::::
:+:    :+: :+:    :+: :+:          :+: :+:   :+:     :+:
+:+        +:+    +:+ +:+         +:+   +:+  +:+     +:+
+#+        +#++:++#:  +#++:++#   +#++:++#++: +#+     +#++:++#
+#+        +#+    +#+ +#+        +#+     +#+ +#+     +#+
#+#    #+# #+#    #+# #+#        #+#     #+# #+#     #+#
 ########  ###    ### ########## ###     ### ###     ##########
*/
async function createGuests(count) {
    console.log('Creating fake guest users...');
    const batchSize = count < 4 ? 1 : Math.ceil(count / 3);
    let added = 0;
    for (let batch = 0; added < count; batch++) {
        const batchPromises = [];
        const start = added + 1;
        const end = Math.min(added + batchSize, count);
        console.log(`Creating batch ${batch + 1}: guests ${start}-${end}`);
        for (let i = start; i <= end; i++) {
            const name = makeDisplayName();
            batchPromises.push(createFakeGuest(name));
        }
        added += (end - start + 1);
        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.log(`Failed to create guest${start + index}:`, result.reason);
            }
        });

        // Timeout between batches

        // if (added < count) {
        //     await new Promise(resolve => setTimeout(resolve, 1000));
        // }
    }
    console.log(`\nFinished creating users. Total active sessions: ${userSessions.length}`);
    console.log('\nTesting sessions are unique:');
    userSessions.forEach((session, index) => {
        const cookies = session.jar.getCookiesSync(URL);
        console.log(`Session ${index + 1}: ${session.name}, Cookie count: ${cookies.length}`);
    });
    if (!inited) await simulatePollInteractions();
    inited = true
}

let inited
createGuests(guestCount).catch(err => console.error('Fatal error:', err));