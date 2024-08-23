const fs = require('fs')
const path = require('path');

const tmi = require("tmi.js");
const yaml = require('js-yaml');
const ytdl = require('ytdl-core');
const puppeteer = require('puppeteer');

const configPath = path.join(__dirname, 'config.yaml');
const fileContent = fs.readFileSync(configPath, 'utf8');
const config = yaml.load(fileContent);

let options = {
    options: {
        debug: false
    },
    connection: {
        reconnect: true,
        secure: true
    },
    channels: [config.channel]
};

let client = new tmi.client(options);

client.on("connected", (address, port) => {
    console.log('Connected to chat!')
});

const bitsPerSec = config.bitsPerSec
const maxVideoTime = config.maxVideoLength

let queue = [];
let page;

let shouldSkip = false;
let currentAbortController = null;
let pause = false;

function skip() {
    shouldSkip = true;
    if (currentAbortController) {
        currentAbortController.abort();
    }
}

function timeout(ms, signal) {
    return new Promise((resolve, reject) => {
        const timerId = setTimeout(() => {
            resolve();
        }, ms);

        if (signal) {
            signal.addEventListener('abort', () => {
                clearTimeout(timerId);
                reject(new Error('Timeout aborted'));
            });
        }
    });
}

async function getVideoDuration(url) {
    try {
        const info = await ytdl.getInfo(url);
        const duration = info.videoDetails.lengthSeconds;
        console.log(`Video duration: ${duration} seconds`);
        return duration;
    } catch (error) {
        console.error('Error fetching video information:', error);
    }
}

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
    });

    page = await browser.newPage();

    await page.goto('https://youtube.com', { waitUntil: 'networkidle2' });

    const isPageOpen = () => !page.isClosed();

    const adjustViewport = async () => {
        if (!isPageOpen()) {
            console.log('Page is closed. Stopping viewport adjustments.');
            clearInterval(viewportInterval);
            return;
        }

        try {
            const dimensions = await page.evaluate(() => {
                return {
                    width: window.innerWidth,
                    height: window.innerHeight
                };
            });
            await page.setViewport(dimensions);
        } catch (error) {
            console.error('Error adjusting viewport:', error.message);
        }
    };

    await adjustViewport();

    await page.evaluate(() => {
        window.addEventListener('resize', () => {
            console.log('window resized');
        });
    });

    const viewportInterval = setInterval(async () => {
        await adjustViewport();
    }, 500);

    async function proceedQueue() {
        while (true) {
            while (pause) {
                await timeout(1000);
            }

            if (queue.length === 0) {
                await timeout(1000);
                continue;
            }

            while (queue.length > 0) {
                if (pause) {
                    break;
                }

                if (shouldSkip) {
                    shouldSkip = false;
                }

                const element = queue.shift();
                currentAbortController = new AbortController();
                const { signal } = currentAbortController;

                try {
                    await page.goto(element.link, { waitUntil: 'load' });
                    await timeout(element.duration * 1000, signal);
                } catch (error) {
                    if (error.message === 'Timeout aborted') {
                        console.log('Video skipped!');
                        continue;
                    } else {
                        throw error;
                    }
                }
            }

            await page.goto('https://www.youtube.com/');
        }
    }

    console.log('running queue function')
    proceedQueue()
    console.log('queue function ran')

    client.connect();
})();

client.on("chat", async (channel, userstate, message, self) => {
    if (!userstate.mod && userstate.username !== channel.replace('#', '')) { return; }

    const messageSplit = message.split(' ')

    if (messageSplit[0] == '!play') {
        if (messageSplit.length !== 2) { return; }
        if (messageSplit[1].startsWith('https://www.youtube.com/watch?v=')) {
            page.goto(messageSplit[1])
            console.log(`${userstate.username} played video`)
        }
    } else if (messageSplit[0] == '!queue') {
        if (messageSplit.length !== 2) { return; }
        if (messageSplit[1].startsWith('https://www.youtube.com/watch?v=')) {
            console.log(`${userstate.username} queued video`)
            queue.push({
                link: messageSplit[1],
                duration: await getVideoDuration(messageSplit[1])
            })
        }
    } else if (messageSplit[0] == '!skip') {
        console.log(`${userstate.username} skipped the video`)
        skip()
    } else if (messageSplit[0] == '!pause') {
        if (pause) {
            pause = false
            console.log(`${userstate.username} unpaused the queue`)
        } else {
            pause = true
            console.log(`${userstate.username} paused the queue`)
        }
    }
});

client.on("cheer", (channel, userstate, message) => {
    if (!message) { return; }

    if (userstate.bits < bitsPerSec) { return; }

    const messageSplit = message.split(' ')

    messageSplit.forEach(async element => {
        if (element.startsWith('https://www.youtube.com/watch?v=')) {
            console.log(`${userstate.username}, queued a video by cheering.`)
            const videoLength = await getVideoDuration(element)
            let requestLength = (userstate.bits / bitsPerSec)

            if (videoLength > requestLength) {
                requestLength = videoLength
            }

            if (videoLength > maxVideoTime) { return; }

            queue.push({
                link: element,
                duration: requestLength
            })
        }
    });
});